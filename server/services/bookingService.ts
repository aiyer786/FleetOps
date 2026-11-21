
import { createHash } from "crypto";
import { pool } from "../db";
import {
  getActiveCustomer,getCustomerById,
  getOperationalStation,
  getActiveCustomerTrucks,
  getStationDayPlanForUpdate,
  getCustomerAllocationForUpdate,
  getAvailableIntervalsForUpdate,
  claimIdempotencyKey,
  completeIdempotencyKey,
  incrementSharedBooked,
  incrementProtectedUsed,
  incrementIntervalReservation,
  insertBooking,
  insertBookingItem,
  insertReservation,
  insertBookingOutboxEvent,
  getBookingById,
  
} from "../repositories/bookingRepository";
import {
  getStationBatteries,
  getScheduledSwaps,
} from "../repositories/batteryForecastRepository";
import { calculateBatteryForecast } from "./batteryForecastService";
import { allocateBookingCapacity } from "./bookingAllocationService";
import { getServiceDate } from "./dateTimeService";

const INTERVAL_MS = 5 * 60 * 1000;
const MAX_WINDOW_MS = 60 * 60 * 1000;

interface CreateBookingInput {
  customerId: number;
  stationId: number;
  truckIds: number[];
  requestedWindowStart: string;
  requestedWindowEnd: string;
  idempotencyKey: string;
}

function bookingError(message: string): Error {
  return new Error(message);
}

function parseBookingDate(value: string): Date {
  // Require an explicit timezone offset or Z.
  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw bookingError("TIMESTAMP_TIMEZONE_REQUIRED");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw bookingError("INVALID_BOOKING_TIMESTAMP");
  }

  return date;
}

function createRequestHash(input: CreateBookingInput): string {
  const canonicalRequest = JSON.stringify({
    customerId: input.customerId,
    stationId: input.stationId,
    truckIds: [...input.truckIds].sort((a, b) => a - b),
    requestedWindowStart: new Date(
      input.requestedWindowStart
    ).toISOString(),
    requestedWindowEnd: new Date(
      input.requestedWindowEnd
    ).toISOString(),
  });

  return createHash("sha256")
    .update(canonicalRequest)
    .digest("hex");
}

const MAX_TRUCKS_PER_REQUEST = 10;

function validateInput(input: unknown): CreateBookingInput {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input)
  ) {
    throw bookingError("INVALID_REQUEST_BODY");
  }

  const body = input as Record<string, unknown>;

  if (
    !Number.isInteger(body.customerId) ||
    Number(body.customerId) <= 0 ||
    !Number.isInteger(body.stationId) ||
    Number(body.stationId) <= 0
  ) {
    throw bookingError("INVALID_CUSTOMER_OR_STATION");
  }

  if (
    !Array.isArray(body.truckIds) ||
    body.truckIds.length === 0 ||
    body.truckIds.some(
      (id) => !Number.isInteger(id) || Number(id) <= 0
    )
  ) {
    throw bookingError("INVALID_TRUCK_IDS");
  }

  if (body.truckIds.length > MAX_TRUCKS_PER_REQUEST) {
    throw bookingError("MAX_TRUCKS_PER_REQUEST_EXCEEDED");
  }

  if (new Set(body.truckIds).size !== body.truckIds.length) {
    throw bookingError("DUPLICATE_TRUCK_IDS");
  }

  if (
    typeof body.idempotencyKey !== "string" ||
    body.idempotencyKey.trim().length === 0 ||
    body.idempotencyKey.length > 200
  ) {
    throw bookingError("INVALID_IDEMPOTENCY_KEY");
  }

  if (
    typeof body.requestedWindowStart !== "string" ||
    typeof body.requestedWindowEnd !== "string"
  ) {
    throw bookingError("INVALID_BOOKING_TIMESTAMP");
  }

  const start = parseBookingDate(body.requestedWindowStart);
  const end = parseBookingDate(body.requestedWindowEnd);

  if (end <= start) {
    throw bookingError("INVALID_BOOKING_WINDOW");
  }

  if (end.getTime() - start.getTime() > MAX_WINDOW_MS) {
    throw bookingError("BOOKING_WINDOW_EXCEEDS_ONE_HOUR");
  }

  if (start.getTime() <= Date.now()) {
    throw bookingError("BOOKING_WINDOW_MUST_BE_IN_FUTURE");
  }

  const serviceDate = getServiceDate(start);
  const endServiceDate = getServiceDate(
    new Date(end.getTime() - 1)
  );

  if (serviceDate !== endServiceDate) {
    throw bookingError("BOOKING_WINDOW_CROSSES_SERVICE_DAY");
  }

  return {
    customerId: body.customerId as number,
    stationId: body.stationId as number,
    truckIds: body.truckIds as number[],
    requestedWindowStart: body.requestedWindowStart,
    requestedWindowEnd: body.requestedWindowEnd,
    idempotencyKey: body.idempotencyKey,
  };
}

export async function createBooking(rawInput: unknown) {
  const input = validateInput(rawInput);

  const start = parseBookingDate(input.requestedWindowStart);
  const end = parseBookingDate(input.requestedWindowEnd);
  const serviceDate = getServiceDate(start);

  const requestHash = createRequestHash(input);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify that the customer exists before claiming an idempotency key.
    // Existing successful bookings can still be replayed if the customer
    // has subsequently been deactivated.
    const customerExists = await getCustomerById(
    client,
    input.customerId
    );

    if (!customerExists) {
    throw bookingError("CUSTOMER_NOT_FOUND");
    }

    // 1. Claim the idempotency key.
    const idempotency = await claimIdempotencyKey(
      client,
      input.customerId,
      input.idempotencyKey,
      requestHash
    );

    if (!idempotency.isNew) {
      if (idempotency.request_hash !== requestHash) {
        throw bookingError("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST");
      }

      if (!idempotency.response_reference) {
        throw bookingError("IDEMPOTENCY_RESPONSE_MISSING");
      }

      const existingBooking = await getBookingById(
        client,
        idempotency.response_reference
      );

      if (!existingBooking) {
        throw bookingError("IDEMPOTENT_BOOKING_NOT_FOUND");
      }

      await client.query("COMMIT");

      return {
        replayed: true,
        booking: existingBooking,
      };
    }

    // 2. Validate customer, station and trucks.
    const customer = await getActiveCustomer(
      client,
      input.customerId
    );

    if (!customer) {
      throw bookingError("CUSTOMER_NOT_FOUND_OR_INACTIVE");
    }

    const station = await getOperationalStation(
      client,
      input.stationId
    );

    if (!station) {
      throw bookingError("STATION_NOT_FOUND_OR_INACTIVE");
    }

    const trucks = await getActiveCustomerTrucks(
      client,
      input.customerId,
      input.truckIds
    );

    if (trucks.length !== input.truckIds.length) {
      throw bookingError("ONE_OR_MORE_TRUCKS_INVALID");
    }

    // 3. Lock the station-day plan first.
    const plan = await getStationDayPlanForUpdate(
      client,
      input.stationId,
      serviceDate
    );

    if (!plan) {
      throw bookingError("STATION_DAY_PLAN_NOT_FOUND");
    }

    // 4. Lock the customer's allocation.
    const allocation = await getCustomerAllocationForUpdate(
      client,
      input.customerId,
      input.stationId,
      serviceDate
    );

    // 5. Decide protected versus shared allocation.
    const allocationResult = allocateBookingCapacity(
      trucks.length,
      plan,
      allocation
    );

    // 6. Lock available five-minute intervals.
    const intervals = await getAvailableIntervalsForUpdate(
      client,
      input.stationId,
      start,
      end
    );

    if (intervals.length === 0) {
      throw bookingError("NO_AVAILABLE_SERVICE_INTERVALS");
    }

    // 7. Load battery inventory and future scheduled swaps.
    // Forecast begins at the next five-minute boundary so that
    // candidate interval timestamps align with the simulation.
    const forecastStart = new Date(
      Math.ceil(Date.now() / INTERVAL_MS) * INTERVAL_MS
    );

    const batteries = await getStationBatteries(
        client,
        input.stationId
    );

        const scheduledSwaps = await getScheduledSwaps(
        client,
        input.stationId,
        forecastStart,
        end
    );

    // 8. Select one interval for each truck.
    // Every proposed swap is tested against the complete
    // rolling battery forecast, including existing reservations.
    const proposedTimes: Date[] = [];
    const assignments: Array<{
      truckId: number;
      interval: (typeof intervals)[number];
      allocationSource: "PROTECTED" | "SHARED";
    }> = [];

    const localIntervalUsage = new Map<number, number>();

    const forecastOptions = {
      chargingCapacity: Number(station.charging_capacity),
    };

    for (let i = 0; i < trucks.length; i++) {
      const truck = trucks[i];
      const allocationSource = allocationResult.sources[i];

      let selectedInterval:
        | (typeof intervals)[number]
        | undefined;

      for (const interval of intervals) {
        const intervalId = Number(interval.id);
        const localUsage = localIntervalUsage.get(intervalId) ?? 0;
        const intervalTime = new Date(interval.interval_start);

        if (
        intervalTime.getTime() < forecastStart.getTime() ||
        intervalTime.getTime() >= end.getTime()
        ) {
        continue;
        }

        if (
          Number(interval.reserved_count) + localUsage >=
          Number(interval.bay_capacity)
        ) {
          continue;
        }

        const candidateTime = new Date(interval.interval_start);
        const candidateTimes = [...proposedTimes, candidateTime];

        const forecast = calculateBatteryForecast(
          batteries,
          scheduledSwaps,
          forecastStart,
          end,
          forecastOptions,
          candidateTimes
        );

        if (forecast.every((point) => point.shortfall === 0)) {
          selectedInterval = interval;
          break;
        }
      }

      if (!selectedInterval) {
        throw bookingError("INSUFFICIENT_BATTERY_OR_SERVICE_CAPACITY");
      }

      const selectedTime = new Date(selectedInterval.interval_start);

      proposedTimes.push(selectedTime);

      const selectedId = Number(selectedInterval.id);

      localIntervalUsage.set(
        selectedId,
        (localIntervalUsage.get(selectedId) ?? 0) + 1
      );

      assignments.push({
        truckId: Number(truck.id),
        interval: selectedInterval,
        allocationSource,
      });
    }

    // 9. Update daily capacity counters.
    await incrementProtectedUsed(
      client,
      allocation?.id,
      allocationResult.protectedCount
    );

    await incrementSharedBooked(
      client,
      plan.id,
      allocationResult.sharedCount
    );

    // 10. Create the booking.
    const booking = await insertBooking(client, {
      customerId: input.customerId,
      stationId: input.stationId,
      requestedWindowStart: start,
      requestedWindowEnd: end,
    });

    // 11. Create each booking item, reservation and interval update.
    const bookingItems = [];

    for (const assignment of assignments) {
      const bookingItem = await insertBookingItem(
        client,
        String(booking.id),
        assignment.truckId
      );

      await incrementIntervalReservation(
        client,
        String(assignment.interval.id)
      );

      const reservation = await insertReservation(
        client,
        String(bookingItem.id),
        String(assignment.interval.id),
        assignment.allocationSource
      );

      bookingItems.push({
        ...bookingItem,
        reservation,
      });
    }

    // 12. Record the event in the transactional outbox.
    await insertBookingOutboxEvent(
      client,
      String(booking.id),
      {
        bookingId: booking.id,
        customerId: input.customerId,
        stationId: input.stationId,
        serviceDate,
        truckCount: trucks.length,
        bookingItems,
      }
    );

    // 13. Associate the idempotency key with this booking.
    await completeIdempotencyKey(
      client,
      idempotency.id,
      String(booking.id)
    );

    const createdBooking = await getBookingById(
    client,
    String(booking.id)
    );

    if (!createdBooking) {
    throw bookingError("CREATED_BOOKING_NOT_FOUND");
    }

    await client.query("COMMIT");

    return {
    replayed: false,
    booking: createdBooking,
    };
    
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
