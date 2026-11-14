import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  filterAndSort,
  statusOf,
  summarize,
  type SortKey,
  type StatusFilter,
} from "../monitorView";

export default function Dashboard() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [openIncidents, setOpenIncidents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");

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

  const summary = useMemo(() => summarize(monitors), [monitors]);
  const visible = useMemo(
    () => filterAndSort(monitors, { query, status: statusFilter, sort }),
    [monitors, query, statusFilter, sort]
  );

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
          <Link to="/app/incidents">View incidents</Link>
        </p>
      )}

      <div className="cards">
        <div className="card stat">
          <span className="stat-value">{summary.total}</span>
          <span className="muted">Monitors</span>
        </div>
        <div className="card stat">
          <span className="stat-value up-text">{summary.up}</span>
          <span className="muted">Up</span>
        </div>
        <div className="card stat">
          <span className="stat-value down-text">{summary.down}</span>
          <span className="muted">Down</span>
        </div>
        <div className="card stat">
          <span className="stat-value">{summary.paused}</span>
          <span className="muted">Paused</span>
        </div>
        <div className="card stat">
          <span className="stat-value">
            {summary.avgResponseMs !== null ? `${summary.avgResponseMs} ms` : "-"}
          </span>
          <span className="muted">Avg response</span>
        </div>
      </div>

      <AddMonitorForm onCreated={(monitor) => setMonitors((list) => [monitor, ...list])} />

      <div className="filters">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or URL"
          aria-label="Search monitors"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="up">Up</option>
          <option value="down">Down</option>
          <option value="pending">Pending</option>
          <option value="paused">Paused</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort monitors"
        >
          <option value="newest">Newest first</option>
          <option value="name">Name</option>
          <option value="status">Problems first</option>
          <option value="slowest">Slowest first</option>
        </select>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p>Loading...</p>}
      {!loading && monitors.length === 0 && (
        <p className="muted">No monitors yet. Add your first one above.</p>
      )}
      {!loading && monitors.length > 0 && visible.length === 0 && (
        <p className="muted">No monitors match your filters.</p>
      )}

      <ul className="monitor-list">
        {visible.map((monitor) => {
          const status = statusOf(monitor);
          return (
            <li key={monitor._id} className="card monitor">
              <span className={`badge ${status}`}>{status}</span>
              <div className="monitor-info">
                <Link to={`/app/monitors/${monitor._id}`}>
                  <strong>{monitor.name}</strong>
                </Link>
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
