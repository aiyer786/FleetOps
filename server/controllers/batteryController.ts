
import { Request, Response } from "express";
import { pool } from "../db";

// GET /api/batteries
export async function getAllBatteries(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT
        b.id,
        b.station_id AS "stationId",
        s.name AS "stationName",
        b.operational_state AS "operationalState",
        b.needs_review AS "needsReview",
        b.installed_truck_id AS "installedTruckId",
        t.registration_number AS "truckRegistration"
      FROM batteries b
      JOIN stations s
        ON s.id = b.station_id
      LEFT JOIN trucks t
        ON t.id = b.installed_truck_id
      ORDER BY s.id, b.id;
    `);

    res.status(200).json(
      result.rows.map((battery) => ({
        ...battery,
        id: Number(battery.id),
        stationId: Number(battery.stationId),
        installedTruckId:
          battery.installedTruckId === null
            ? null
            : Number(battery.installedTruckId),
      }))
    );
  } catch (error) {
    console.error("Error fetching batteries:", error);

    res.status(500).json({
      message: "Failed to fetch batteries",
    });
  }
}
