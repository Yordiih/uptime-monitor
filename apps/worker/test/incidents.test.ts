import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/events", () => ({
  incidentOpened: vi.fn(),
  incidentResolved: vi.fn(),
}));

import type { CheckOutcome } from "../src/checker";
import { incidentOpened, incidentResolved } from "../src/events";
import { recordResult } from "../src/incidents";
import { Incident, Monitor } from "../src/models";

const uri = process.env.MONGO_URI_TEST ?? "mongodb://localhost:27017/uptime-test";

const failing: CheckOutcome = {
  up: false,
  statusCode: 500,
  responseTimeMs: 10,
  error: "unexpected status 500",
};
const passing: CheckOutcome = { up: true, statusCode: 200, responseTimeMs: 20 };

async function createMonitor(): Promise<string> {
  const monitor = await Monitor.create({
    owner: new mongoose.Types.ObjectId(),
    name: "Example",
    url: "https://example.com",
  });
  return String(monitor._id);
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
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({})
    )
  );
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe("recordResult", () => {
  it("does not open an incident before the failure threshold", async () => {
    const id = await createMonitor();
    await recordResult(id, failing, 2);

    const monitor = await Monitor.findById(id);
    expect(monitor?.failureStreak).toBe(1);
    expect(monitor?.state).not.toBe("down");
    expect(await Incident.countDocuments()).toBe(0);
    expect(incidentOpened).not.toHaveBeenCalled();
  });

  it("opens exactly one incident when the threshold is reached", async () => {
    const id = await createMonitor();
    await recordResult(id, failing, 2);
    await recordResult(id, failing, 2);

    const monitor = await Monitor.findById(id);
    expect(monitor?.state).toBe("down");
    expect(await Incident.countDocuments({ open: true })).toBe(1);
    expect(incidentOpened).toHaveBeenCalledTimes(1);
  });

  it("does not open duplicates while the monitor stays down", async () => {
    const id = await createMonitor();
    for (let i = 0; i < 5; i++) {
      await recordResult(id, failing, 2);
    }
    expect(await Incident.countDocuments()).toBe(1);
    expect(incidentOpened).toHaveBeenCalledTimes(1);
  });

  it("resolves the incident when the monitor recovers", async () => {
    const id = await createMonitor();
    await recordResult(id, failing, 2);
    await recordResult(id, failing, 2);
    await recordResult(id, passing, 2);

    const monitor = await Monitor.findById(id);
    expect(monitor?.state).toBe("up");
    expect(monitor?.failureStreak).toBe(0);
    const incident = await Incident.findOne();
    expect(incident?.open).toBe(false);
    expect(incident?.resolvedAt).toBeDefined();
    expect(incidentResolved).toHaveBeenCalledTimes(1);
  });

  it("ignores a single failed check followed by a success", async () => {
    const id = await createMonitor();
    await recordResult(id, failing, 2);
    await recordResult(id, passing, 2);

    expect(await Incident.countDocuments()).toBe(0);
    expect(incidentOpened).not.toHaveBeenCalled();
    expect(incidentResolved).not.toHaveBeenCalled();
    expect((await Monitor.findById(id))?.failureStreak).toBe(0);
  });

  it("starts the incident at the first failing check", async () => {
    const id = await createMonitor();
    await recordResult(id, failing, 2);
    const firstFailureAt = (await Monitor.findById(id))?.firstFailureAt;
    expect(firstFailureAt).toBeDefined();

    await recordResult(id, failing, 2);
    const incident = await Incident.findOne();
    expect(incident?.startedAt.getTime()).toBe(firstFailureAt?.getTime());
    expect(incident?.lastError).toBe("unexpected status 500");
    expect(incident?.lastStatusCode).toBe(500);
  });

  it("opens immediately with a threshold of 1", async () => {
    const id = await createMonitor();
    await recordResult(id, failing, 1);
    expect(await Incident.countDocuments({ open: true })).toBe(1);
  });

  it("opens a new incident after a previous one was resolved", async () => {
    const id = await createMonitor();
    await recordResult(id, failing, 2);
    await recordResult(id, failing, 2);
    await recordResult(id, passing, 2);
    await recordResult(id, failing, 2);
    await recordResult(id, failing, 2);

    expect(await Incident.countDocuments()).toBe(2);
    expect(await Incident.countDocuments({ open: true })).toBe(1);
    expect(incidentOpened).toHaveBeenCalledTimes(2);
  });
});
