import { log } from "./log";
import type { IncidentInfo, MonitorInfo } from "./messages";
import { incidentsTotal } from "./metrics";
import { notifyIncident } from "./notify";

// Only ids are logged, never URLs or webhook addresses.
export function incidentOpened(incident: IncidentInfo, monitor: MonitorInfo): void {
  incidentsTotal.inc({ event: "opened" });
  log("warn", "incident opened", {
    incidentId: incident.id,
    monitorId: monitor.id,
    error: incident.lastError ?? undefined,
    statusCode: incident.lastStatusCode ?? undefined,
  });
  notifyIncident("opened", incident, monitor);
}

export function incidentResolved(incident: IncidentInfo, monitor: MonitorInfo): void {
  incidentsTotal.inc({ event: "resolved" });
  const durationMs = incident.resolvedAt
    ? incident.resolvedAt.getTime() - incident.startedAt.getTime()
    : undefined;
  log("info", "incident resolved", {
    incidentId: incident.id,
    monitorId: monitor.id,
    durationMs,
  });
  notifyIncident("resolved", incident, monitor);
}
