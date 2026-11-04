import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";

const uri = process.env.MONGO_URI_TEST ?? "mongodb://localhost:27017/uptime-test";

export async function connectTestDb(): Promise<void> {
  const dbName = new URL(uri).pathname.replace("/", "");
  if (!dbName.endsWith("-test")) {
    throw new Error("Refusing to run: the test database name must end with -test");
  }
  await mongoose.connect(uri);
  // make sure unique indexes exist before the first test
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function clearTestDb(): Promise<void> {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({})
    )
  );
}

export async function disconnectTestDb(): Promise<void> {
  await mongoose.disconnect();
}

export async function registerUser(app: Express, email: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123" });
  const token = res.body.token as string;
  const userId = JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString()
  ).sub as string;
  return { token, userId };
}
