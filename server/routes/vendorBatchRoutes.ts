
import { Router } from "express";
import {
  receiveVendorBatch,
  getVendorFeedHealthStatus,
} from "../controllers/vendorBatchController";

const router = Router();

router.post("/", receiveVendorBatch);
router.get("/health", getVendorFeedHealthStatus);

export default router;
