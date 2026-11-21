
import { pool } from "../db";
import type { VendorBatch } from "../services/vendorBatchValidation";

export interface PersistVendorBatchResult {
  batchRecordId: string;
  duplicate: boolean;
  readingsSaved: number;
}

export async function persistVendorBatch(
  batch: VendorBatch
): Promise<PersistVendorBatchResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Insert the batch. The unique vendor/batch constraint
    // prevents the same batch from being stored twice.
    const batchResult = await client.query<{ id: string }>(
      `
        INSERT INTO vendor_batches (
          vendor_name,
          vendor_batch_id,
          vendor_sequence,
          source_timestamp,
          status
        )
        VALUES ($1, $2, $3, $4, 'RECEIVED')
        ON CONFLICT (vendor_name, vendor_batch_id)
        DO NOTHING
        RETURNING id
      `,
      [
        batch.vendorName,
        batch.batchId,
        batch.sequence,
        batch.sourceTimestamp,
      ]
    );

    // A batch with this vendor identity already exists.
    if (batchResult.rows.length === 0) {
      const existingBatch = await client.query<{ id: string }>(
        `
          SELECT id
          FROM vendor_batches
          WHERE vendor_name = $1
            AND vendor_batch_id = $2
        `,
        [batch.vendorName, batch.batchId]
      );

      await client.query("COMMIT");

      return {
        batchRecordId: existingBatch.rows[0].id,
        duplicate: true,
        readingsSaved: 0,
      };
    }

    const batchRecordId = batchResult.rows[0].id;

    // Store each battery reading against the internal batch ID.
    for (const reading of batch.readings) {
      await client.query(
        `
          INSERT INTO battery_updates (
            vendor_batch_id,
            battery_id,
            vendor_update_timestamp,
            state_of_charge,
            reported_status,
            raw_payload,
            processing_status
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'PENDING')
        `,
        [
          batchRecordId,
          reading.batteryId,
          reading.timestamp,
          reading.stateOfCharge,
          reading.reportedStatus,
          JSON.stringify(reading),
        ]
      );
    }

    await client.query("COMMIT");

    return {
      batchRecordId,
      duplicate: false,
      readingsSaved: batch.readings.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
