
import { pool } from "../db";

export interface ReconciliationResult {
  processed: number;
  applied: number;
  ignored: number;
  needsReview: number;
}

export async function reconcilePendingUpdates(
  limit = 100
): Promise<ReconciliationResult> {
  const client = await pool.connect();

  const result: ReconciliationResult = {
    processed: 0,
    applied: 0,
    ignored: 0,
    needsReview: 0,
  };

  try {
    await client.query("BEGIN");

    
  const pending = await client.query(
    `
        SELECT
        bu.id AS update_id,
        bu.battery_id,
        bu.vendor_update_timestamp,
        bu.state_of_charge,
        vb.source_timestamp,
        b.id AS matched_battery_id,
        b.last_vendor_update,
        b.last_platform_event_at
        FROM battery_updates bu
        JOIN vendor_batches vb
        ON vb.id = bu.vendor_batch_id
        LEFT JOIN batteries b
        ON b.id = bu.battery_id
        WHERE bu.processing_status = 'PENDING'
        ORDER BY bu.id
        LIMIT $1
        FOR UPDATE OF bu SKIP LOCKED
    `,
    [limit]
    );

    for (const update of pending.rows) {
      result.processed++;
      // Battery does not exist in our platform.
      if (update.matched_battery_id === null) {
        await client.query(
            `
            UPDATE battery_updates
            SET processing_status = 'NEEDS_REVIEW'
            WHERE id = $1
            `,
            [update.update_id]
        );

        result.needsReview++;
        continue;
      }

      const vendorTimestamp =
        update.vendor_update_timestamp ?? update.source_timestamp;

      // Without a timestamp, we cannot safely establish ordering.
      if (!vendorTimestamp) {
        await client.query(
          `
            UPDATE batteries
            SET operational_state = 'UNKNOWN',
                needs_review = TRUE,
                updated_at = NOW()
            WHERE id = $1
          `,
          [update.battery_id]
        );

        await client.query(
          `
            UPDATE battery_updates
            SET processing_status = 'NEEDS_REVIEW'
            WHERE id = $1
          `,
          [update.update_id]
        );

        result.needsReview++;
        continue;
      }

      const vendorTime = new Date(vendorTimestamp).getTime();

      const lastVendorTime = update.last_vendor_update
        ? new Date(update.last_vendor_update).getTime()
        : null;

      const lastPlatformTime = update.last_platform_event_at
        ? new Date(update.last_platform_event_at).getTime()
        : null;

      // Older vendor data must not replace newer vendor data.
      if (
        lastVendorTime !== null &&
        vendorTime <= lastVendorTime
      ) {
        await client.query(
          `
            UPDATE battery_updates
            SET processing_status = 'IGNORED'
            WHERE id = $1
          `,
          [update.update_id]
        );

        result.ignored++;
        continue;
      }

      // A newer platform event takes precedence over vendor telemetry.
      if (
        lastPlatformTime !== null &&
        vendorTime <= lastPlatformTime
      ) {
        await client.query(
          `
            UPDATE batteries
            SET operational_state = 'UNKNOWN',
                needs_review = TRUE,
                updated_at = NOW()
            WHERE id = $1
          `,
          [update.battery_id]
        );

        await client.query(
          `
            UPDATE battery_updates
            SET processing_status = 'NEEDS_REVIEW'
            WHERE id = $1
          `,
          [update.update_id]
        );

        result.needsReview++;
        continue;
      }
      // Accept the telemetry timestamp, but do not change
      // platform-owned operational_state or battery assignment.
      await client.query(
        `
          UPDATE batteries
            SET state_of_charge = COALESCE($1, state_of_charge),
                last_vendor_update = $2,
                updated_at = NOW()
            WHERE id = $3
        `,
        [update.state_of_charge, vendorTimestamp, update.battery_id,]
      );

      await client.query(
        `
          UPDATE battery_updates
          SET processing_status = 'APPLIED'
          WHERE id = $1
        `,
        [update.update_id]
      );

      result.applied++;
    }

    // Update batch status after processing its readings.
    await client.query(
      `
        UPDATE vendor_batches vb
        SET status = CASE
          WHEN EXISTS (
            SELECT 1
            FROM battery_updates bu
            WHERE bu.vendor_batch_id = vb.id
              AND bu.processing_status = 'NEEDS_REVIEW'
          ) THEN 'NEEDS_REVIEW'
          ELSE 'PROCESSED'
        END
        WHERE vb.status IN ('RECEIVED', 'PROCESSING')
          AND NOT EXISTS (
            SELECT 1
            FROM battery_updates bu
            WHERE bu.vendor_batch_id = vb.id
              AND bu.processing_status = 'PENDING'
          )
      `
    );

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
