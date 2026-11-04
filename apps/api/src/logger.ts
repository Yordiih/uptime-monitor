import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // never write credentials into logs
  redact: ["req.headers.authorization", "req.headers.cookie"],
});
