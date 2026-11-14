import { describe, expect, it } from "vitest";
import type { Monitor } from "../src/api";
import { filterAndSort, statusOf, summarize } from "../src/monitorView";

function monitor(overrides: Partial<Monitor> & { name: string }): Monitor {
  return {
    _id: overrides.name,
    url: `https://${overrides.name.toLowerCase()}.example.com`,
    intervalMinutes: 5,
    expectedStatus: 200,
    paused: false,
    ...overrides,
  };
}

const list = [
  monitor({ name: "Alpha", lastStatus: "up", lastResponseTimeMs: 100 }),
  monitor({ name: "Bravo", lastStatus: "up", lastResponseTimeMs: 300 }),
  monitor({ name: "Charlie", lastStatus: "down", lastResponseTimeMs: 50 }),
  monitor({ name: "Delta", paused: true, lastStatus: "up", lastResponseTimeMs: 999 }),
  monitor({ name: "Echo" }),
];

describe("statusOf", () => {
  it("lets paused win over the last result", () => {
    expect(statusOf(list[3])).toBe("paused");
  });

  it("is pending before the first check", () => {
    expect(statusOf(list[4])).toBe("pending");
  });
});

describe("summarize", () => {
  it("counts statuses and averages only running, up monitors", () => {
    expect(summarize(list)).toEqual({
      total: 5,
      up: 2,
      down: 1,
      paused: 1,
      pending: 1,
      avgResponseMs: 200,
    });
  });

  it("has no average without data", () => {
    expect(summarize([]).avgResponseMs).toBeNull();
  });
});

describe("filterAndSort", () => {
  const all = { query: "", status: "all" as const, sort: "newest" as const };

  it("keeps the API order for newest and does not mutate the input", () => {
    const before = list.map((m) => m.name);
    const result = filterAndSort(list, all);
    expect(result.map((m) => m.name)).toEqual(before);
    expect(list.map((m) => m.name)).toEqual(before);
  });

  it("searches name and URL, ignoring case", () => {
    expect(filterAndSort(list, { ...all, query: "CHAR" }).map((m) => m.name)).toEqual(["Charlie"]);
    expect(filterAndSort(list, { ...all, query: "bravo.example" })).toHaveLength(1);
  });

  it("filters by status", () => {
    expect(filterAndSort(list, { ...all, status: "down" }).map((m) => m.name)).toEqual(["Charlie"]);
    expect(filterAndSort(list, { ...all, status: "paused" }).map((m) => m.name)).toEqual(["Delta"]);
  });

  it("sorts by name", () => {
    const names = filterAndSort([list[2], list[0], list[1]], { ...all, sort: "name" }).map((m) => m.name);
    expect(names).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("sorts problems first by status", () => {
    const names = filterAndSort(list, { ...all, sort: "status" }).map((m) => m.name);
    expect(names[0]).toBe("Charlie");
    expect(names[1]).toBe("Echo");
    expect(names[names.length - 1]).toBe("Delta");
  });

  it("sorts slowest first and puts monitors without data last", () => {
    const names = filterAndSort(list, { ...all, sort: "slowest" }).map((m) => m.name);
    expect(names[0]).toBe("Delta");
    expect(names[names.length - 1]).toBe("Echo");
  });
});
