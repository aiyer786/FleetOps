
import { reconcilePendingUpdates } from "../repositories/vendorReconciliationRepository";

const POLL_INTERVAL_MS = 30_000;
const BATCH_SIZE = 100;

let isRunning = false;
let isProcessing = false;

async function processPendingUpdates(): Promise<void> {
  if (isProcessing) return;

  isProcessing = true;

  try {
    const result = await reconcilePendingUpdates(BATCH_SIZE);

    if (result.processed > 0) {
      console.log("[Vendor Worker] Reconciliation completed:", result);
    }
  } catch (error) {
    console.error("[Vendor Worker] Reconciliation failed:", error);
  } finally {
    isProcessing = false;
  }
}

export function startVendorReconciliationWorker(): void {
  if (isRunning) return;

  isRunning = true;

  console.log("[Vendor Worker] Started. Polling every 30 seconds.");

  // Process immediately when the worker starts.
  void processPendingUpdates();

  // Then continue polling.
  setInterval(() => {
    void processPendingUpdates();
  }, POLL_INTERVAL_MS);
}
