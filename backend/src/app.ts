import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { env } from "./env";
import { authRouter } from "./routes/auth.routes";
import { usersRouter } from "./routes/users.routes";
import { customersRouter } from "./routes/customers.routes";
import { productsRouter } from "./routes/products.routes";
import { stockMovementsRouter } from "./routes/stockMovements.routes";
import { challansRouter } from "./routes/challans.routes";
import { dashboardRouter } from "./routes/dashboard.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

  // Basic brute-force protection on auth endpoints.
  app.use(
    "/auth/login",
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }),
  );

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/auth", authRouter);
  app.use("/users", usersRouter);
  app.use("/customers", customersRouter);
  app.use("/products", productsRouter);
  app.use("/stock-movements", stockMovementsRouter);
  app.use("/challans", challansRouter);
  app.use("/dashboard", dashboardRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
