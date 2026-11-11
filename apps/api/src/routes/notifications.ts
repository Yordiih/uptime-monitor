import { Router } from "express";
import { z } from "zod";
import { isSlackWebhookUrl } from "../lib/slack";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { NotificationSettings } from "../models/NotificationSettings";
import { NotificationTest } from "../models/NotificationTest";
import { User } from "../models/User";

const TESTS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

const updateSchema = z.object({
  slack: z
    .object({
      enabled: z.boolean().optional(),
      webhookUrl: z
        .string()
        .max(300)
        .refine(isSlackWebhookUrl, {
          message: "must be a Slack incoming webhook URL (https://hooks.slack.com/services/...)",
        })
        .nullable()
        .optional(),
    })
    .optional(),
  email: z.object({ enabled: z.boolean().optional() }).optional(),
});

const testSchema = z.object({ channel: z.enum(["slack", "email"]) });

function testView(
  test: { status: string; error?: string | null; createdAt: Date } | null
) {
  return test
    ? { status: test.status, error: test.error ?? null, at: test.createdAt }
    : null;
}

// The webhook URL never leaves the server: only a masked hint is returned.
async function buildView(userId: string) {
  const [settings, user, slackTest, emailTest] = await Promise.all([
    NotificationSettings.findOne({ owner: userId }).lean(),
    User.findById(userId).select("email").lean(),
    NotificationTest.findOne({ owner: userId, channel: "slack" })
      .sort({ createdAt: -1 })
      .lean(),
    NotificationTest.findOne({ owner: userId, channel: "email" })
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  const hook = settings?.slackWebhookUrl;
  return {
    slack: {
      enabled: settings?.slackEnabled ?? false,
      configured: Boolean(hook),
      webhookHint: hook ? `https://hooks.slack.com/services/…${hook.slice(-4)}` : null,
    },
    email: {
      enabled: settings?.emailEnabled ?? false,
      address: user?.email ?? null,
    },
    lastTests: { slack: testView(slackTest), email: testView(emailTest) },
  };
}

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/settings", async (req, res) => {
  res.json(await buildView(req.userId as string));
});

notificationsRouter.put("/settings", validate(updateSchema), async (req, res) => {
  const { slack, email } = req.body as z.infer<typeof updateSchema>;
  const current = await NotificationSettings.findOne({ owner: req.userId });

  let webhook = current?.slackWebhookUrl ?? undefined;
  let slackEnabled = current?.slackEnabled ?? false;
  let emailEnabled = current?.emailEnabled ?? false;

  if (slack?.webhookUrl === null) {
    webhook = undefined;
    slackEnabled = false;
  } else if (typeof slack?.webhookUrl === "string") {
    webhook = slack.webhookUrl;
  }
  if (typeof slack?.enabled === "boolean") slackEnabled = slack.enabled;
  if (typeof email?.enabled === "boolean") emailEnabled = email.enabled;

  if (slackEnabled && !webhook) {
    res.status(400).json({ error: "slack_webhook_required" });
    return;
  }

  const flags = { slackEnabled, emailEnabled };
  const update = webhook
    ? { $set: { ...flags, slackWebhookUrl: webhook } }
    : { $set: flags, $unset: { slackWebhookUrl: 1 } };
  await NotificationSettings.findOneAndUpdate({ owner: req.userId }, update, {
    upsert: true,
    returnDocument: "after",
  });

  res.json(await buildView(req.userId as string));
});

notificationsRouter.post("/test", validate(testSchema), async (req, res) => {
  const { channel } = req.body as z.infer<typeof testSchema>;

  if (channel === "slack") {
    const settings = await NotificationSettings.findOne({ owner: req.userId });
    if (!settings?.slackWebhookUrl) {
      res.status(400).json({ error: "slack_webhook_required" });
      return;
    }
  }

  const recent = await NotificationTest.countDocuments({
    owner: req.userId,
    createdAt: { $gt: new Date(Date.now() - HOUR_MS) },
  });
  if (recent >= TESTS_PER_HOUR) {
    res.status(429).json({ error: "too_many_tests" });
    return;
  }

  // a request stuck in "processing" must not block new tests forever
  const inFlight = await NotificationTest.exists({
    owner: req.userId,
    channel,
    status: { $in: ["pending", "processing"] },
    createdAt: { $gt: new Date(Date.now() - 2 * 60 * 1000) },
  });
  if (inFlight) {
    res.status(409).json({ error: "test_already_pending" });
    return;
  }

  const test = await NotificationTest.create({ owner: req.userId, channel });
  res.status(202).json({ id: test._id, status: "pending" });
});
