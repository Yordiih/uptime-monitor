import { describe, expect, it } from "vitest";
import { ApiError, describeError } from "../src/api";

describe("describeError", () => {
  it("explains the alert-related errors", () => {
    expect(describeError(new ApiError(400, "slack_webhook_required"))).toContain("webhook");
    expect(describeError(new ApiError(409, "test_already_pending"))).toContain("already");
  });

  it("explains rate limiting for any code", () => {
    expect(describeError(new ApiError(429, "too_many_tests"))).toContain("Too many");
  });

  it("lists validation problems", () => {
    const message = describeError(
      new ApiError(400, "validation_error", [
        { path: "slack.webhookUrl", message: "must be a Slack incoming webhook URL" },
      ])
    );
    expect(message).toContain("slack.webhookUrl");
  });

  it("reports an unreachable server for non-API errors", () => {
    expect(describeError(new TypeError("fetch failed"))).toBe("Cannot reach the server.");
  });
});
