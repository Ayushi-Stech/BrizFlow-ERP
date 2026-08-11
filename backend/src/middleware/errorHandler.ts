import type { NextFunction, Request, Response } from "express";

import { env } from "../env";
import { AppError } from "../utils/AppError";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `No route: ${req.method} ${req.path}` });
}

// Postgres unique_violation / check_violation codes we translate into clean 4xx errors.
const PG_UNIQUE_VIOLATION = "23505";
const PG_CHECK_VIOLATION = "23514";
const PG_FOREIGN_KEY_VIOLATION = "23503";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  const pgErr = err as { code?: string; detail?: string; constraint?: string };
  if (pgErr?.code === PG_UNIQUE_VIOLATION) {
    return res.status(409).json({ error: "A record with these details already exists." });
  }
  if (pgErr?.code === PG_CHECK_VIOLATION) {
    return res.status(400).json({ error: "One of the values provided is invalid." });
  }
  if (pgErr?.code === PG_FOREIGN_KEY_VIOLATION) {
    return res.status(400).json({ error: "This references a record that does not exist." });
  }

  console.error(err);
  res.status(500).json({
    error: "Something went wrong on the server.",
    ...(env.nodeEnv !== "production" && err instanceof Error ? { detail: err.message } : {}),
  });
}
