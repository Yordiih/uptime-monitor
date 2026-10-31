import express from "express";
import mongoose from "mongoose";
import client from "prom-client";

const app = express();
app.use(express.json());
client.collectDefaultMetrics();

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

const port = Number(process.env.PORT ?? 4000);
const mongoUri = process.env.MONGO_URI ?? "mongodb://localhost:27017/uptime";

mongoose
  .connect(mongoUri)
  .then(() => console.log("mongo connected"))
  .catch((err) => console.error("mongo connection error", err));

app.listen(port, () => console.log(`api listening on ${port}`));
