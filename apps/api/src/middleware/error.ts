import type { ErrorRequestHandler } from "express";
import { logger } from "../logger";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status =
    typeof err?.status === "number" && err.status >= 400 && err.status < 500
      ? err.status
      : 500;
  if (status === 500) {
    logger.error({ err }, "unhandled error");
  }
  res
    .status(status)
    .json({ error: status === 500 ? "internal_error" : "bad_request" });
};
