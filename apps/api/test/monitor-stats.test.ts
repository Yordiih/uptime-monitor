import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { CheckResult } from "../src/models/CheckResult";
import { Incident } from "../src/models/Incident";
import {
  clearTestDb,
  connectTestDb,
  disconnectTestDb,
  registerUser,
} from "./helpers";

beforeAll(connectTestDb);
beforeEach(clearTestDb);
afterAll(disconnectTestDb);

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createMonitor(token: string): Promise<string> {
  const res = await request(app)
    .post("/api/monitors")
    .set(auth(token))
    .send({ name: "Example", url: "https://example.com" });
  return res.body._id as string;
}

interface Fields {
  up: boolean;
  responseTimeMs?: number;
  statusCode?: number;
  error?: string;
}

async function addCheck(monitorId: string, agoMs: number, fields: Fields): Promise<void> {
  await CheckResult.create({
    monitor: monitorId,
    checkedAt: new Date(Date.now() - agoMs),
    ...fields,
  });
}

describe("access control", () => {
  it("requires authentication", async () => {
    const id = "6ae77b356d74d2f694429643";
    expect((await request(app).get(`/api/monitors/${id}/stats`)).status).toBe(401);
    expect((await request(app).get(`/api/monitors/${id}/checks`)).status).toBe(401);
  });

  it("returns 404 for another user's monitor", async () => {
    const alice = await registerUser(app, "alice@example.com");
    const bob = await registerUser(app, "bob@example.com");
    const id = await createMonitor(alice.token);
    await addCheck(id, 5 * MIN, { up: true, responseTimeMs: 100 });

    const stats = await request(app).get(`/api/monitors/${id}/stats`).set(auth(bob.token));
    const checks = await request(app).get(`/api/monitors/${id}/checks`).set(auth(bob.token));
    expect(stats.status).toBe(404);
    expect(checks.status).toBe(404);
  });

  it("returns 404 for a malformed id", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const res = await request(app).get("/api/monitors/not-an-id/stats").set(auth(token));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/monitors/:id/stats", () => {
  it.each([
    ["bogus range", "range=1y"],
    ["empty range", "range="],
  ])("rejects %s", async (_label, query) => {
    const { token } = await registerUser(app, "a@example.com");
    const id = await createMonitor(token);
    const res = await request(app).get(`/api/monitors/${id}/stats?${query}`).set(auth(token));
    expect(res.status).toBe(400);
  });

  it("computes the summary from successful checks only", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const id = await createMonitor(token);
    await addCheck(id, 10 * MIN, { up: true, responseTimeMs: 100, statusCode: 200 });
    await addCheck(id, 20 * MIN, { up: true, responseTimeMs: 300, statusCode: 200 });
    await addCheck(id, 40 * MIN, { up: false, responseTimeMs: 9000, error: "timeout" });

    const res = await request(app).get(`/api/monitors/${id}/stats`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.range).toBe("24h");
    expect(res.body.summary).toMatchObject({
      checks: 3,
      up: 2,
      uptimePercent: 66.67,
      avgResponseMs: 200,
      maxResponseMs: 300,
      incidents: 0,
    });
  });

  it("returns an empty summary for a monitor without checks", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const id = await createMonitor(token);
    const res = await request(app).get(`/api/monitors/${id}/stats`).set(auth(token));
    expect(res.body.summary).toEqual({
      checks: 0,
      up: 0,
      uptimePercent: null,
      avgResponseMs: null,
      maxResponseMs: null,
      incidents: 0,
    });
  });

  it.each([
    ["24h", 48, 30 * MIN],
    ["7d", 84, 2 * HOUR],
    ["30d", 90, 8 * HOUR],
  ])("builds a full series for %s", async (range, length, bucketMs) => {
    const { token } = await registerUser(app, "a@example.com");
    const id = await createMonitor(token);
    const res = await request(app)
      .get(`/api/monitors/${id}/stats?range=${range}`)
      .set(auth(token));
    expect(res.body.series).toHaveLength(length);
    expect(res.body.bucketMs).toBe(bucketMs);
    expect(res.body.series.every((p: { checks: number }) => p.checks === 0)).toBe(true);
  });

  it("puts every check into exactly one bucket", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const id = await createMonitor(token);
    for (let i = 1; i <= 10; i++) {
      await addCheck(id, i * 25 * MIN, { up: i % 4 !== 0, responseTimeMs: 100 + i });
    }
    const res = await request(app).get(`/api/monitors/${id}/stats`).set(auth(token));
    const series = res.body.series as { checks: number; up: number }[];
    expect(series.reduce((n, p) => n + p.checks, 0)).toBe(10);
    expect(series.reduce((n, p) => n + p.up, 0)).toBe(res.body.summary.up);
  });

  it("only counts checks inside the requested range", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const id = await createMonitor(token);
    await addCheck(id, 2 * DAY, { up: true, responseTimeMs: 100 });

    const day = await request(app).get(`/api/monitors/${id}/stats?range=24h`).set(auth(token));
    const week = await request(app).get(`/api/monitors/${id}/stats?range=7d`).set(auth(token));
    expect(day.body.summary.checks).toBe(0);
    expect(week.body.summary.checks).toBe(1);
  });

  it("counts incidents that started inside the range", async () => {
    const { token, userId } = await registerUser(app, "a@example.com");
    const id = await createMonitor(token);
    await Incident.create({
      monitor: id,
      owner: userId,
      open: false,
      startedAt: new Date(Date.now() - 2 * HOUR),
      resolvedAt: new Date(Date.now() - HOUR),
    });
    await Incident.create({
      monitor: id,
      owner: userId,
      open: false,
      startedAt: new Date(Date.now() - 10 * DAY),
      resolvedAt: new Date(Date.now() - 10 * DAY + HOUR),
    });

    const day = await request(app).get(`/api/monitors/${id}/stats?range=24h`).set(auth(token));
    const month = await request(app).get(`/api/monitors/${id}/stats?range=30d`).set(auth(token));
    expect(day.body.summary.incidents).toBe(1);
    expect(month.body.summary.incidents).toBe(2);
  });
});

describe("GET /api/monitors/:id/checks", () => {
  it("returns recent checks newest first with a limit", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const id = await createMonitor(token);
    await addCheck(id, 30 * MIN, { up: true, responseTimeMs: 300, statusCode: 200 });
    await addCheck(id, 20 * MIN, { up: false, statusCode: 500, error: "unexpected status 500" });
    await addCheck(id, 10 * MIN, { up: true, responseTimeMs: 100, statusCode: 200 });

    const res = await request(app).get(`/api/monitors/${id}/checks?limit=2`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].responseTimeMs).toBe(100);
    expect(res.body[1]).toMatchObject({
      up: false,
      statusCode: 500,
      responseTimeMs: null,
      error: "unexpected status 500",
    });
  });

  it.each([["zero", "limit=0"], ["too large", "limit=500"], ["not a number", "limit=abc"]])(
    "rejects a limit that is %s",
    async (_label, query) => {
      const { token } = await registerUser(app, "a@example.com");
      const id = await createMonitor(token);
      const res = await request(app).get(`/api/monitors/${id}/checks?${query}`).set(auth(token));
      expect(res.status).toBe(400);
    }
  );
});

describe("monitor deletion", () => {
  it("removes the monitor's check history too", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const id = await createMonitor(token);
    await addCheck(id, 5 * MIN, { up: true, responseTimeMs: 100 });

    const res = await request(app).delete(`/api/monitors/${id}`).set(auth(token));
    expect(res.status).toBe(204);
    expect(await CheckResult.countDocuments()).toBe(0);
  });
});
