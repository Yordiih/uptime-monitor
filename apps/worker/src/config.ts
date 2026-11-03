export const config = {
  port: Number(process.env.WORKER_PORT ?? 4100),
  mongoUri: process.env.MONGO_URI ?? "mongodb://localhost:27017/uptime",
  tickMs: Number(process.env.TICK_INTERVAL_MS ?? 15_000),
};
