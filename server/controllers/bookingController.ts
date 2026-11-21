import { Request, Response } from "express";
import { createBooking } from "../services/bookingService";

export async function createBookingController(
  req: Request,
  res: Response
) {
  try {
    const result = await createBooking(req.body);

    return res.status(result.replayed ? 200 : 201).json({
      success: true,
      replayed: result.replayed,
      booking: result.booking,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";

    const notFoundErrors = [
      "CUSTOMER_NOT_FOUND_OR_INACTIVE",
      "STATION_NOT_FOUND_OR_INACTIVE",
      "STATION_DAY_PLAN_NOT_FOUND",
      "CUSTOMER_NOT_FOUND",
    ];

    const conflictErrors = [
      "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST",
      "INSUFFICIENT_DAILY_CAPACITY",
      "INSUFFICIENT_SHARED_CAPACITY",
      "INSUFFICIENT_PROTECTED_CAPACITY",
      "INSUFFICIENT_BATTERY_OR_SERVICE_CAPACITY",
      "NO_AVAILABLE_SERVICE_INTERVALS",
      "INTERVAL_CAPACITY_EXHAUSTED",
    ];

    if (notFoundErrors.includes(message)) {
      return res.status(404).json({
        success: false,
        error: message,
      });
    }

    if (conflictErrors.includes(message)) {
      return res.status(409).json({
        success: false,
        error: message,
      });
    }

    if (
        message.startsWith("INVALID_") ||
        message.startsWith("BOOKING_WINDOW_") ||
        message === "DUPLICATE_TRUCK_IDS" ||
        message === "MAX_TRUCKS_PER_REQUEST_EXCEEDED" ||
        message === "ONE_OR_MORE_TRUCKS_INVALID" ||
        message === "TIMESTAMP_TIMEZONE_REQUIRED"
    ) {
      return res.status(400).json({
        success: false,
        error: message,
      });
    }

    console.error("Booking creation failed:", error);

    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
}
