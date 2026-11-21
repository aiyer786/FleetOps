
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateVendorBatch } from "../services/vendorBatchValidation";

const validBatch = {
  vendorName: "BatteryVendorA",
  batchId: "BATCH-1001",
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

describe("validateVendorBatch", () => {
  it("accepts a valid vendor batch", () => {
    const result = validateVendorBatch(validBatch);
    assert.equal(result.batchId, "BATCH-1001");
    assert.equal(result.readings.length, 1);
  });

  it("allows missing ordering metadata", () => {
    const result = validateVendorBatch({
      ...validBatch,
      sequence: null,
      sourceTimestamp: null,
    });
    assert.equal(result.sequence, null);
  });

  it("rejects invalid state of charge", () => {
    assert.throws(
      () => validateVendorBatch({
        ...validBatch,
        readings: [{ ...validBatch.readings[0], stateOfCharge: 150 }],
      }),
      { message: "INVALID_STATE_OF_CHARGE" }
    );
  });

  it("rejects duplicate battery IDs within a batch", () => {
    assert.throws(
      () => validateVendorBatch({
        ...validBatch,
        readings: [
          validBatch.readings[0],
          validBatch.readings[0],
        ],
      }),
      { message: "DUPLICATE_BATTERY_IDS" }
    );
  });

  it("rejects timestamps without timezone information", () => {
    assert.throws(
      () => validateVendorBatch({
        ...validBatch,
        sourceTimestamp: "2026-11-22T08:00:00",
      }),
      { message: "INVALID_SOURCE_TIMESTAMP" }
    );
  });
});
