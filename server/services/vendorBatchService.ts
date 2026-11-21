
import {
  validateVendorBatch,
} from "./vendorBatchValidation";

import {
  persistVendorBatch,
} from "../repositories/vendorBatchRepository";

export async function ingestVendorBatch(input: unknown) {
  // Step 1: Validate the incoming vendor payload.
  const batch = validateVendorBatch(input);

  // Step 2: Persist the batch and its readings.
  const result = await persistVendorBatch(batch);

  // Step 3: Return a consistent response.
  return {
    success: true,
    message: result.duplicate
      ? "Batch already received"
      : "Vendor batch received successfully",
    batchId: batch.batchId,
    batchRecordId: result.batchRecordId,
    duplicate: result.duplicate,
    readingsSaved: result.readingsSaved,
  };
}
