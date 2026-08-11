import { Router } from "express";

import { pool } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

/** GET /dashboard — aggregate counts, confirmed sales value, low stock, recent activity. */
dashboardRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [customerCount, productCount, confirmedAgg, lowStock, recent] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM customers"),
      pool.query("SELECT COUNT(*)::int AS count FROM products"),
      pool.query(
        "SELECT COUNT(*)::int AS count, COALESCE(SUM(total_amount),0)::float AS value FROM challans WHERE status = 'CONFIRMED'",
      ),
      pool.query(
        `SELECT id, name, sku, current_stock, minimum_stock FROM products
         WHERE current_stock <= minimum_stock ORDER BY current_stock ASC LIMIT 50`,
      ),
      pool.query(
        `SELECT c.id, c.challan_number, c.status, c.total_quantity, c.total_amount, c.created_at,
                cu.name AS customer_name, cu.business_name AS customer_business_name
         FROM challans c JOIN customers cu ON cu.id = c.customer_id
         ORDER BY c.created_at DESC LIMIT 6`,
      ),
    ]);

    res.json({
      customerCount: customerCount.rows[0].count,
      productCount: productCount.rows[0].count,
      confirmedCount: confirmedAgg.rows[0].count,
      confirmedValue: confirmedAgg.rows[0].value,
      lowStock: lowStock.rows,
      recent: recent.rows,
    });
  }),
);
