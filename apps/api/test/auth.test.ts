import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { clearTestDb, connectTestDb, disconnectTestDb } from "./helpers";

beforeAll(connectTestDb);
beforeEach(clearTestDb);
afterAll(disconnectTestDb);

const credentials = { email: "user@example.com", password: "password123" };

describe("POST /api/auth/register", () => {
  it("creates a user and returns a token", async () => {
    const res = await request(app).post("/api/auth/register").send(credentials);
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe("string");
  });

  it("rejects a duplicate email", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const res = await request(app).post("/api/auth/register").send(credentials);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("email_taken");
  });

  it("treats email case-insensitively", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...credentials, email: "USER@example.com" });
    expect(res.status).toBe(409);
  });

  it("rejects an invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: "password123" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });

  it("rejects a short password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "a@example.com", password: "short" });
    expect(res.status).toBe(400);
  });

  it("never returns the password hash", async () => {
    const res = await request(app).post("/api/auth/register").send(credentials);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });
});

describe("POST /api/auth/login", () => {
  it("returns a token for valid credentials", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const res = await request(app).post("/api/auth/login").send(credentials);
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ ...credentials, password: "wrong-password" });
    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });
});
