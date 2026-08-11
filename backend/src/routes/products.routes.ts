import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";

import { pool, withTransaction } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { validateBody } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import { getPagination } from "../utils/pagination";
import { applyStockMovement } from "../services/stock";

export const productsRouter = Router();
productsRouter.use(requireAuth);

const CAN_WRITE: Array<"ADMIN" | "WAREHOUSE"> = ["ADMIN", "WAREHOUSE"];

const productSchema = z.object({
  name: z.string().trim().min(2, "Product name is required").max(120),
  sku: z.string().trim().min(2, "SKU is required").max(40),
  category: z.string().trim().max(60).optional(),
  unit_price: z.coerce.number().min(0, "Price cannot be negative").max(100000000),
  minimum_stock: z.coerce.number().int("Minimum stock must be a whole number").min(0),
  warehouse_location: z.string().trim().max(80).optional(),
  // Only used on create — becomes an initial "IN" stock movement, mirroring
  // the requirement that stock is only ever changed via logged movements.
  current_stock: z.coerce.number().int().min(0).optional(),
});

/** GET /products?search=&page=&pageSize= (or ?options=true for a flat dropdown list) */
productsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (req.query.options === "true") {
      const result = await pool.query(
        "SELECT id, name, sku, unit_price, current_stock, minimum_stock FROM products ORDER BY name",
      );
      return res.json({ rows: result.rows });
    }

    const { page, pageSize, offset } = getPagination(req);
    const search = String(req.query.search ?? "").trim();

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(name ILIKE $${idx} OR sku ILIKE $${idx} OR category ILIKE $${idx})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM products ${where}`, params);
    const rowsResult = await pool.query(
      `SELECT * FROM products ${where} ORDER BY name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset],
    );

    res.json({ rows: rowsResult.rows, count: countResult.rows[0].count, page, pageSize });
  }),
);

/** GET /products/:id */
productsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (!result.rowCount) throw AppError.notFound("Product not found");
    res.json({ product: result.rows[0] });
  }),
);

/** POST /products — Admin or Warehouse only. Opening stock becomes a logged IN movement. */
productsRouter.post(
  "/",
  requireRole(...CAN_WRITE),
  validateBody(productSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof productSchema>;
    const id = randomUUID();

    const product = await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO products (id, name, sku, category, unit_price, current_stock, minimum_stock, warehouse_location, created_by)
         VALUES ($1,$2,$3,$4,$5,0,$6,$7,$8)`,
        [
          id,
          b.name,
          b.sku.toUpperCase(),
          b.category || null,
          b.unit_price,
          b.minimum_stock,
          b.warehouse_location || null,
          req.user!.id,
        ],
      );
      if (b.current_stock && b.current_stock > 0) {
        return applyStockMovement(client, {
          productId: id,
          quantity: b.current_stock,
          movementType: "IN",
          reason: "Opening stock",
          actorId: req.user!.id,
        });
      }
      const result = await client.query("SELECT * FROM products WHERE id = $1", [id]);
      return result.rows[0];
    });

    res.status(201).json({ product });
  }),
);

/** PUT /products/:id — Admin or Warehouse only. Stock itself is never edited directly here. */
productsRouter.put(
  "/:id",
  requireRole(...CAN_WRITE),
  validateBody(productSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof productSchema>;
    const result = await pool.query(
      `UPDATE products SET name=$1, sku=$2, category=$3, unit_price=$4, minimum_stock=$5, warehouse_location=$6
       WHERE id=$7 RETURNING *`,
      [
        b.name,
        b.sku.toUpperCase(),
        b.category || null,
        b.unit_price,
        b.minimum_stock,
        b.warehouse_location || null,
        req.params.id,
      ],
    );
    if (!result.rowCount) throw AppError.notFound("Product not found");
    res.json({ product: result.rows[0] });
  }),
);
