import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteMonitor,
  describeError,
  listIncidents,
  listMonitors,
  updateMonitor,
  type Monitor,
} from "../api";
import AddMonitorForm from "../components/AddMonitorForm";

function statusOf(monitor: Monitor): "paused" | "up" | "down" | "pending" {
  if (monitor.paused) return "paused";
  return monitor.lastStatus ?? "pending";
}

export default function Dashboard() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [openIncidents, setOpenIncidents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMonitors(await listMonitors());
      setError(null);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
    try {
      setOpenIncidents((await listIncidents({ status: "open", limit: 100 })).length);
    } catch {
      /* the banner is optional: a failure here must not break the monitor list */
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  async function togglePause(monitor: Monitor) {
    try {
      const updated = await updateMonitor(monitor._id, { paused: !monitor.paused });
      setMonitors((list) => list.map((m) => (m._id === updated._id ? updated : m)));
    } catch (err) {
      setError(describeError(err));
    }
  }

  async function remove(monitor: Monitor) {
    if (!window.confirm(`Delete "${monitor.name}"?`)) return;
    try {
      await deleteMonitor(monitor._id);
      setMonitors((list) => list.filter((m) => m._id !== monitor._id));
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <>
      {openIncidents > 0 && (
        <p className="banner down" role="status">
          {openIncidents} open {openIncidents === 1 ? "incident" : "incidents"}.{" "}
          <Link to="/incidents">View incidents</Link>
        </p>
      )}

      <AddMonitorForm onCreated={(monitor) => setMonitors((list) => [monitor, ...list])} />

      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p>Loading...</p>}
      {!loading && monitors.length === 0 && (
        <p className="muted">No monitors yet. Add your first one above.</p>
      )}

      <ul className="monitor-list">
        {monitors.map((monitor) => {
          const status = statusOf(monitor);
          return (
            <li key={monitor._id} className="card monitor">
              <span className={`badge ${status}`}>{status}</span>
              <div className="monitor-info">
                <strong>{monitor.name}</strong>
                <span className="muted">{monitor.url}</span>
              </div>
              <div className="monitor-meta muted">
                <span>
                  {monitor.lastResponseTimeMs !== undefined
                    ? `${monitor.lastResponseTimeMs} ms`
                    : "-"}
                </span>
                <span>every {monitor.intervalMinutes} min</span>
                <span>
                  {monitor.lastCheckedAt
                    ? `checked ${new Date(monitor.lastCheckedAt).toLocaleTimeString()}`
                    : "not checked yet"}
                </span>
              </div>
              <div className="actions">
                <button type="button" onClick={() => togglePause(monitor)}>
                  {monitor.paused ? "Resume" : "Pause"}
                </button>
                <button type="button" className="danger" onClick={() => remove(monitor)}>
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
