const WEBHOOK_PATH = /^\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/;

// Accepts only real Slack incoming-webhook URLs. The exact host match also
// rejects look-alikes such as hooks.slack.com.evil.com and user@host tricks.
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
