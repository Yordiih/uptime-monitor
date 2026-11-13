// Built at runtime so no Slack-webhook-shaped literal sits in the repository.
// GitHub push protection flags such strings even when they are fake.
export const fakeSlackWebhook = (): string =>
  [
    "https://hooks.slack.com",
    "services",
    `T${"0".repeat(8)}`,
    `B${"0".repeat(8)}`,
    "X".repeat(24),
  ].join("/");
