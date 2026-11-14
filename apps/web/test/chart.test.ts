import { describe, expect, it } from "vitest";
import { niceCeil, runsOf } from "../src/chart";

describe("niceCeil", () => {
  it.each([
    [100, 100],
    [120, 200],
    [250, 500],
    [700, 1000],
    [0, 1],
    [-5, 1],
  ])("rounds %i up to %i", (value, expected) => {
    expect(niceCeil(value)).toBe(expected);
  });
});

describe("runsOf", () => {
  it("splits a series at gaps", () => {
    const runs = runsOf([1, 2, null, 3, null, null, 4, 5]);
    expect(runs.map((run) => run.length)).toEqual([2, 1, 2]);
    expect(runs[2][0]).toEqual({ index: 6, value: 4 });
  });

  it("returns nothing for an empty or all-null series", () => {
    expect(runsOf([])).toEqual([]);
    expect(runsOf([null, null])).toEqual([]);
  });
});
