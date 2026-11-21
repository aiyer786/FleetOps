
import { Request, Response } from "express";
import { pool } from "../db";

// Common station query with live battery counts
const stationSelect = `
  SELECT
    s.id,
    s.name,
    s.location,
    s.bay_count AS bays,

    (
      SELECT COUNT(*)::int
      FROM batteries b
      WHERE b.station_id = s.id
        AND b.operational_state = 'AVAILABLE'
    ) AS "chargedBatteries",

    (
      SELECT COUNT(*)::int
      FROM batteries b
      WHERE b.station_id = s.id
        AND b.operational_state = 'CHARGING'
    ) AS "chargingBatteries",

    s.active_swaps AS "activeSwaps",
    s.status

  FROM stations s
`;

// GET /api/stations
export async function getAllStations(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const result = await pool.query(
      `${stationSelect} ORDER BY s.id`
    );

    const stations = result.rows.map((station) => ({
      ...station,
      id: Number(station.id),
    }));

    res.status(200).json(stations);
  } catch (error) {
    console.error("Error fetching stations:", error);

    res.status(500).json({
      message: "Failed to fetch stations",
    });
  }
}

// GET /api/stations/:id
export async function getStationById(
  req: Request,
  res: Response
): Promise<void> {
  const stationId = Number(req.params.id);

  if (!Number.isInteger(stationId) || stationId <= 0) {
    res.status(400).json({
      message: "Invalid station ID",
    });
    return;
  }

  try {
    const result = await pool.query(
      `${stationSelect} WHERE s.id = $1`,
      [stationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        message: "Station not found",
      });
      return;
    }

    const station = {
      ...result.rows[0],
      id: Number(result.rows[0].id),
    };

    res.status(200).json(station);
  } catch (error) {
    console.error("Error fetching station:", error);

    res.status(500).json({
      message: "Failed to fetch station",
    });
  }
}
