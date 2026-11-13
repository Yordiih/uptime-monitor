import http from "node:http";
import mongoose from "mongoose";
import client from "prom-client";
import { config } from "./config";
import { log } from "./log";
import { lastTick } from "./metrics";
import { tick } from "./scheduler";
import { drainNotifications } from "./notify";

let lastTickAt = Date.now();
let currentTick: Promise<void> = Promise.resolve();
let running = false;

function runTick(): void {
  if (running) return; // never overlap ticks
  running = true;
  currentTick = tick()
    .then(() => {
      lastTickAt = Date.now();
      lastTick.setToCurrentTime();
    })
    .catch((err) => log("error", "tick failed", { error: String(err) }))
    .finally(() => {
      running = false;
    });
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (req.url === "/readyz") {
    const dbReady = mongoose.connection.readyState === 1;
    const ticking = Date.now() - lastTickAt < config.tickMs * 4;
    const ready = dbReady && ticking;
    res.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
    res.end(JSON.stringify({ ready, dbReady, ticking }));
    return;
  }
  if (req.url === "/metrics") {
    res.writeHead(200, { "content-type": client.register.contentType });
    res.end(await client.register.metrics());
    return;
  }
  res.writeHead(404);
  res.end();
});

async function main(): Promise<void> {
  await mongoose.connect(config.mongoUri);
  log("info", "mongo connected");

  server.listen(config.port, () => log("info", "worker listening", { port: config.port }));

  runTick();
  const timer = setInterval(runTick, config.tickMs);

  async function shutdown(signal: string): Promise<void> {
    log("info", "shutting down", { signal });
    setTimeout(() => process.exit(1), 20_000).unref(); // hard stop if something hangs
    clearInterval(timer);
    server.close();
    await currentTick; // let in-flight checks finish
    await drainNotifications(); // let in-flight notifications finish
    await mongoose.disconnect();
    process.exit(0);
  }
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  log("error", "worker failed to start", { error: String(err) });
  process.exit(1);
});
