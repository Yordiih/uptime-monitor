import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
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

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const HOUR = 60 * 60 * 1000;

async function createMonitor(token: string, name = "Example"): Promise<string> {
  const res = await request(app)
    .post("/api/monitors")
    .set(auth(token))
    .send({ name, url: "https://example.com" });
  return res.body._id as string;
}

describe("GET /api/incidents", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/incidents");
    expect(res.status).toBe(401);
  });

  it("lists own incidents newest first with duration and monitor name", async () => {
    const { token, userId } = await registerUser(app, "a@example.com");
    const monitorId = await createMonitor(token);
    const now = Date.now();
    await Incident.create({
      monitor: monitorId,
      owner: userId,
      open: false,
      startedAt: new Date(now - 2 * HOUR),
      resolvedAt: new Date(now - HOUR),
      lastError: "unexpected status 500",
      lastStatusCode: 500,
    });
    await Incident.create({
      monitor: monitorId,
      owner: userId,
      startedAt: new Date(now - 10 * 60 * 1000),
      lastError: "timeout",
    });

    const res = await request(app).get("/api/incidents").set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].open).toBe(true);
    expect(res.body[0].monitorName).toBe("Example");
    expect(res.body[1].open).toBe(false);
    expect(res.body[1].durationMs).toBe(HOUR);
    expect(res.body[1].lastStatusCode).toBe(500);
  });

  it("hides other users' incidents", async () => {
    const alice = await registerUser(app, "alice@example.com");
    const bob = await registerUser(app, "bob@example.com");
    const monitorId = await createMonitor(alice.token);
    await Incident.create({
      monitor: monitorId,
      owner: alice.userId,
      startedAt: new Date(),
    });

    const res = await request(app).get("/api/incidents").set(auth(bob.token));
    expect(res.body).toEqual([]);
  });

  it("filters by status and by monitor", async () => {
    const { token, userId } = await registerUser(app, "a@example.com");
    const first = await createMonitor(token, "First");
    const second = await createMonitor(token, "Second");
    await Incident.create({
      monitor: first,
      owner: userId,
      open: false,
      startedAt: new Date(Date.now() - 2 * HOUR),
      resolvedAt: new Date(Date.now() - HOUR),
    });
    await Incident.create({ monitor: second, owner: userId, startedAt: new Date() });

    const open = await request(app).get("/api/incidents?status=open").set(auth(token));
    expect(open.body).toHaveLength(1);
    expect(open.body[0].monitorName).toBe("Second");

    const resolved = await request(app)
      .get("/api/incidents?status=resolved")
      .set(auth(token));
    expect(resolved.body).toHaveLength(1);
    expect(resolved.body[0].monitorName).toBe("First");

    const byMonitor = await request(app)
      .get(`/api/incidents?monitor=${first}`)
      .set(auth(token));
    expect(byMonitor.body).toHaveLength(1);
    expect(byMonitor.body[0].monitorName).toBe("First");
  });

  it.each([
    ["unknown status", "status=bogus"],
    ["bad monitor id", "monitor=not-an-id"],
    ["zero limit", "limit=0"],
    ["huge limit", "limit=1000"],
  ])("rejects %s", async (_label, query) => {
    const { token } = await registerUser(app, "a@example.com");
    const res = await request(app).get(`/api/incidents?${query}`).set(auth(token));
    expect(res.status).toBe(400);
  });
});

describe("incident lifecycle rules", () => {
  it("deletes a monitor's incidents together with the monitor", async () => {
    const { token, userId } = await registerUser(app, "a@example.com");
    const monitorId = await createMonitor(token);
    await Incident.create({ monitor: monitorId, owner: userId, startedAt: new Date() });

    const res = await request(app).delete(`/api/monitors/${monitorId}`).set(auth(token));
    expect(res.status).toBe(204);
    expect(await Incident.countDocuments()).toBe(0);
  });

  it("allows only one open incident per monitor", async () => {
    const { token, userId } = await registerUser(app, "a@example.com");
    const monitorId = await createMonitor(token);
    await Incident.create({ monitor: monitorId, owner: userId, startedAt: new Date() });

    await expect(
      Incident.create({ monitor: monitorId, owner: userId, startedAt: new Date() })
    ).rejects.toMatchObject({ code: 11000 });

    await Incident.create({
      monitor: monitorId,
      owner: userId,
      open: false,
      startedAt: new Date(Date.now() - 2 * HOUR),
      resolvedAt: new Date(Date.now() - HOUR),
    });
    expect(await Incident.countDocuments()).toBe(2);
  });
});
