import type { Response } from "express";
import { Router } from "express";
import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { CheckResult } from "../models/CheckResult";
import { Incident } from "../models/Incident";
import { Monitor } from "../models/Monitor";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

const RANGES = {
  "24h": { ms: 24 * HOUR, bucketMs: 30 * MIN },
  "7d": { ms: 7 * 24 * HOUR, bucketMs: 2 * HOUR },
  "30d": { ms: 30 * 24 * HOUR, bucketMs: 8 * HOUR },
} as const;

const statsQuery = z.object({ range: z.enum(["24h", "7d", "30d"]).default("24h") });
const checksQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });

interface SummaryRow {
  checks: number;
  up: number;
  avgMs: number | null;
  maxMs: number | null;
}

interface BucketRow {
  _id: number;
  checks: number;
  up: number;
  avgMs: number | null;
}

// Aggregation pipelines are plain data: typing every stage adds noise, not safety.
type Pipeline = any[];

function badRequest(res: Response, error: z.ZodError): void {
  res.status(400).json({
    error: "validation_error",
    details: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

export const monitorStatsRouter = Router();
monitorStatsRouter.use(requireAuth);

monitorStatsRouter.param("id", (_req, res, next, id) => {
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  next();
});

monitorStatsRouter.get("/:id/stats", async (req, res) => {
  const parsed = statsQuery.safeParse(req.query);
  if (!parsed.success) {
    badRequest(res, parsed.error);
    return;
  }
  const owned = await Monitor.exists({ _id: req.params.id, owner: req.userId });
  if (!owned) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const { range } = parsed.data;
  const { ms, bucketMs } = RANGES[range];
  const to = Date.now();
  const from = to - ms;
  const fromDate = new Date(from);
  const monitorId = new Types.ObjectId(req.params.id);
  const match = { monitor: monitorId, checkedAt: { $gte: fromDate, $lte: new Date(to) } };

  // response times of failed checks (timeouts, blocked targets) would distort averages
  const upOnly = { $cond: { if: "$up", then: "$responseTimeMs", else: null } };
  const upCount = { $sum: { $cond: { if: "$up", then: 1, else: 0 } } };

  const summaryPipeline: Pipeline = [
    { $match: match },
    {
      $group: {
        _id: null,
        checks: { $sum: 1 },
        up: upCount,
        avgMs: { $avg: upOnly },
        maxMs: { $max: upOnly },
      },
    },
  ];
  const bucketPipeline: Pipeline = [
    { $match: match },
    {
      $group: {
        _id: { $floor: { $divide: [{ $subtract: ["$checkedAt", fromDate] }, bucketMs] } },
        checks: { $sum: 1 },
        up: upCount,
        avgMs: { $avg: upOnly },
      },
    },
  ];

  const [summaryRows, bucketRows, incidents] = await Promise.all([
    CheckResult.aggregate<SummaryRow>(summaryPipeline),
    CheckResult.aggregate<BucketRow>(bucketPipeline),
    Incident.countDocuments({ monitor: monitorId, startedAt: { $gte: fromDate } }),
  ]);

  // a full series with empty buckets included, so the chart needs no gap logic of its own
  const count = Math.round(ms / bucketMs);
  const series = Array.from({ length: count }, (_, i) => ({
    t: from + i * bucketMs,
    checks: 0,
    up: 0,
    avgMs: null as number | null,
  }));
  for (const row of bucketRows) {
    const point = series[Math.min(Math.max(Number(row._id), 0), count - 1)];
    point.checks += row.checks;
    point.up += row.up;
    if (row.avgMs !== null) point.avgMs = Math.round(row.avgMs);
  }

  const total = summaryRows[0];
  res.json({
    range,
    from,
    to,
    bucketMs,
    summary: {
      checks: total?.checks ?? 0,
      up: total?.up ?? 0,
      uptimePercent:
        total && total.checks > 0 ? Math.round((total.up / total.checks) * 10000) / 100 : null,
      avgResponseMs:
        total && total.avgMs !== null && total.avgMs !== undefined
          ? Math.round(total.avgMs)
          : null,
      maxResponseMs: total?.maxMs ?? null,
      incidents,
    },
    series,
  });
});

monitorStatsRouter.get("/:id/checks", async (req, res) => {
  const parsed = checksQuery.safeParse(req.query);
  if (!parsed.success) {
    badRequest(res, parsed.error);
    return;
  }
  const owned = await Monitor.exists({ _id: req.params.id, owner: req.userId });
  if (!owned) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const checks = await CheckResult.find({ monitor: req.params.id })
    .sort({ checkedAt: -1 })
    .limit(parsed.data.limit)
    .lean();

  res.json(
    checks.map((check) => ({
      _id: check._id,
      checkedAt: check.checkedAt,
      up: check.up,
      statusCode: check.statusCode ?? null,
      responseTimeMs: check.responseTimeMs ?? null,
      error: check.error ?? null,
    }))
  );
});
