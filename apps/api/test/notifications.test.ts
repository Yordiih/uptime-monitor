import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { NotificationTest } from "../src/models/NotificationTest";
import {
  clearTestDb,
  connectTestDb,
  disconnectTestDb,
  fakeSlackWebhook,
  registerUser,
} from "./helpers";

beforeAll(connectTestDb);
beforeEach(clearTestDb);
afterAll(disconnectTestDb);

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const WEBHOOK = fakeSlackWebhook();

const saveSettings = (token: string, body: object) =>
  request(app).put("/api/notifications/settings").set(auth(token)).send(body);

describe("GET /api/notifications/settings", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/notifications/settings");
    expect(res.status).toBe(401);
  });

  it("returns safe defaults and the account email", async () => {
    const { token } = await registerUser(app, "owner@example.com");
    const res = await request(app).get("/api/notifications/settings").set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.slack).toEqual({ enabled: false, configured: false, webhookHint: null });
    expect(res.body.email).toEqual({ enabled: false, address: "owner@example.com" });
    expect(res.body.lastTests).toEqual({ slack: null, email: null });
  });

  it("keeps settings private per user", async () => {
    const alice = await registerUser(app, "alice@example.com");
    const bob = await registerUser(app, "bob@example.com");
    await saveSettings(alice.token, { slack: { webhookUrl: WEBHOOK, enabled: true } });

    const res = await request(app).get("/api/notifications/settings").set(auth(bob.token));
    expect(res.body.slack.configured).toBe(false);
    expect(res.body.slack.enabled).toBe(false);
  });
});

describe("PUT /api/notifications/settings", () => {
  it("saves the webhook but never returns it", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const res = await saveSettings(token, { slack: { webhookUrl: WEBHOOK, enabled: true } });
    expect(res.status).toBe(200);
    expect(res.body.slack).toMatchObject({ enabled: true, configured: true });
    expect(res.body.slack.webhookHint.endsWith("XXXX")).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("T00000000");

    const again = await request(app).get("/api/notifications/settings").set(auth(token));
    expect(JSON.stringify(again.body)).not.toContain("T00000000");
  });

  it.each([
    ["plain http", "http://hooks.slack.com/services/T0/B0/XXXX"],
    ["another host", "https://example.com/services/T0/B0/XXXX"],
    ["look-alike host", "https://hooks.slack.com.evil.com/services/T0/B0/XXXX"],
    ["userinfo trick", "https://hooks.slack.com@evil.com/services/T0/B0/XXXX"],
    ["custom port", "https://hooks.slack.com:8443/services/T0/B0/XXXX"],
    ["wrong path", "https://hooks.slack.com/other/T0/B0/XXXX"],
    ["metadata address", "https://169.254.169.254/services/T0/B0/XXXX"],
    ["not a url", "not-a-url"],
  ])("rejects a webhook with %s", async (_label, webhookUrl) => {
    const { token } = await registerUser(app, "a@example.com");
    const res = await saveSettings(token, { slack: { webhookUrl } });
    expect(res.status).toBe(400);
  });

  it("refuses to enable Slack without a webhook", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const res = await saveSettings(token, { slack: { enabled: true } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("slack_webhook_required");
  });

  it("removing the webhook also disables Slack", async () => {
    const { token } = await registerUser(app, "a@example.com");
    await saveSettings(token, { slack: { webhookUrl: WEBHOOK, enabled: true } });
    const res = await saveSettings(token, { slack: { webhookUrl: null } });
    expect(res.status).toBe(200);
    expect(res.body.slack).toEqual({ enabled: false, configured: false, webhookHint: null });
  });

  it("toggles email independently", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const res = await saveSettings(token, { email: { enabled: true } });
    expect(res.body.email.enabled).toBe(true);
    expect(res.body.slack.enabled).toBe(false);
  });
});

describe("POST /api/notifications/test", () => {
  it("rejects an unknown channel", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const res = await request(app)
      .post("/api/notifications/test")
      .set(auth(token))
      .send({ channel: "sms" });
    expect(res.status).toBe(400);
  });

  it("needs a webhook for a Slack test", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const res = await request(app)
      .post("/api/notifications/test")
      .set(auth(token))
      .send({ channel: "slack" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("slack_webhook_required");
  });

  it("queues a test and blocks a duplicate while it is pending", async () => {
    const { token } = await registerUser(app, "a@example.com");
    await saveSettings(token, { slack: { webhookUrl: WEBHOOK } });

    const first = await request(app)
      .post("/api/notifications/test")
      .set(auth(token))
      .send({ channel: "slack" });
    expect(first.status).toBe(202);
    expect(first.body.status).toBe("pending");

    const second = await request(app)
      .post("/api/notifications/test")
      .set(auth(token))
      .send({ channel: "slack" });
    expect(second.status).toBe(409);

    const view = await request(app).get("/api/notifications/settings").set(auth(token));
    expect(view.body.lastTests.slack.status).toBe("pending");
  });

  it("queues an email test without any setup", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const res = await request(app)
      .post("/api/notifications/test")
      .set(auth(token))
      .send({ channel: "email" });
    expect(res.status).toBe(202);
  });

  it("limits tests per hour", async () => {
    const { token, userId } = await registerUser(app, "a@example.com");
    await NotificationTest.insertMany(
      Array.from({ length: 5 }, () => ({ owner: userId, channel: "email", status: "sent" }))
    );
    const res = await request(app)
      .post("/api/notifications/test")
      .set(auth(token))
      .send({ channel: "email" });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("too_many_tests");
  });
});
