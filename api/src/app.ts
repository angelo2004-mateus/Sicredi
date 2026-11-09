import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { env } from "./config/env.js";
import { db } from "./config/database.js";
import { router } from "./routes/index.js";
import { originGuard } from "./middlewares/auth.js";
import { errorHandler } from "./middlewares/errors.js";
import { AppError } from "./errors/app-error.js";
import { logger } from "./utils/logger.js";

export const app = express();

app.disable("x-powered-by");

app.use((req, res, next) => {
  req.request_id = randomUUID();
  res.setHeader("x-request-id", req.request_id);

  const started = Date.now();

  res.on("finish", () =>
    logger.info(
      {
        request_id: req.request_id,
        method: req.method,
        status: res.statusCode,
        duration_ms: Date.now() - started,
      },
      "request_completed",
    ),
  );

  next();
});

app.use(helmet());
app.use(cors({ origin: env.APP_ORIGIN, credentials: true }));
app.use(originGuard);
app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());

app.get("/health/live", (_req, res) => res.json({ status: "ok" }));

app.get("/health/ready", async (_req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

app.use(
  "/api/v1",
  (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  },
  router,
);

app.use((_req, _res) => {
  throw new AppError(404, "NOT_FOUND", "Rota não encontrada.");
});

app.use(errorHandler);
