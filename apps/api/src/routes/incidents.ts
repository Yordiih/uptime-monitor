import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { Incident } from "../models/Incident";
import { Monitor } from "../models/Monitor";

const querySchema = z.object({
  status: z.enum(["open", "resolved"]).optional(),
  monitor: z
    .string()
    .refine((value) => isValidObjectId(value), { message: "invalid monitor id" })
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const incidentsRouter = Router();
incidentsRouter.use(requireAuth);

incidentsRouter.get("/", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "validation_error",
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }
  const { status, monitor, limit } = parsed.data;

  const filter: Record<string, unknown> = { owner: req.userId };
  if (status) filter.open = status === "open";
  if (monitor) filter.monitor = monitor;

  const incidents = await Incident.find(filter)
    .sort({ startedAt: -1 })
    .limit(limit)
    .lean();

  const monitors = await Monitor.find({ _id: { $in: incidents.map((i) => i.monitor) } })
    .select("name")
    .lean();
  const names = new Map(monitors.map((m) => [String(m._id), m.name]));

  const now = Date.now();
  res.json(
    incidents.map((incident) => ({
      _id: incident._id,
      monitorId: incident.monitor,
      monitorName: names.get(String(incident.monitor)) ?? null,
      open: incident.open,
      startedAt: incident.startedAt,
      resolvedAt: incident.resolvedAt ?? null,
      durationMs:
        (incident.resolvedAt ? incident.resolvedAt.getTime() : now) -
        incident.startedAt.getTime(),
      lastError: incident.lastError ?? null,
      lastStatusCode: incident.lastStatusCode ?? null,
    }))
  );
});
