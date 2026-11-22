
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../db";
import { reconcilePendingUpdates } from "../repositories/vendorReconciliationRepository";

describe("Vendor reconciliation integration", () => {
  it("handles newer, older and conflicting vendor readings", async () => {
    const client = await pool.connect();

    const testBatches = [
      `RECON-NEW-${Date.now()}`,
      `RECON-OLD-${Date.now()}`,
      `RECON-CONFLICT-${Date.now()}`,
    ];

    try {
      const batteryIds = [4, 5, 6];

      // Establish known starting timestamps.
      for (const batteryId of batteryIds) {
        await client.query(
          `
            UPDATE batteries
            SET last_vendor_update = '2026-01-01T00:00:00Z',
                last_platform_event_at = NULL,
                needs_review = FALSE
            WHERE id = $1
          `,
          [batteryId]
        );
      }

      // Battery 4: newer vendor reading should be applied.
      // Battery 5: older vendor reading should be ignored.
      // Battery 6: newer platform event should trigger review.
      await client.query(
        `
          UPDATE batteries
          SET last_vendor_update = '2026-01-02T00:00:00Z'
          WHERE id = 5
        `
      );

      await client.query(
        `
          UPDATE batteries
          SET last_platform_event_at = '2026-01-03T00:00:00Z'
          WHERE id = 6
        `
      );

      const cases = [
        { batteryId: 4, timestamp: "2026-01-02T00:00:00Z" },
        { batteryId: 5, timestamp: "2026-01-01T12:00:00Z" },
        { batteryId: 6, timestamp: "2026-01-02T12:00:00Z" },
      ];

      for (let i = 0; i < cases.length; i++) {
        const batchResult = await client.query(
          `
            INSERT INTO vendor_batches (
              vendor_name,
              vendor_batch_id,
              vendor_sequence,
              source_timestamp,
              status
            )
            VALUES ('ReconciliationTest', $1, $2, $3, 'RECEIVED')
            RETURNING id
          `,
          [
            testBatches[i],
            i + 1,
            cases[i].timestamp,
          ]
        );

        await client.query(
          `
            INSERT INTO battery_updates (
              vendor_batch_id,
              battery_id,
              vendor_update_timestamp,
              state_of_charge,
              reported_status,
              processing_status
            )
            VALUES ($1, $2, $3, 80, 'CHARGED', 'PENDING')
          `,
          [
            batchResult.rows[0].id,
            cases[i].batteryId,
            cases[i].timestamp,
          ]
        );
      }

      const result = await reconcilePendingUpdates(100);

      const statuses = await client.query(
        `
          SELECT battery_id, processing_status
          FROM battery_updates bu
          JOIN vendor_batches vb ON vb.id = bu.vendor_batch_id
          WHERE vb.vendor_name = 'ReconciliationTest'
            AND vb.vendor_batch_id = ANY($1)
          ORDER BY battery_id
        `,
        [testBatches]
      );

    assert.equal(
        statuses.rows.find((r) => Number(r.battery_id) === 4)?.processing_status,
        "APPLIED"
        );

    assert.equal(
        statuses.rows.find((r) => Number(r.battery_id) === 5)?.processing_status,
        "IGNORED"
        );

    assert.equal(
        statuses.rows.find((r) => Number(r.battery_id) === 6)?.processing_status,
        "NEEDS_REVIEW"
        );

      const battery6 = await client.query(
        `
          SELECT operational_state, needs_review
          FROM batteries
          WHERE id = 6
        `
      );

      assert.equal(battery6.rows[0].operational_state, "UNKNOWN");
      assert.equal(battery6.rows[0].needs_review, true);

      assert.ok(result.applied >= 1);
      assert.ok(result.ignored >= 1);
      assert.ok(result.needsReview >= 1);
    } finally {
      await client.query(
        `
          DELETE FROM battery_updates
          WHERE vendor_batch_id IN (
            SELECT id FROM vendor_batches
            WHERE vendor_name = 'ReconciliationTest'
              AND vendor_batch_id = ANY($1)
          )
        `,
        [testBatches]
      );

      await client.query(
        `
          DELETE FROM vendor_batches
          WHERE vendor_name = 'ReconciliationTest'
            AND vendor_batch_id = ANY($1)
        `,
        [testBatches]
      );

      // Restore test batteries.
      await client.query(
        `
          UPDATE batteries
          SET last_vendor_update = NULL,
              last_platform_event_at = NULL,
              needs_review = FALSE,
              updated_at = NOW()
          WHERE id IN (4, 5, 6)
        `
      );

      client.release();
    }
  });
});
