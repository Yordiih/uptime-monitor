import { describe, expect, it } from "vitest";
import {
  buildIncidentMessage,
  clean,
  formatDuration,
  hostnameOf,
  slackEscape,
} from "../src/messages";

const monitor = {
  id: "m1",
  owner: "o1",
  name: "Example",
  url: "https://example.com/private/path?token=SECRET",
};

describe("messages", () => {
  it("shows the host but never the full URL", () => {
    const message = buildIncidentMessage(
      "opened",
      { id: "i1", startedAt: new Date("2026-11-01T10:00:00Z"), lastError: "timeout" },
      monitor
    );
    for (const text of [message.subject, message.text, message.slack]) {
      expect(text).not.toContain("SECRET");
      expect(text).not.toContain("/private/path");
    }
    expect(message.text).toContain("example.com");
    expect(message.subject).toBe("[DOWN] Example");
  });

  it("neutralises Slack mentions in monitor names", () => {
    const message = buildIncidentMessage(
      "opened",
      { id: "i1", startedAt: new Date() },
      { ...monitor, name: "<!channel> & co" }
    );
    expect(message.slack).toContain("&lt;!channel&gt; &amp; co");
    expect(message.slack).not.toContain("<!channel>");
  });

  it("builds a recovery message with the downtime", () => {
    const started = new Date("2026-11-01T10:00:00Z");
    const resolved = new Date("2026-11-01T10:05:30Z");
    const message = buildIncidentMessage(
      "resolved",
      { id: "i1", startedAt: started, resolvedAt: resolved },
      monitor
    );
    expect(message.subject).toBe("[RECOVERED] Example");
    expect(message.text).toContain("5m 30s");
  });

  it("removes control characters so subjects cannot be split", () => {
    expect(clean("a\r\nBcc: x@evil.com")).not.toMatch(/[\r\n]/);
  });

  it.each([
    [0, "0s"],
    [59_000, "59s"],
    [61_000, "1m 1s"],
    [3_660_000, "1h 1m"],
    [-5, "0s"],
  ])("formats %i ms as %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });

  it("escapes Slack control characters", () => {
    expect(slackEscape("<a> & <b>")).toBe("&lt;a&gt; &amp; &lt;b&gt;");
  });

  it("copes with an unparseable URL", () => {
    expect(hostnameOf("not a url")).toBe("unknown host");
  });
});
