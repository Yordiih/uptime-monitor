import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { Monitor } from "../models/Monitor";

const MAX_MONITORS_PER_USER = 20;

const httpUrl = z
  .url()
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "URL must start with http:// or https://",
  });

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  url: httpUrl,
  intervalMinutes: z
    .union([z.literal(1), z.literal(5), z.literal(15)])
    .optional(),
  expectedStatus: z.number().int().min(100).max(599).optional(),
});

const updateSchema = createSchema
  .partial()
  .extend({ paused: z.boolean().optional() });

export const monitorsRouter = Router();
monitorsRouter.use(requireAuth);

monitorsRouter.param("id", (_req, res, next, id) => {
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  next();
});

monitorsRouter.get("/", async (req, res) => {
  const monitors = await Monitor.find({ owner: req.userId }).sort({
    createdAt: -1,
  });
  res.json(monitors);
});

monitorsRouter.post("/", validate(createSchema), async (req, res) => {
  const count = await Monitor.countDocuments({ owner: req.userId });
  if (count >= MAX_MONITORS_PER_USER) {
    res.status(403).json({ error: "monitor_limit_reached" });
    return;
  }
  const monitor = await Monitor.create({ ...req.body, owner: req.userId });
  res.status(201).json(monitor);
});

monitorsRouter.get("/:id", async (req, res) => {
  const monitor = await Monitor.findOne({ _id: req.params.id, owner: req.userId });
  if (!monitor) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(monitor);
});

monitorsRouter.patch("/:id", validate(updateSchema), async (req, res) => {
  const monitor = await Monitor.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId },
    req.body,
    { new: true, runValidators: true }
  );
  if (!monitor) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(monitor);
});

monitorsRouter.delete("/:id", async (req, res) => {
  const result = await Monitor.deleteOne({ _id: req.params.id, owner: req.userId });
  if (result.deletedCount === 0) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.status(204).end();
});
