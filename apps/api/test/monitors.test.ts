import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import {
  clearTestDb,
  connectTestDb,
  disconnectTestDb,
  registerUser,
} from "./helpers";

beforeAll(connectTestDb);
beforeEach(clearTestDb);
afterAll(disconnectTestDb);

const validMonitor = { name: "Example", url: "https://example.com" };

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("authentication", () => {
  it("requires a token", async () => {
    const res = await request(app).get("/api/monitors");
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token", async () => {
    const res = await request(app)
      .get("/api/monitors")
      .set(auth("not-a-real-token"));
    expect(res.status).toBe(401);
  });
});

describe("CRUD", () => {
  it("creates a monitor with defaults and lists it", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const created = await request(app)
      .post("/api/monitors")
      .set(auth(token))
      .send(validMonitor);
    expect(created.status).toBe(201);
    expect(created.body.intervalMinutes).toBe(5);
    expect(created.body.expectedStatus).toBe(200);
    expect(created.body.paused).toBe(false);

    const list = await request(app).get("/api/monitors").set(auth(token));
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe("Example");
  });

  it("updates and pauses a monitor", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const created = await request(app)
      .post("/api/monitors")
      .set(auth(token))
      .send(validMonitor);
    const res = await request(app)
      .patch(`/api/monitors/${created.body._id}`)
      .set(auth(token))
      .send({ paused: true, name: "Renamed" });
    expect(res.status).toBe(200);
    expect(res.body.paused).toBe(true);
    expect(res.body.name).toBe("Renamed");
    expect(res.body.url).toBe("https://example.com");
  });

  it("deletes a monitor", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const created = await request(app)
      .post("/api/monitors")
      .set(auth(token))
      .send(validMonitor);
    const res = await request(app)
      .delete(`/api/monitors/${created.body._id}`)
      .set(auth(token));
    expect(res.status).toBe(204);
    const list = await request(app).get("/api/monitors").set(auth(token));
    expect(list.body).toHaveLength(0);
  });

  it("returns 404 for a malformed id", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const res = await request(app).get("/api/monitors/not-an-id").set(auth(token));
    expect(res.status).toBe(404);
  });
});

describe("validation", () => {
  it.each([
    ["ftp url", { name: "x", url: "ftp://example.com" }],
    ["javascript url", { name: "x", url: "javascript:alert(1)" }],
    ["empty name", { name: "", url: "https://example.com" }],
    ["bad interval", { ...validMonitor, intervalMinutes: 2 }],
    ["bad expected status", { ...validMonitor, expectedStatus: 99 }],
  ])("rejects %s", async (_label, body) => {
    const { token } = await registerUser(app, "a@example.com");
    const res = await request(app).post("/api/monitors").set(auth(token)).send(body);
    expect(res.status).toBe(400);
  });

  it("enforces the per-user monitor limit", async () => {
    const { token } = await registerUser(app, "a@example.com");
    for (let i = 0; i < 20; i++) {
      const res = await request(app)
        .post("/api/monitors")
        .set(auth(token))
        .send({ ...validMonitor, name: `m${i}` });
      expect(res.status).toBe(201);
    }
    const res = await request(app)
      .post("/api/monitors")
      .set(auth(token))
      .send(validMonitor);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("monitor_limit_reached");
  });
});

describe("authorization", () => {
  it("ignores an owner sent in the body (no mass assignment)", async () => {
    const alice = await registerUser(app, "alice@example.com");
    const bob = await registerUser(app, "bob@example.com");
    const res = await request(app)
      .post("/api/monitors")
      .set(auth(alice.token))
      .send({ ...validMonitor, owner: bob.userId });
    expect(res.status).toBe(201);
    expect(res.body.owner).toBe(alice.userId);
  });

  it("ignores worker-owned status fields sent by a client", async () => {
    const { token } = await registerUser(app, "a@example.com");
    const res = await request(app)
      .post("/api/monitors")
      .set(auth(token))
      .send({ ...validMonitor, lastStatus: "up", lastResponseTimeMs: 1 });
    expect(res.status).toBe(201);
    expect(res.body.lastStatus).toBeUndefined();
    expect(res.body.lastResponseTimeMs).toBeUndefined();
  });

  it("hides one user's monitors from another user", async () => {
    const alice = await registerUser(app, "alice@example.com");
    const bob = await registerUser(app, "bob@example.com");
    const created = await request(app)
      .post("/api/monitors")
      .set(auth(alice.token))
      .send(validMonitor);
    const id = created.body._id;

    const list = await request(app).get("/api/monitors").set(auth(bob.token));
    expect(list.body).toEqual([]);

    const read = await request(app).get(`/api/monitors/${id}`).set(auth(bob.token));
    expect(read.status).toBe(404);

    const update = await request(app)
      .patch(`/api/monitors/${id}`)
      .set(auth(bob.token))
      .send({ name: "hacked" });
    expect(update.status).toBe(404);

    const remove = await request(app)
      .delete(`/api/monitors/${id}`)
      .set(auth(bob.token));
    expect(remove.status).toBe(404);

    const still = await request(app).get(`/api/monitors/${id}`).set(auth(alice.token));
    expect(still.status).toBe(200);
    expect(still.body.name).toBe("Example");
  });
});
