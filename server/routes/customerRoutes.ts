
import { Router } from "express";

import {
  getAllCustomers,
  getCustomerTrucks,
} from "../controllers/customerController";

const router = Router();

router.get("/", getAllCustomers);
router.get("/:customerId/trucks", getCustomerTrucks);

export default router;
