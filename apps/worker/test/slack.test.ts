import { describe, expect, it } from "vitest";
import { isSlackWebhookUrl, sendSlack } from "../src/notifiers/slack";
import { fakeSlackWebhook } from "./fixtures";

describe("isSlackWebhookUrl", () => {
  it("accepts a real webhook shape", () => {
    expect(
      isSlackWebhookUrl(fakeSlackWebhook())
    ).toBe(true);
  });

  it.each([
    "http://hooks.slack.com/services/T0/B0/XXXX",
    "https://example.com/services/T0/B0/XXXX",
    "https://hooks.slack.com.evil.com/services/T0/B0/XXXX",
    "https://hooks.slack.com@evil.com/services/T0/B0/XXXX",
    "https://hooks.slack.com:8443/services/T0/B0/XXXX",
    "https://hooks.slack.com/other/T0/B0/XXXX",
    "https://hooks.slack.com/services/T0/B0/XXXX?x=1",
    "https://169.254.169.254/services/T0/B0/XXXX",
    "not-a-url",
  ])("rejects %s", (value) => {
    expect(isSlackWebhookUrl(value)).toBe(false);
  });
});

describe("sendSlack", () => {
  it("refuses a disallowed host without any network access", async () => {
    const result = await sendSlack("https://example.com/services/T0/B0/XXXX", "hi");
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
  });
});
