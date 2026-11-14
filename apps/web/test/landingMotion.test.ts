import { describe, expect, it } from "vitest";
import {
  formatClock,
  nudge,
  prefersReducedMotion,
  seeded,
  tiltAngles,
} from "../src/landingMotion";

describe("nudge", () => {
  it("stays on target at the middle of the range", () => {
    expect(nudge(100, 10, 0.5)).toBe(100);
  });

  it("moves by at most the spread in either direction", () => {
    expect(nudge(100, 10, 0)).toBe(90);
    expect(nudge(100, 10, 1)).toBe(110);
  });

  it("clamps random values outside 0..1", () => {
    expect(nudge(100, 10, 5)).toBe(110);
    expect(nudge(100, 10, -5)).toBe(90);
  });

  it("never goes below 20", () => {
    expect(nudge(25, 50, 0)).toBe(20);
  });
});

describe("seeded", () => {
  it("is deterministic and inside [0, 1)", () => {
    expect(seeded(3, 1)).toBe(seeded(3, 1));
    for (let step = 0; step < 50; step++) {
      const value = seeded(step, 1);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("differs between steps and lanes", () => {
    expect(seeded(1, 0)).not.toBe(seeded(2, 0));
    expect(seeded(1, 0)).not.toBe(seeded(1, 1));
  });
});

describe("tiltAngles", () => {
  it("is flat at the centre", () => {
    const { rx, ry } = tiltAngles(0.5, 0.5, 6);
    expect(rx).toBeCloseTo(0);
    expect(ry).toBeCloseTo(0);
  });

  it("reaches the maximum at the corners", () => {
    expect(tiltAngles(0, 0, 6)).toEqual({ rx: 6, ry: -6 });
    const far = tiltAngles(1, 1, 6);
    expect(far.rx).toBeCloseTo(-6);
    expect(far.ry).toBeCloseTo(6);
  });

  it("clamps positions outside the card", () => {
    expect(tiltAngles(-3, -3, 6)).toEqual({ rx: 6, ry: -6 });
  });
});

describe("formatClock", () => {
  it.each([
    [0, "0:00"],
    [59, "0:59"],
    [192, "3:12"],
    [3600, "60:00"],
    [-5, "0:00"],
  ])("formats %i seconds as %s", (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected);
  });
});

describe("prefersReducedMotion", () => {
  it("is false when there is no browser", () => {
    expect(prefersReducedMotion()).toBe(false);
  });
});
