import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  describeError,
  getNotificationSettings,
  sendTestNotification,
  updateNotificationSettings,
  type NotificationSettings,
  type TestStatus,
} from "../api";

type Channel = "slack" | "email";

const isRunning = (test: TestStatus | null) =>
  test?.status === "pending" || test?.status === "processing";

function TestResult({ test }: { test: TestStatus | null }) {
  if (!test) return <p className="muted">No test sent yet.</p>;
  const when = new Date(test.at).toLocaleString();
  if (test.status === "sent") return <p className="ok">Test delivered ({when}).</p>;
  if (test.status === "failed") {
    return (
      <p className="error">
        Test failed ({when}): {test.error ?? "unknown error"}
      </p>
    );
  }
  return <p className="muted">Sending test... the worker picks requests up within about 15 seconds.</p>;
}

export default function AlertsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [webhook, setWebhook] = useState("");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setSettings(await getNotificationSettings());
      setError(null);
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  useEffect(() => {
    void load();
    return stopPolling;
  }, [load, stopPolling]);

  // checks every 3 seconds for up to a minute, until the test has a result
  const pollTest = useCallback(
    (channel: Channel) => {
      stopPolling();
      let attempts = 0;
      pollTimer.current = setInterval(async () => {
        attempts += 1;
        try {
          const fresh = await getNotificationSettings();
          setSettings(fresh);
          if (!isRunning(fresh.lastTests[channel]) || attempts >= 20) stopPolling();
        } catch {
          stopPolling();
        }
      }, 3_000);
    },
    [stopPolling]
  );

  async function save(changes: Parameters<typeof updateNotificationSettings>[0]): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      setSettings(await updateNotificationSettings(changes));
      return true;
    } catch (err) {
      setError(describeError(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onSaveWebhook(event: FormEvent) {
    event.preventDefault();
    if (await save({ slack: { webhookUrl: webhook.trim() } })) {
      setWebhook(""); // the URL is never kept in the page after saving
    }
  }

  async function removeWebhook() {
    if (!window.confirm("Remove the Slack webhook? Slack alerts will stop.")) return;
    await save({ slack: { webhookUrl: null } });
  }

  async function onTest(channel: Channel) {
    setError(null);
    try {
      await sendTestNotification(channel);
      await load();
      pollTest(channel);
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <>
      <h2>Alerts</h2>
      <p className="muted">
        Get notified when a monitor goes down and when it recovers. Alerts fire only after
        repeated failed checks, so a single blip does not notify you.
      </p>

      {error && <p className="error" role="alert">{error}</p>}
      {!settings && !error && <p>Loading...</p>}

      {settings && (
        <>
          <section className="card">
            <h2>Slack</h2>
            <p className="muted">
              {settings.slack.configured
                ? `Webhook saved (${settings.slack.webhookHint}).`
                : "No webhook saved yet. Create an incoming webhook in your Slack app settings."}
            </p>
            <form className="form-row" onSubmit={onSaveWebhook}>
              <input
                type="password"
                value={webhook}
                onChange={(e) => setWebhook(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                autoComplete="off"
                maxLength={300}
                aria-label="Slack webhook URL"
              />
              <button type="submit" disabled={busy || webhook.trim() === ""}>
                {settings.slack.configured ? "Replace webhook" : "Save webhook"}
              </button>
            </form>
            <label className="setting-row">
              <input
                type="checkbox"
                checked={settings.slack.enabled}
                disabled={busy || !settings.slack.configured}
                onChange={(e) => void save({ slack: { enabled: e.target.checked } })}
              />
              Send Slack alerts
            </label>
            <div className="actions">
              <button
                type="button"
                disabled={!settings.slack.configured || isRunning(settings.lastTests.slack)}
                onClick={() => void onTest("slack")}
              >
                Send test message
              </button>
              {settings.slack.configured && (
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={() => void removeWebhook()}
                >
                  Remove webhook
                </button>
              )}
            </div>
            <TestResult test={settings.lastTests.slack} />
          </section>

          <section className="card">
            <h2>Email</h2>
            <p className="muted">
              Alerts are sent to your account address
              {settings.email.address ? ` (${settings.email.address})` : ""}. A daily limit
              applies, and delivery needs the server&apos;s mail settings to be configured.
            </p>
            <label className="setting-row">
              <input
                type="checkbox"
                checked={settings.email.enabled}
                disabled={busy}
                onChange={(e) => void save({ email: { enabled: e.target.checked } })}
              />
              Send email alerts
            </label>
            <div className="actions">
              <button
                type="button"
                disabled={isRunning(settings.lastTests.email)}
                onClick={() => void onTest("email")}
              >
                Send test email
              </button>
            </div>
            <TestResult test={settings.lastTests.email} />
          </section>
        </>
      )}
    </>
  );
}
