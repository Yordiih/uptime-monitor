import { useState, type FormEvent } from "react";
import { createMonitor, describeError, type Monitor } from "../api";

export default function AddMonitorForm({
  onCreated,
}: {
  onCreated: (monitor: Monitor) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const monitor = await createMonitor({ name, url, intervalMinutes });
      onCreated(monitor);
      setName("");
      setUrl("");
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <h2>Add a monitor</h2>
      <div className="form-row">
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
        />
        <input
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <select
          value={intervalMinutes}
          onChange={(e) => setIntervalMinutes(Number(e.target.value))}
          aria-label="Check interval"
        >
          <option value={1}>Every 1 min</option>
          <option value={5}>Every 5 min</option>
          <option value={15}>Every 15 min</option>
        </select>
        <button type="submit" disabled={busy}>
          {busy ? "Adding..." : "Add"}
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
