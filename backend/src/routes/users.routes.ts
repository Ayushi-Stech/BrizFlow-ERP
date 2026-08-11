import { Router } from "express";

import { pool } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";

export const usersRouter = Router();
usersRouter.use(requireAuth);

/** GET /users — team directory with roles. Admin only. */
usersRouter.get(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      "SELECT id, name, email, role, created_at FROM users ORDER BY created_at",
    );
    res.json({ rows: result.rows });
  }),
);
