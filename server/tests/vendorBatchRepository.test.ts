
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { persistVendorBatch } from "../repositories/vendorBatchRepository";

describe("persistVendorBatch integration", () => {
  it("saves a batch and prevents duplicate insertion", async () => {
    const batchId = `TEST-${Date.now()}`;

    const batch = {
      vendorName: "TestVendor",
      batchId,
      sequence: 101,
      sourceTimestamp: "2026-11-22T08:00:00Z",
      readings: [
        {
          batteryId: 1,
          timestamp: "2026-11-22T07:58:00Z",
          stateOfCharge: 85,
          reportedStatus: "CHARGED",
        },
      ],
    };

    const firstResult = await persistVendorBatch(batch);

    assert.equal(firstResult.duplicate, false);
    assert.equal(firstResult.readingsSaved, 1);

    const secondResult = await persistVendorBatch(batch);

    assert.equal(secondResult.duplicate, true);
    assert.equal(secondResult.readingsSaved, 0);
    assert.equal(secondResult.batchRecordId, firstResult.batchRecordId);
  });
});
