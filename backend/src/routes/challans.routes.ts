import { Router } from "express";
import { z } from "zod";

import { pool, withTransaction } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { validateBody } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import { getPagination } from "../utils/pagination";
import { createChallan, confirmChallanById } from "../services/challans";

export const challansRouter = Router();
challansRouter.use(requireAuth);

const CAN_WRITE: Array<"ADMIN" | "SALES"> = ["ADMIN", "SALES"];

const createSchema = z.object({
  customer_id: z.string().uuid("Select a customer"),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
      }),
    )
    .min(1, "Add at least one product line"),
  confirm: z.boolean().optional().default(false),
});

/** GET /challans?search=&status=&page=&pageSize= */
challansRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = getPagination(req, 10);
    const search = String(req.query.search ?? "").trim();
    const status = String(req.query.status ?? "ALL");

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`c.challan_number ILIKE $${params.length}`);
    }
    if (status !== "ALL") {
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM challans c ${where}`, params);
    const rowsResult = await pool.query(
      `SELECT c.id, c.challan_number, c.status, c.total_quantity, c.total_amount, c.created_at, c.confirmed_at,
              cu.name AS customer_name, cu.business_name AS customer_business_name
       FROM challans c
       JOIN customers cu ON cu.id = c.customer_id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset],
    );

    res.json({ rows: rowsResult.rows, count: countResult.rows[0].count, page, pageSize });
  }),
);

/** GET /challans/:id — full detail including items and customer info. */
challansRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const challanResult = await pool.query(
      `SELECT c.*, cu.name AS customer_name, cu.business_name AS customer_business_name,
              cu.mobile AS customer_mobile, cu.gst_number AS customer_gst_number
       FROM challans c JOIN customers cu ON cu.id = c.customer_id
       WHERE c.id = $1`,
      [req.params.id],
    );
    if (!challanResult.rowCount) throw AppError.notFound("Challan not found");

    const itemsResult = await pool.query(
      "SELECT id, product_name, sku, unit_price, quantity FROM challan_items WHERE challan_id = $1",
      [req.params.id],
    );

    res.json({ challan: { ...challanResult.rows[0], items: itemsResult.rows } });
  }),
);

/**
 * POST /challans — Admin or Sales only.
 * Business rules: stock is untouched while DRAFT; each line snapshots product
 * name/SKU/price at creation time; passing confirm:true atomically validates
 * and reduces stock (rejecting the whole request if any line is short).
 */
challansRouter.post(
  "/",
  requireRole(...CAN_WRITE),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof createSchema>;
    const challan = await withTransaction((client) =>
      createChallan(client, {
        customerId: b.customer_id,
        items: b.items,
        notes: b.notes?.trim() || null,
        actorId: req.user!.id,
        confirm: b.confirm,
      }),
    );
    res.status(201).json({ challan });
  }),
);

/** POST /challans/:id/confirm — Admin or Sales only. */
challansRouter.post(
  "/:id/confirm",
  requireRole(...CAN_WRITE),
  asyncHandler(async (req, res) => {
    const challan = await withTransaction((client) =>
      confirmChallanById(client, req.params.id, req.user!.id),
    );
    res.json({ challan });
  }),
);
