import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

import { AppError } from "../utils/AppError";

/** Validates req.body against a zod schema and replaces it with the parsed value. */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.issues[0];
      return next(
        AppError.badRequest(first?.message ?? "Invalid request body", result.error.flatten()),
      );
    }
    req.body = result.data;
    next();
  };
}
