
import { PoolClient } from "pg";

// Verify that the customer exists and is active
export async function getActiveCustomer(
  client: PoolClient,
  customerId: number
) {
  const result = await client.query(
    `
      SELECT id, name, status
      FROM customers
      WHERE id = $1
        AND status = 'ACTIVE';
    `,
    [customerId]
  );

  return result.rows[0] ?? null;
}

// Verify that a customer exists, regardless of active status.
// This allows previously successful idempotent requests to be replayed
// even if the customer has subsequently been deactivated.
export async function getCustomerById(
  client: PoolClient,
  customerId: number
) {
  const result = await client.query(
    `
      SELECT id, name, status
      FROM customers
      WHERE id = $1;
    `,
    [customerId]
  );

  return result.rows[0] ?? null;
}

// Verify that the station exists and is operational
export async function getOperationalStation(
  client: PoolClient,
  stationId: number
) {
  const result = await client.query(
    `
      SELECT id, name, bay_count, charging_capacity
      FROM stations
      WHERE id = $1
        AND status = 'Operational';
    `,
    [stationId]
  );

  return result.rows[0] ?? null;
}

// Verify that all requested trucks belong to the customer
// and are active
export async function getActiveCustomerTrucks(
  client: PoolClient,
  customerId: number,
  truckIds: number[]
) {
  const result = await client.query(
    `
      SELECT id, customer_id, registration_number, status
      FROM trucks
      WHERE customer_id = $1
        AND id = ANY($2::bigint[])
        AND status = 'ACTIVE'
      ORDER BY id;
    `,
    [customerId, truckIds]
  );

  return result.rows;
}


// Lock the station-day plan.
// This is the primary concurrency guard for station bookings.
export async function getStationDayPlanForUpdate(
  client: PoolClient,
  stationId: number,
  serviceDate: string
) {
  const result = await client.query(
    `
      SELECT
        id,
        station_id,
        service_date,
        forecast_daily_capacity,
        protected_total,
        released_to_shared,
        shared_booked,
        forecast_version
      FROM station_day_plans
      WHERE station_id = $1
        AND service_date = $2
      FOR UPDATE;
    `,
    [stationId, serviceDate]
  );

  return result.rows[0] ?? null;
}

// Lock the customer's protected allocation for this station-day.
export async function getCustomerAllocationForUpdate(
  client: PoolClient,
  customerId: number,
  stationId: number,
  serviceDate: string
) {
  const result = await client.query(
    `
      SELECT
        id,
        customer_id,
        station_id,
        service_date,
        protected_units,
        protected_used_units,
        released_units
      FROM customer_allocations
      WHERE customer_id = $1
        AND station_id = $2
        AND service_date = $3
      FOR UPDATE;
    `,
    [customerId, stationId, serviceDate]
  );

  return result.rows[0] ?? null;
}

// Lock feasible five-minute intervals within the requested window.
export async function getAvailableIntervalsForUpdate(
  client: PoolClient,
  stationId: number,
  windowStart: Date,
  windowEnd: Date
) {
  const result = await client.query(
    `
      SELECT
        id,
        station_id,
        interval_start,
        bay_capacity,
        reserved_count
      FROM capacity_intervals
      WHERE station_id = $1
        AND interval_start >= $2
        AND interval_start < $3
        AND reserved_count < bay_capacity
      ORDER BY interval_start, id
      FOR UPDATE;
    `,
    [stationId, windowStart, windowEnd]
  );

  return result.rows;
}

export interface IdempotencyRecord {
  id: string;
  request_hash: string;
  response_reference: string | null;
  isNew: boolean;
}

// Claim an idempotency key.
// A concurrent request using the same key waits for the first
// transaction to finish before reading the existing record.
export async function claimIdempotencyKey(
  client: PoolClient,
  customerId: number,
  idempotencyKey: string,
  requestHash: string
): Promise<IdempotencyRecord> {
  const inserted = await client.query(
    `
      INSERT INTO idempotency_keys (
        customer_id,
        idempotency_key,
        request_hash
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (customer_id, idempotency_key)
      DO NOTHING
      RETURNING id, request_hash, response_reference;
    `,
    [customerId, idempotencyKey, requestHash]
  );

  if (inserted.rows.length > 0) {
    return {
      ...inserted.rows[0],
      isNew: true,
    };
  }

  const existing = await client.query(
    `
      SELECT id, request_hash, response_reference
      FROM idempotency_keys
      WHERE customer_id = $1
        AND idempotency_key = $2
      FOR UPDATE;
    `,
    [customerId, idempotencyKey]
  );

  if (existing.rows.length === 0) {
    throw new Error("IDEMPOTENCY_RECORD_NOT_FOUND");
  }

  return {
    ...existing.rows[0],
    isNew: false,
  };
}

export async function completeIdempotencyKey(
  client: PoolClient,
  idempotencyId: string,
  bookingId: string
) {
  const result = await client.query(
    `
      UPDATE idempotency_keys
      SET response_reference = $2
      WHERE id = $1
        AND response_reference IS NULL
      RETURNING id;
    `,
    [idempotencyId, bookingId]
  );

  if (result.rowCount !== 1) {
    throw new Error("IDEMPOTENCY_COMPLETION_FAILED");
  }
}

// Increment the station's shared capacity usage.
export async function incrementSharedBooked(
  client: PoolClient,
  stationDayPlanId: string,
  sharedCount: number
) {
  if (sharedCount === 0) return;

  const result = await client.query(
    `
      UPDATE station_day_plans
      SET
        shared_booked = shared_booked + $2,
        updated_at = NOW()
      WHERE id = $1
        AND shared_booked + $2 <=
          forecast_daily_capacity
          - protected_total
          + released_to_shared
      RETURNING id;
    `,
    [stationDayPlanId, sharedCount]
  );

  if (result.rowCount !== 1) {
    throw new Error("INSUFFICIENT_SHARED_CAPACITY");
  }
}

// Increment the customer's protected capacity usage.
export async function incrementProtectedUsed(
  client: PoolClient,
  allocationId: string,
  protectedCount: number
) {
  if (protectedCount === 0) return;

  const result = await client.query(
    `
      UPDATE customer_allocations
      SET
        protected_used_units = protected_used_units + $2,
        updated_at = NOW()
      WHERE id = $1
        AND protected_used_units + released_units + $2
            <= protected_units
      RETURNING id;
    `,
    [allocationId, protectedCount]
  );

  if (result.rowCount !== 1) {
    throw new Error("INSUFFICIENT_PROTECTED_CAPACITY");
  }
}

// Reserve one service place in a five-minute interval.
export async function incrementIntervalReservation(
  client: PoolClient,
  intervalId: string
) {
  const result = await client.query(
    `
      UPDATE capacity_intervals
      SET
        reserved_count = reserved_count + 1,
        updated_at = NOW()
      WHERE id = $1
        AND reserved_count < bay_capacity
      RETURNING id;
    `,
    [intervalId]
  );

  if (result.rowCount !== 1) {
    throw new Error("INTERVAL_CAPACITY_EXHAUSTED");
  }
}

interface CreateBookingInput {
  customerId: number;
  stationId: number;
  requestedWindowStart: Date;
  requestedWindowEnd: Date;
}

// Create the parent booking record.
export async function insertBooking(
  client: PoolClient,
  input: CreateBookingInput
) {
  const result = await client.query(
    `
      INSERT INTO bookings (
        customer_id,
        station_id,
        requested_window_start,
        requested_window_end,
        status
      )
      VALUES ($1, $2, $3, $4, 'CONFIRMED')
      RETURNING id, customer_id, station_id, status, created_at;
    `,
    [
      input.customerId,
      input.stationId,
      input.requestedWindowStart,
      input.requestedWindowEnd,
    ]
  );

  return result.rows[0];
}

// Create one booking item for each truck.
export async function insertBookingItem(
  client: PoolClient,
  bookingId: string,
  truckId: number
) {
  const result = await client.query(
    `
      INSERT INTO booking_items (
        booking_id,
        truck_id,
        status
      )
      VALUES ($1, $2, 'BOOKED')
      RETURNING id, booking_id, truck_id, status;
    `,
    [bookingId, truckId]
  );

  return result.rows[0];
}

// Assign one five-minute interval and allocation source
// to a booking item.
export async function insertReservation(
  client: PoolClient,
  bookingItemId: string,
  intervalId: string,
  allocationSource: "PROTECTED" | "SHARED"
) {
  const result = await client.query(
    `
      INSERT INTO reservations (
        booking_item_id,
        capacity_interval_id,
        allocation_source
      )
      VALUES ($1, $2, $3)
      RETURNING id, booking_item_id, capacity_interval_id,
                allocation_source;
    `,
    [bookingItemId, intervalId, allocationSource]
  );

  return result.rows[0];
}

// Record the booking event in the transactional outbox.
export async function insertBookingOutboxEvent(
  client: PoolClient,
  bookingId: string,
  payload: Record<string, unknown>
) {
  const result = await client.query(
    `
      INSERT INTO outbox_events (
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        status
      )
      VALUES (
        'BOOKING',
        $1,
        'BOOKING_CONFIRMED',
        $2::jsonb,
        'PENDING'
      )
      RETURNING id, aggregate_type, aggregate_id, event_type, status;
    `,
    [bookingId, JSON.stringify(payload)]
  );

  return result.rows[0];
}

export async function getBookingById(
  client: PoolClient,
  bookingId: string
) {
  const result = await client.query(
    `
      SELECT
        b.id,
        b.customer_id,
        b.station_id,
        b.requested_window_start,
        b.requested_window_end,
        b.status,
        b.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'bookingItemId', bi.id,
              'truckId', bi.truck_id,
              'registrationNumber', t.registration_number,
              'reservationId', r.id,
              'intervalId', r.capacity_interval_id,
              'allocationSource', r.allocation_source,
              'intervalStart',
                to_char(
                    ci.interval_start AT TIME ZONE 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                )
            )
            ORDER BY ci.interval_start
          ) FILTER (WHERE bi.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM bookings b
      LEFT JOIN booking_items bi
        ON bi.booking_id = b.id
      LEFT JOIN trucks t
        ON t.id = bi.truck_id
      LEFT JOIN reservations r
        ON r.booking_item_id = bi.id
      LEFT JOIN capacity_intervals ci
        ON ci.id = r.capacity_interval_id
      WHERE b.id = $1
      GROUP BY b.id;
    `,
    [bookingId]
  );

  return result.rows[0] ?? null;
}

