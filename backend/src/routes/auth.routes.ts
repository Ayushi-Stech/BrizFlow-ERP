import { randomUUID } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { pool } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { validateBody } from "../middleware/validate";
import { requireAuth, signToken } from "../middleware/auth";

export const authRouter = Router();

const roleEnum = z.enum(["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"]);

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
  role: roleEnum,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(255),
  password: z.string().min(1, "Password is required").max(72),
});

/**
 * POST /auth/register
 * Creates an employee account. Simple JWT auth per the case study spec — anyone
 * can self-register and choose a role, mirroring a small internal tool where
 * an admin would otherwise hand out accounts by hand.
 */
authRouter.post(
  "/register",
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body as z.infer<typeof registerSchema>;

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rowCount) throw AppError.conflict("An account with this email already exists.");

    const passwordHash = await bcrypt.hash(password, 10);
    const id = randomUUID();
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5)`,
      [id, name, email, passwordHash, role],
    );

    const user = { id, name, email, role };
    const token = signToken(user);
    res.status(201).json({ token, user });
  }),
);

/** POST /auth/login */
authRouter.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const result = await pool.query(
      "SELECT id, name, email, password_hash, role FROM users WHERE email = $1",
      [email],
    );
    const row = result.rows[0];
    if (!row) throw AppError.unauthorized("Invalid email or password");

    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) throw AppError.unauthorized("Invalid email or password");

    const user = { id: row.id, name: row.name, email: row.email, role: row.role };
    const token = signToken(user);
    res.json({ token, user });
  }),
);

/** GET /auth/me — returns the currently authenticated user. */
authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  }),
);
