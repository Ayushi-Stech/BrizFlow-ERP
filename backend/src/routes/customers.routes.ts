import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";

import { pool } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { validateBody } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import { getPagination } from "../utils/pagination";

export const customersRouter = Router();
customersRouter.use(requireAuth);

const customerSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  mobile: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,15}$/, "Enter a valid mobile number"),
  email: z.string().trim().email("Enter a valid email").max(255).or(z.literal("")).optional(),
  business_name: z.string().trim().max(120).optional(),
  gst_number: z.string().trim().max(20).optional(),
  customer_type: z.enum(["RETAIL", "WHOLESALE", "DISTRIBUTOR"]),
  address: z.string().trim().max(300).optional(),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]),
  follow_up_date: z.string().trim().max(20).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional(),
});

const followupSchema = z.object({
  note: z.string().trim().min(1, "Note cannot be empty").max(1000),
});

const CAN_WRITE: Array<"ADMIN" | "SALES"> = ["ADMIN", "SALES"];

/**
 * GET /customers?search=&status=&type=&page=&pageSize=
 * Search across name/business/mobile/email, filter by status/type, paginated.
 */
customersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = getPagination(req);
    const search = String(req.query.search ?? "").trim();
    const status = String(req.query.status ?? "ALL");
    const type = String(req.query.type ?? "ALL");
    // "options" mode returns a lightweight list for dropdowns (challan creation),
    // excluding inactive customers, with no pagination.
    const optionsOnly = req.query.options === "true";

    if (optionsOnly) {
      const result = await pool.query(
        `SELECT id, name, business_name FROM customers WHERE status <> 'INACTIVE' ORDER BY name`,
      );
      return res.json({ rows: result.rows });
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(
        `(name ILIKE $${idx} OR business_name ILIKE $${idx} OR mobile ILIKE $${idx} OR email ILIKE $${idx})`,
      );
    }
    if (status !== "ALL") {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (type !== "ALL") {
      params.push(type);
      conditions.push(`customer_type = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM customers ${where}`, params);
    const rowsResult = await pool.query(
      `SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset],
    );

    res.json({ rows: rowsResult.rows, count: countResult.rows[0].count, page, pageSize });
  }),
);

/** GET /customers/:id */
customersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await pool.query("SELECT * FROM customers WHERE id = $1", [req.params.id]);
    if (!result.rowCount) throw AppError.notFound("Customer not found");
    res.json({ customer: result.rows[0] });
  }),
);

/** POST /customers — Admin or Sales only. */
customersRouter.post(
  "/",
  requireRole(...CAN_WRITE),
  validateBody(customerSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof customerSchema>;
    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO customers
        (id, name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        id,
        b.name,
        b.mobile,
        b.email || null,
        b.business_name || null,
        b.gst_number || null,
        b.customer_type,
        b.address || null,
        b.status,
        b.follow_up_date || null,
        b.notes || null,
        req.user!.id,
      ],
    );
    res.status(201).json({ customer: result.rows[0] });
  }),
);

/** PUT /customers/:id — Admin or Sales only. */
customersRouter.put(
  "/:id",
  requireRole(...CAN_WRITE),
  validateBody(customerSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof customerSchema>;
    const result = await pool.query(
      `UPDATE customers SET
        name=$1, mobile=$2, email=$3, business_name=$4, gst_number=$5, customer_type=$6,
        address=$7, status=$8, follow_up_date=$9, notes=$10
       WHERE id=$11 RETURNING *`,
      [
        b.name,
        b.mobile,
        b.email || null,
        b.business_name || null,
        b.gst_number || null,
        b.customer_type,
        b.address || null,
        b.status,
        b.follow_up_date || null,
        b.notes || null,
        req.params.id,
      ],
    );
    if (!result.rowCount) throw AppError.notFound("Customer not found");
    res.json({ customer: result.rows[0] });
  }),
);

/** GET /customers/:id/followups */
customersRouter.get(
  "/:id/followups",
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT f.id, f.note, f.created_at, f.created_by, u.name AS created_by_name
       FROM customer_followups f
       LEFT JOIN users u ON u.id = f.created_by
       WHERE f.customer_id = $1
       ORDER BY f.created_at DESC`,
      [req.params.id],
    );
    res.json({ rows: result.rows });
  }),
);

/** POST /customers/:id/followups — Admin or Sales only. */
customersRouter.post(
  "/:id/followups",
  requireRole(...CAN_WRITE),
  validateBody(followupSchema),
  asyncHandler(async (req, res) => {
    const customer = await pool.query("SELECT id FROM customers WHERE id = $1", [req.params.id]);
    if (!customer.rowCount) throw AppError.notFound("Customer not found");

    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO customer_followups (id, customer_id, note, created_by)
       VALUES ($1,$2,$3,$4) RETURNING id, note, created_at, created_by`,
      [id, req.params.id, (req.body as z.infer<typeof followupSchema>).note, req.user!.id],
    );
    res.status(201).json({ followup: { ...result.rows[0], created_by_name: req.user!.name } });
  }),
);
