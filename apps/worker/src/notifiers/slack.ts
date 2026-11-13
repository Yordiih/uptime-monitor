import https from "node:https";
import { safeLookup } from "../checker";
import type { SendResult } from "./types";

const WEBHOOK_PATH = /^\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/;

// Same rule as the API: only genuine Slack incoming-webhook URLs.
export function isSlackWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "hooks.slack.com" &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      WEBHOOK_PATH.test(url.pathname)
    );
  } catch {
    return false;
  }
}

// The webhook URL is a secret: it is never logged and never put in an error message.
export function sendSlack(webhookUrl: string, text: string): Promise<SendResult> {
  return new Promise((resolve) => {
    if (!isSlackWebhookUrl(webhookUrl)) {
      resolve({ ok: false, skipped: true, error: "webhook host not allowed" });
      return;
    }
    const body = JSON.stringify({ text });
    const request = https.request(
      new URL(webhookUrl),
      {
        method: "POST",
        lookup: safeLookup,
        agent: false,
        timeout: 8_000,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (response) => {
        response.resume(); // the body is not needed, only the status
        response.on("end", () => {
          resolve(
            response.statusCode === 200
              ? { ok: true }
              : { ok: false, error: `slack responded with ${response.statusCode}` }
          );
        });
      }
    );
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", (err) => resolve({ ok: false, error: err.message.slice(0, 200) }));
    request.end(body);
  });
}
