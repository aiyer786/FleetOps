
import { Request, Response } from "express";
import { ingestVendorBatch } from "../services/vendorBatchService";

export async function receiveVendorBatch(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const result = await ingestVendorBatch(req.body);

    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";

    const validationErrors = [
      "INVALID_VENDOR_BATCH",
      "INVALID_VENDOR_IDENTITY",
      "INVALID_VENDOR_SEQUENCE",
      "INVALID_SOURCE_TIMESTAMP",
      "INVALID_VENDOR_READINGS",
      "DUPLICATE_BATTERY_IDS",
      "INVALID_BATTERY_READING",
      "INVALID_BATTERY_ID",
      "INVALID_BATTERY_TIMESTAMP",
      "INVALID_STATE_OF_CHARGE",
      "INVALID_REPORTED_STATUS",
    ];

    if (validationErrors.includes(message)) {
      res.status(400).json({
        success: false,
        error: message,
      });
      return;
    }

    console.error("Vendor batch ingestion failed:", error);

    res.status(500).json({
      success: false,
      error: "VENDOR_BATCH_INGESTION_FAILED",
    });
  }
}
