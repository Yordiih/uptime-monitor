import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/notifiers/slack", () => ({ sendSlack: vi.fn() }));
vi.mock("../src/notifiers/email", () => ({
  sendEmail: vi.fn(),
  emailConfigured: vi.fn(),
}));

import { drainNotifications, notifyIncident, processTestRequests } from "../src/notify";
import { NotificationSettings, NotificationTest, User } from "../src/models";
import { emailConfigured, sendEmail } from "../src/notifiers/email";
import { sendSlack } from "../src/notifiers/slack";
import { fakeSlackWebhook } from "./fixtures";

const uri = process.env.MONGO_URI_TEST ?? "mongodb://localhost:27017/uptime-test";
const WEBHOOK = fakeSlackWebhook();

async function setup(settings: Record<string, unknown>) {
  const user = await User.create({ email: "owner@example.com" });
  await NotificationSettings.create({ owner: user._id, ...settings });
  return user;
}

const incident = {
  id: "i1",
  startedAt: new Date("2026-11-01T10:00:00Z"),
  lastError: "unexpected status 500",
};

const monitorFor = (owner: unknown, name = "Example") => ({
  id: "m1",
  owner: owner as { toString(): string },
  name,
  url: "https://example.com/private?token=SECRET",
});

async function notify(owner: unknown, name?: string) {
  notifyIncident("opened", incident, monitorFor(owner, name));
  await drainNotifications();
}

beforeAll(async () => {
  const dbName = new URL(uri).pathname.replace("/", "");
  if (!dbName.endsWith("-test")) {
    throw new Error("Refusing to run: the test database name must end with -test");
  }
  await mongoose.connect(uri);
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
});

beforeEach(async () => {
  vi.clearAllMocks();
  process.env.NOTIFY_RETRY_DELAY_MS = "0";
  process.env.EMAIL_DAILY_CAP = "20";
  vi.mocked(sendSlack).mockResolvedValue({ ok: true });
  vi.mocked(sendEmail).mockResolvedValue({ ok: true });
  vi.mocked(emailConfigured).mockReturnValue(true);
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({}))
  );
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe("incident notifications", () => {
  it("sends to Slack when enabled, without leaking the URL", async () => {
    const user = await setup({ slackEnabled: true, slackWebhookUrl: WEBHOOK });
    await notify(user._id);

    expect(sendSlack).toHaveBeenCalledTimes(1);
    const [hook, text] = vi.mocked(sendSlack).mock.calls[0];
    expect(hook).toBe(WEBHOOK);
    expect(text).toContain("Example");
    expect(text).not.toContain("SECRET");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends nothing when the channels are switched off", async () => {
    const user = await setup({ slackEnabled: false, slackWebhookUrl: WEBHOOK, emailEnabled: false });
    await notify(user._id);
    expect(sendSlack).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends nothing for a user without settings", async () => {
    const user = await User.create({ email: "none@example.com" });
    await notify(user._id);
    expect(sendSlack).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("emails the account address only", async () => {
    const user = await setup({ emailEnabled: true });
    await notify(user._id);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmail).mock.calls[0][0]).toBe("owner@example.com");
    expect(vi.mocked(sendEmail).mock.calls[0][1]).toBe("[DOWN] Example");
  });

  it("escapes mentions in Slack messages", async () => {
    const user = await setup({ slackEnabled: true, slackWebhookUrl: WEBHOOK });
    await notify(user._id, "<!channel> hi");
    const text = vi.mocked(sendSlack).mock.calls[0][1];
    expect(text).not.toContain("<!channel>");
    expect(text).toContain("&lt;!channel&gt;");
  });

  it("retries a failed send once", async () => {
    const user = await setup({ slackEnabled: true, slackWebhookUrl: WEBHOOK });
    vi.mocked(sendSlack)
      .mockResolvedValueOnce({ ok: false, error: "boom" })
      .mockResolvedValueOnce({ ok: true });
    await notify(user._id);
    expect(sendSlack).toHaveBeenCalledTimes(2);
  });

  it("does not retry a skipped send", async () => {
    const user = await setup({ slackEnabled: true, slackWebhookUrl: WEBHOOK });
    vi.mocked(sendSlack).mockResolvedValue({ ok: false, skipped: true, error: "no" });
    await notify(user._id);
    expect(sendSlack).toHaveBeenCalledTimes(1);
  });

  it("survives a sender that throws, and still uses the other channel", async () => {
    const user = await setup({
      slackEnabled: true,
      slackWebhookUrl: WEBHOOK,
      emailEnabled: true,
    });
    vi.mocked(sendSlack).mockRejectedValue(new Error("network down"));
    await expect(notify(user._id)).resolves.toBeUndefined();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("skips email when SMTP is not configured", async () => {
    const user = await setup({ emailEnabled: true });
    vi.mocked(emailConfigured).mockReturnValue(false);
    await notify(user._id);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("enforces the daily email cap", async () => {
    process.env.EMAIL_DAILY_CAP = "2";
    const user = await setup({ emailEnabled: true });
    await notify(user._id);
    await notify(user._id);
    await notify(user._id);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });
});

describe("test requests", () => {
  it("delivers a pending Slack test even when the channel is not enabled", async () => {
    const user = await setup({ slackEnabled: false, slackWebhookUrl: WEBHOOK });
    const request = await NotificationTest.create({ owner: user._id, channel: "slack" });

    await processTestRequests();

    expect(sendSlack).toHaveBeenCalledTimes(1);
    expect((await NotificationTest.findById(request._id))?.status).toBe("sent");
  });

  it("records the failure reason without the webhook", async () => {
    const user = await setup({ slackWebhookUrl: WEBHOOK });
    vi.mocked(sendSlack).mockResolvedValue({ ok: false, error: "slack responded with 404" });
    const request = await NotificationTest.create({ owner: user._id, channel: "slack" });

    await processTestRequests();

    const stored = await NotificationTest.findById(request._id);
    expect(stored?.status).toBe("failed");
    expect(stored?.error).toBe("slack responded with 404");
    expect(stored?.error).not.toContain("hooks.slack.com");
  });

  it("sends an email test to the account address", async () => {
    const user = await setup({});
    await NotificationTest.create({ owner: user._id, channel: "email" });
    await processTestRequests();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmail).mock.calls[0][0]).toBe("owner@example.com");
  });

  it("processes each request only once", async () => {
    const user = await setup({ slackWebhookUrl: WEBHOOK });
    await NotificationTest.create({ owner: user._id, channel: "slack" });
    await processTestRequests();
    await processTestRequests();
    expect(sendSlack).toHaveBeenCalledTimes(1);
  });
});
