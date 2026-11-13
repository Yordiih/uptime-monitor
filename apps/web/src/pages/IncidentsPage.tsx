import { useCallback, useEffect, useState } from "react";
import { describeError, listIncidents, type Incident } from "../api";
import { formatDateTime, formatDuration } from "../format";

type Filter = "all" | "open" | "resolved";

export default function IncidentsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setIncidents(
        await listIncidents({ status: filter === "all" ? undefined : filter, limit: 100 })
      );
      setError(null);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <>
      <h2>Incidents</h2>
      <div className="filter" role="group" aria-label="Filter incidents">
        {(["all", "open", "resolved"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {value}
          </button>
        ))}
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p>Loading...</p>}
      {!loading && incidents.length === 0 && (
        <p className="muted">No incidents. Nothing has gone down.</p>
      )}

      <ul className="monitor-list">
        {incidents.map((incident) => (
          <li key={incident._id} className="card incident">
            <span className={`badge ${incident.open ? "down" : "up"}`}>
              {incident.open ? "ongoing" : "resolved"}
            </span>
            <div className="monitor-info">
              <strong>{incident.monitorName ?? "Deleted monitor"}</strong>
              <span className="muted">
                {incident.lastError ?? "check failed"}
                {incident.lastStatusCode ? ` (HTTP ${incident.lastStatusCode})` : ""}
              </span>
            </div>
            <div className="monitor-meta muted">
              <span>started {formatDateTime(incident.startedAt)}</span>
              <span>
                {incident.open ? "down for " : "downtime "}
                {formatDuration(incident.durationMs)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
