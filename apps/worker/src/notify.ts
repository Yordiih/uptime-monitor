import { log } from "./log";
import {
  buildIncidentMessage,
  buildTestMessage,
  type IncidentInfo,
  type Message,
  type MonitorInfo,
} from "./messages";
import { notificationsTotal } from "./metrics";
import { NotificationSettings, NotificationTest, User } from "./models";
import { emailConfigured, sendEmail } from "./notifiers/email";
import { sendSlack } from "./notifiers/slack";
import type { SendResult } from "./notifiers/types";

type Channel = "slack" | "email";
const CHANNELS: Channel[] = ["slack", "email"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const emailDailyCap = () => Number(process.env.EMAIL_DAILY_CAP ?? 20);
const retryDelayMs = () => Number(process.env.NOTIFY_RETRY_DELAY_MS ?? 2_000);

// Background work is tracked so that shutdown can wait for it to finish.
const pending = new Set<Promise<void>>();

export function track(work: Promise<void>): void {
  const tracked: Promise<void> = work
    .catch((err) => log("error", "background task failed", { error: String(err) }))
    .finally(() => {
      pending.delete(tracked);
    });
  pending.add(tracked);
}

export async function drainNotifications(): Promise<void> {
  await Promise.allSettled([...pending]);
}

// The email budget is per user and per UTC day, kept in the settings document.
async function takeEmailBudget(ownerId: string): Promise<boolean> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  await NotificationSettings.updateOne(
    {
      owner: ownerId,
      $or: [{ emailWindowStart: { $lt: dayStart } }, { emailWindowStart: { $exists: false } }],
    },
    { $set: { emailWindowStart: dayStart, emailCount: 0 } }
  );
  const updated = await NotificationSettings.findOneAndUpdate(
    { owner: ownerId, emailCount: { $lt: emailDailyCap() } },
    { $inc: { emailCount: 1 } }
  );
  return updated !== null;
}

// One retry for real failures. Skipped sends are permanent and never retried.
async function attempt(send: () => Promise<SendResult>): Promise<SendResult> {
  const run = async (): Promise<SendResult> => {
    try {
      return await send();
    } catch (err) {
      return { ok: false, error: String(err).slice(0, 200) };
    }
  };
  let result = await run();
  if (!result.ok && !result.skipped) {
    await sleep(retryDelayMs());
    result = await run();
  }
  return result;
}

async function sendVia(
  channel: Channel,
  ownerId: string,
  message: Message,
  ignoreEnabled: boolean
): Promise<SendResult> {
  const settings = await NotificationSettings.findOne({ owner: ownerId });
  if (!settings) return { ok: false, disabled: true };

  if (channel === "slack") {
    const webhook = settings.slackWebhookUrl;
    if (!webhook || (!settings.slackEnabled && !ignoreEnabled)) {
      return { ok: false, disabled: true };
    }
    return attempt(() => sendSlack(webhook, message.slack));
  }

  if (!settings.emailEnabled && !ignoreEnabled) return { ok: false, disabled: true };
  if (!emailConfigured()) {
    return { ok: false, skipped: true, error: "email is not configured on this server" };
  }
  const user = await User.findById(ownerId).select("email");
  if (!user) return { ok: false, disabled: true };
  if (!(await takeEmailBudget(ownerId))) {
    return { ok: false, skipped: true, error: "daily email limit reached" };
  }
  const address = user.email;
  return attempt(() => sendEmail(address, message.subject, message.text));
}

const labelOf = (result: SendResult): "sent" | "failed" | "skipped" =>
  result.ok ? "sent" : result.skipped ? "skipped" : "failed";

async function runIncidentNotifications(
  event: "opened" | "resolved",
  incident: IncidentInfo,
  monitor: MonitorInfo
): Promise<void> {
  const message = buildIncidentMessage(event, incident, monitor);
  const ownerId = monitor.owner.toString();

  await Promise.all(
    CHANNELS.map(async (channel) => {
      const result = await sendVia(channel, ownerId, message, false);
      if (result.disabled) return;
      const label = labelOf(result);
      notificationsTotal.inc({ channel, event, result: label });
      // ids only: never the URL or the webhook
      log(label === "sent" ? "info" : "warn", `notification ${label}`, {
        channel,
        event,
        incidentId: incident.id,
        monitorId: monitor.id,
        error: result.error,
      });
    })
  );
}

// Fire and forget: a slow or failing channel never blocks the check loop.
export function notifyIncident(
  event: "opened" | "resolved",
  incident: IncidentInfo,
  monitor: MonitorInfo
): void {
  track(runIncidentNotifications(event, incident, monitor));
}

// Picks up the test requests created through the API.
export async function processTestRequests(): Promise<void> {
  const requests = await NotificationTest.find({ status: "pending" })
    .sort({ createdAt: 1 })
    .limit(10);

  for (const request of requests) {
    const claimed = await NotificationTest.findOneAndUpdate(
      { _id: request._id, status: "pending" },
      { $set: { status: "processing" } }
    );
    if (!claimed) continue;

    const channel = request.channel as Channel;
    const result = await sendVia(channel, String(request.owner), buildTestMessage(), true);
    const label = labelOf(result);
    notificationsTotal.inc({ channel, event: "test", result: label });

    const set: Record<string, unknown> = { status: result.ok ? "sent" : "failed" };
    if (!result.ok) set.error = (result.error ?? "not sent").slice(0, 200);
    await NotificationTest.updateOne({ _id: request._id }, { $set: set });
    log("info", "test notification processed", { channel, result: label, requestId: String(request._id) });
  }
}
