import { describe, expect, it } from "vitest";
import { formatDuration } from "../src/format";

describe("formatDuration", () => {
  it.each([
    [0, "0s"],
    [59_000, "59s"],
    [61_000, "1m 1s"],
    [3_660_000, "1h 1m"],
    [-5, "0s"],
  ])("formats %i ms as %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});
