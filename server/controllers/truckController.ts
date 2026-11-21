
import { Request, Response } from "express";
import { pool } from "../db";

// GET /api/trucks/:id
export async function getTruckById(
  req: Request,
  res: Response
): Promise<void> {
  const truckId = Number(req.params.id);

  if (!Number.isInteger(truckId) || truckId <= 0) {
    res.status(400).json({
      message: "Invalid truck ID",
    });
    return;
  }

  try {
    const result = await pool.query(
      `
        SELECT
          t.id,
          t.customer_id AS "customerId",
          c.name AS "customerName",
          t.registration_number AS "registrationNumber",
          t.status,
          t.created_at AS "createdAt"
        FROM trucks t
        JOIN customers c ON c.id = t.customer_id
        WHERE t.id = $1;
      `,
      [truckId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        message: "Truck not found",
      });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching truck:", error);

    res.status(500).json({
      message: "Failed to fetch truck",
    });
  }
}
