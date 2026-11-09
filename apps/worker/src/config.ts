export const config = {
  port: Number(process.env.WORKER_PORT ?? 4100),
  mongoUri: process.env.MONGO_URI ?? "mongodb://localhost:27017/uptime",
  tickMs: Number(process.env.TICK_INTERVAL_MS ?? 15_000),
  // consecutive failed checks before a monitor counts as down
  failureThreshold: Math.max(1, Number(process.env.FAILURE_THRESHOLD ?? 2)),
};
