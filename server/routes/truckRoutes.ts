
import { Router } from "express";
import { getTruckById } from "../controllers/truckController";

const router = Router();

router.get("/:id", getTruckById);

export default router;
