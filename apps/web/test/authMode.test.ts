import { describe, expect, it } from "vitest";
import { authModeFromSearch } from "../src/authMode";

describe("authModeFromSearch", () => {
  it.each([
    ["?mode=register", "register"],
    ["", "login"],
    ["?mode=login", "login"],
    ["?mode=admin", "login"],
    ["?other=1", "login"],
  ])("maps %j to %s", (search, expected) => {
    expect(authModeFromSearch(search)).toBe(expected);
  });
});
