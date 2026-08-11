import { Router } from "express";
import { z } from "zod";

import { pool, withTransaction } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import { getPagination } from "../utils/pagination";
import { applyStockMovement } from "../services/stock";

export const stockMovementsRouter = Router();
stockMovementsRouter.use(requireAuth);

const movementSchema = z.object({
  product_id: z.string().uuid("Select a product"),
  quantity: z.coerce.number().int("Quantity must be a whole number").positive("Quantity must be greater than zero"),
  movement_type: z.enum(["IN", "OUT"]),
  reason: z.string().trim().max(200).optional(),
});

/** GET /stock-movements?productId=&page=&pageSize= — full audit trail, newest first. */
stockMovementsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = getPagination(req, 10);
    const productId = String(req.query.productId ?? "ALL");

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (productId !== "ALL") {
      params.push(productId);
      conditions.push(`m.product_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM stock_movements m ${where}`, params);
    const rowsResult = await pool.query(
      `SELECT m.id, m.quantity, m.movement_type, m.reason, m.created_at, m.created_by,
              u.name AS created_by_name, p.name AS product_name, p.sku AS product_sku
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       LEFT JOIN users u ON u.id = m.created_by
       ${where}
       ORDER BY m.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset],
    );

    res.json({ rows: rowsResult.rows, count: countResult.rows[0].count, page, pageSize });
  }),
);

/** POST /stock-movements — Admin or Warehouse only. Stock can never go negative. */
stockMovementsRouter.post(
  "/",
  requireRole("ADMIN", "WAREHOUSE"),
  validateBody(movementSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof movementSchema>;
    const product = await withTransaction((client) =>
      applyStockMovement(client, {
        productId: b.product_id,
        quantity: b.quantity,
        movementType: b.movement_type,
        reason: b.reason?.trim() || (b.movement_type === "IN" ? "Purchase" : "Manual issue"),
        actorId: req.user!.id,
      }),
    );
    res.status(201).json({ product });
  }),
);
