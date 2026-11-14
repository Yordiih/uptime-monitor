import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ApiError,
  describeError,
  getMonitor,
  getMonitorChecks,
  getMonitorStats,
  listIncidents,
  type CheckEntry,
  type Incident,
  type Monitor,
  type MonitorStats,
  type Range,
} from "../api";
import ResponseChart from "../components/ResponseChart";
import { formatDateTime, formatDuration } from "../format";
import { statusOf } from "../monitorView";

const RANGES: Range[] = ["24h", "7d", "30d"];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card stat">
      <span className="stat-value">{value}</span>
      <span className="muted">{label}</span>
    </div>
  );
}

export default function MonitorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [range, setRange] = useState<Range>("24h");
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [checks, setChecks] = useState<CheckEntry[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load(monitorId: string) {
      try {
        const [m, s, c, i] = await Promise.all([
          getMonitor(monitorId),
          getMonitorStats(monitorId, range),
          getMonitorChecks(monitorId, 50),
          listIncidents({ monitor: monitorId, limit: 10 }),
        ]);
        if (cancelled) return;
        setMonitor(m);
        setStats(s);
        setChecks(c);
        setIncidents(i);
        setError(null);
        setNotFound(false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError(describeError(err));
      }
    }

    void load(id);
    const timer = setInterval(() => void load(id), 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, range]);

  if (notFound) {
    return (
      <>
        <p className="muted">This monitor does not exist (or was deleted).</p>
        <Link to="/">Back to monitors</Link>
      </>
    );
  }
  if (!monitor || !stats) {
    return error ? (
      <p className="error" role="alert">{error}</p>
    ) : (
      <p>Loading...</p>
    );
  }

  const status = statusOf(monitor);
  const { summary } = stats;

  return (
    <>
      <p>
        <Link to="/">&larr; All monitors</Link>
      </p>
      <div className="detail-head">
        <span className={`badge ${status}`}>{status}</span>
        <div className="monitor-info">
          <h2>{monitor.name}</h2>
          <span className="muted">{monitor.url}</span>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="filter" role="group" aria-label="Time range">
        {RANGES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={range === value}
            onClick={() => setRange(value)}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="cards">
        <Stat
          label="Uptime"
          value={summary.uptimePercent !== null ? `${summary.uptimePercent}%` : "-"}
        />
        <Stat
          label="Avg response"
          value={summary.avgResponseMs !== null ? `${summary.avgResponseMs} ms` : "-"}
        />
        <Stat
          label="Slowest"
          value={summary.maxResponseMs !== null ? `${summary.maxResponseMs} ms` : "-"}
        />
        <Stat label="Checks" value={String(summary.checks)} />
        <Stat label="Incidents" value={String(summary.incidents)} />
      </div>
      <p className="muted small">
        Uptime is the share of successful checks in the range, not time-weighted. Response
        times count successful checks only. Check history is kept for 30 days.
      </p>

      <section className="card">
        <h2>Response time</h2>
        <ResponseChart series={stats.series} from={stats.from} to={stats.to} />
        <p className="muted small">Red bands mark periods with failed checks.</p>
      </section>

      <section className="card">
        <h2>Recent incidents</h2>
        {incidents.length === 0 ? (
          <p className="muted">No incidents for this monitor.</p>
        ) : (
          <ul className="plain-list">
            {incidents.map((incident) => (
              <li key={incident._id}>
                <span className={`badge ${incident.open ? "down" : "up"}`}>
                  {incident.open ? "ongoing" : "resolved"}
                </span>{" "}
                {formatDateTime(incident.startedAt)} &middot;{" "}
                {incident.open ? "down for " : "downtime "}
                {formatDuration(incident.durationMs)}
                {incident.lastError ? ` · ${incident.lastError}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Check history</h2>
        {checks.length === 0 ? (
          <p className="muted">No checks recorded yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="history">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Result</th>
                  <th>Status</th>
                  <th>Response</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((check) => (
                  <tr key={check._id}>
                    <td>{formatDateTime(check.checkedAt)}</td>
                    <td>
                      <span className={`badge ${check.up ? "up" : "down"}`}>
                        {check.up ? "up" : "down"}
                      </span>
                    </td>
                    <td>{check.statusCode ?? "-"}</td>
                    <td>{check.responseTimeMs !== null ? `${check.responseTimeMs} ms` : "-"}</td>
                    <td>{check.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
