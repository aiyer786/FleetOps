
import { pool } from "../db";

const STALE_THRESHOLD_HOURS = 2;

export interface VendorFeedHealth {
  vendorName: string;
  lastSuccessfulBatch: Date | null;
  isStale: boolean;
}

export async function getVendorFeedHealth(): Promise<VendorFeedHealth[]> {
  const result = await pool.query(
    `
      SELECT
        vendor_name,
        MAX(received_at) FILTER (
          WHERE status IN ('PROCESSED', 'NEEDS_REVIEW')
        ) AS last_successful_batch
      FROM vendor_batches
      GROUP BY vendor_name
    `
  );

  return result.rows.map((row) => {
    const lastSuccessfulBatch = row.last_successful_batch
      ? new Date(row.last_successful_batch)
      : null;

    const ageInHours = lastSuccessfulBatch
      ? (Date.now() - lastSuccessfulBatch.getTime()) / 3600000
      : Infinity;

    return {
      vendorName: row.vendor_name,
      lastSuccessfulBatch,
      isStale: ageInHours > STALE_THRESHOLD_HOURS,
    };
  });
}
