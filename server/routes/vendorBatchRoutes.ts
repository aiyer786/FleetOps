
import { Router } from "express";
import { receiveVendorBatch } from "../controllers/vendorBatchController";

const router = Router();

router.post("/", receiveVendorBatch);

export default router;
