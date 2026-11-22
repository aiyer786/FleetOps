
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../db";
import { reconcilePendingUpdates } from "../repositories/vendorReconciliationRepository";

describe("Unknown vendor battery handling", () => {
  it("marks readings for nonexistent batteries as NEEDS_REVIEW", async () => {
    const client = await pool.connect();
    const batchId = `UNKNOWN-BATTERY-${Date.now()}`;

    try {
      const batch = await client.query(
        `
          INSERT INTO vendor_batches (
            vendor_name,
            vendor_batch_id,
            source_timestamp,
            status
          )
          VALUES (
            'UnknownBatteryTest',
            $1,
            NOW(),
            'RECEIVED'
          )
          RETURNING id
        `,
        [batchId]
      );

      await client.query(
        `
          INSERT INTO battery_updates (
            vendor_batch_id,
            battery_id,
            vendor_update_timestamp,
            state_of_charge,
            processing_status
          )
          VALUES ($1, 999999999, NOW(), 80, 'PENDING')
        `,
        [batch.rows[0].id]
      );

      const result = await reconcilePendingUpdates(100);

      const reading = await client.query(
        `
          SELECT processing_status
          FROM battery_updates
          WHERE vendor_batch_id = $1
        `,
        [batch.rows[0].id]
      );

      assert.equal(
        reading.rows[0].processing_status,
        "NEEDS_REVIEW"
      );

      assert.ok(result.needsReview >= 1);
    } finally {
      await client.query(
        `
          DELETE FROM battery_updates
          WHERE vendor_batch_id IN (
            SELECT id FROM vendor_batches
            WHERE vendor_name = 'UnknownBatteryTest'
              AND vendor_batch_id = $1
          )
        `,
        [batchId]
      );

      await client.query(
        `
          DELETE FROM vendor_batches
          WHERE vendor_name = 'UnknownBatteryTest'
            AND vendor_batch_id = $1
        `,
        [batchId]
      );

      client.release();
    }
  });
});
