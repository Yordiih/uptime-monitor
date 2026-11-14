// Dev tool: fills a PAUSED demo monitor with 7 days of synthetic checks.
// Usage: npm exec -w apps/api -- tsx --env-file=../../.env scripts/seed-checks.ts <monitorId>
import mongoose from "mongoose";
import { CheckResult } from "../src/models/CheckResult";
import { Monitor } from "../src/models/Monitor";

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("refusing to seed data in production");
  }
  const id = process.argv[2];
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new Error("usage: seed-checks.ts <monitorId>");
  }
  await mongoose.connect(process.env.MONGO_URI ?? "mongodb://localhost:27017/uptime");

  const monitor = await Monitor.findById(id);
  if (!monitor) throw new Error("monitor not found");
  if (!monitor.paused) {
    throw new Error("pause the monitor first, so real checks are not mixed into the demo data");
  }

  const now = Date.now();
  const stepMs = 5 * 60 * 1000;
  const docs = [];
  for (let t = now - 7 * 24 * 3_600_000; t <= now; t += stepMs) {
    const hoursAgo = (now - t) / 3_600_000;
    const outage = (hoursAgo > 30 && hoursAgo < 30.5) || (hoursAgo > 100 && hoursAgo < 101.5);
    const responseTimeMs = Math.round(120 + 40 * Math.sin(t / 3_600_000) + Math.random() * 60);
    docs.push(
      outage
        ? {
            monitor: id,
            checkedAt: new Date(t),
            up: false,
            statusCode: 503,
            responseTimeMs,
            error: "unexpected status 503 (seeded)",
          }
        : { monitor: id, checkedAt: new Date(t), up: true, statusCode: 200, responseTimeMs }
    );
  }
  await CheckResult.insertMany(docs);
  console.log(`inserted ${docs.length} synthetic checks`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
