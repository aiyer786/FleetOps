
import { Request, Response } from "express";
import { pool } from "../db";

// GET /api/customers
export async function getAllCustomers(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        status
      FROM customers
      ORDER BY id;
    `);

    res.status(200).json(
      result.rows.map((customer) => ({
        ...customer,
        id: Number(customer.id),
      }))
    );
  } catch (error) {
    console.error("Error fetching customers:", error);

    res.status(500).json({
      message: "Failed to fetch customers",
    });
  }
}

// GET /api/customers/:customerId/trucks
export async function getCustomerTrucks(
  req: Request,
  res: Response
): Promise<void> {
  const customerId = Number(req.params.customerId);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    res.status(400).json({
      message: "Invalid customer ID",
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
        WHERE t.customer_id = $1
        ORDER BY t.id;
      `,
      [customerId]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching customer trucks:", error);

    res.status(500).json({
      message: "Failed to fetch customer trucks",
    });
  }
}
