
import { PoolClient } from "pg";

export interface BatteryForecastRecord {
  id: number;
  station_id: number;
  operational_state: string;
  needs_review: boolean;
  charging_started_at: Date | null;
}

export interface ScheduledSwapRecord {
  interval_start: Date;
  reserved_count: number;
}

// Retrieve the station's battery inventory.
// Locking the rows prevents concurrent booking transactions
// from making decisions using conflicting battery states.
export async function getStationBatteries(
  client: PoolClient,
  stationId: number
): Promise<BatteryForecastRecord[]> {
  const result = await client.query(
    `
      SELECT
        id,
        station_id,
        operational_state,
        needs_review,
        charging_started_at
      FROM batteries
      WHERE station_id = $1
      ORDER BY id
      FOR UPDATE;
    `,
    [stationId]
  );

  return result.rows;
}

// Retrieve already reserved swaps in the requested time window.
// Each reservation represents one truck service.
export async function getScheduledSwaps(
  client: PoolClient,
  stationId: number,
  windowStart: Date,
  windowEnd: Date
): Promise<ScheduledSwapRecord[]> {
  const result = await client.query(
    `
      SELECT
        ci.interval_start,
        COUNT(r.id)::integer AS reserved_count
      FROM capacity_intervals ci
      LEFT JOIN reservations r
        ON r.capacity_interval_id = ci.id
      WHERE ci.station_id = $1
        AND ci.interval_start >= $2
        AND ci.interval_start < $3
      GROUP BY ci.id, ci.interval_start
      ORDER BY ci.interval_start;
    `,
    [stationId, windowStart, windowEnd]
  );

  return result.rows;
}
