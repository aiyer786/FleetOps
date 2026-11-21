import { Router } from "express";
import { createBookingController } from "../controllers/bookingController";

const router = Router();

router.post("/", createBookingController);

export default router;
