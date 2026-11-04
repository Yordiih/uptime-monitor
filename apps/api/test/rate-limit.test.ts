import request from "supertest";
import { describe, expect, it } from "vitest";

describe("auth rate limiting", () => {
  it("returns 429 after too many requests from one client", async () => {
    // must be set before the app (and its config) is imported
    process.env.AUTH_RATE_LIMIT_MAX = "3";
    const { app } = await import("../src/app");

    for (let i = 0; i < 3; i++) {
      const res = await request(app).post("/api/auth/login").send({});
      expect(res.status).toBe(400); // validation error, but it counts
    }
    const blocked = await request(app).post("/api/auth/login").send({});
    expect(blocked.status).toBe(429);
  });
});
