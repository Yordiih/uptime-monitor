import mongoose from "mongoose";
import { app } from "./app";
import { config } from "./config";
import { logger } from "./logger";

mongoose
  .connect(config.mongoUri)
  .then(() => logger.info("mongo connected"))
  .catch((err) => logger.error({ err }, "mongo connection error"));

const server = app.listen(config.port, () =>
  logger.info({ port: config.port }, "api listening")
);

// Kubernetes and Docker send SIGTERM before killing the container
function shutdown(signal: string): void {
  logger.info({ signal }, "shutting down");
  setTimeout(() => process.exit(1), 10_000).unref(); // hard stop if something hangs
  server.close(() => {
    void mongoose.disconnect().finally(() => process.exit(0));
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
