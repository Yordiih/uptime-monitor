import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import mongoose from "mongoose";
import pinoHttp from "pino-http";
import client from "prom-client";
import { config } from "./config";
import { logger } from "./logger";
import { errorHandler } from "./middleware/error";
import { authRouter } from "./routes/auth";
import { monitorsRouter } from "./routes/monitors";
import { monitorStatsRouter } from "./routes/monitorStats";
import { notificationsRouter } from "./routes/notifications";
import { incidentsRouter } from "./routes/incidents";

client.collectDefaultMetrics();

export const app = express();
app.disable("x-powered-by");
if (config.trustProxy > 0) {
  app.set("trust proxy", config.trustProxy);
}

// probes and scrapes would drown the real traffic in the logs
const quietPaths = ["/healthz", "/readyz", "/metrics"];
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => quietPaths.includes(req.url ?? "") },
  })
);
app.use(helmet());
app.use(express.json({ limit: "100kb" }));

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/readyz", (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ready });
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

// slows down password guessing and account spam, per client IP
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.authRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use("/api/auth", authRouter);
app.use("/api/monitors", monitorsRouter);
app.use("/api/monitors", monitorStatsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/incidents", incidentsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});
app.use(errorHandler);
