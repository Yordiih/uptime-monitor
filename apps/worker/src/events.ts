import { log } from "./log";
import { incidentsTotal } from "./metrics";

interface IncidentInfo {
  id: string;
  startedAt: Date;
  resolvedAt?: Date | null;
  lastError?: string | null;
  lastStatusCode?: number | null;
}

interface MonitorInfo {
  id: string;
}

// Hook points: the notification channels attach here in the next branch.
// Only ids are logged, never URLs or webhook addresses.
export function incidentOpened(incident: IncidentInfo, monitor: MonitorInfo): void {
  incidentsTotal.inc({ event: "opened" });
  log("warn", "incident opened", {
    incidentId: incident.id,
    monitorId: monitor.id,
    error: incident.lastError ?? undefined,
    statusCode: incident.lastStatusCode ?? undefined,
  });
}

export function incidentResolved(incident: IncidentInfo, monitor: MonitorInfo): void {
  incidentsTotal.inc({ event: "resolved" });
  const durationMs =
    incident.resolvedAt ? incident.resolvedAt.getTime() - incident.startedAt.getTime() : undefined;
  log("info", "incident resolved", {
    incidentId: incident.id,
    monitorId: monitor.id,
    durationMs,
  });
}
