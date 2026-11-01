import express from "express";
import mongoose from "mongoose";
import client from "prom-client";
import { errorHandler } from "./middleware/error";
import { authRouter } from "./routes/auth";
import { monitorsRouter } from "./routes/monitors";

client.collectDefaultMetrics();

export const app = express();
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

app.use("/api/auth", authRouter);
app.use("/api/monitors", monitorsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});
app.use(errorHandler);
