import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../env";
import { AppError } from "../utils/AppError";
import type { AuthUser, Role } from "../types";

type JwtPayload = AuthUser & { iat: number; exp: number };

/** Verifies the Bearer JWT and attaches the decoded user to req.user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(AppError.unauthorized("Missing or malformed Authorization header"));
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
    req.user = { id: payload.id, name: payload.name, email: payload.email, role: payload.role };
    next();
  } catch {
    next(AppError.unauthorized("Invalid or expired token"));
  }
}

/** Restricts a route to one or more roles. Call after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden(`This action requires one of: ${roles.join(", ")}`));
    }
    next();
  };
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"] });
}
