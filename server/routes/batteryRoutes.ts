
import { Router } from "express";
import { getAllBatteries } from "../controllers/batteryController";

const router = Router();

router.get("/", getAllBatteries);

export default router;
