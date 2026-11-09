import client from "prom-client";

client.collectDefaultMetrics();

// No per-monitor labels on purpose: labels like monitor id or URL
// create one time series per monitor (high cardinality).
export const checksTotal = new client.Counter({
  name: "uptime_checks_total",
  help: "Completed uptime checks",
  labelNames: ["result"],
});

export const checkDuration = new client.Histogram({
  name: "uptime_check_duration_seconds",
  help: "Duration of uptime checks",
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const activeMonitors = new client.Gauge({
  name: "uptime_monitors_active",
  help: "Number of monitors that are not paused",
});

// Lets Prometheus alert when the worker stops ticking.
export const lastTick = new client.Gauge({
  name: "uptime_worker_last_tick_timestamp_seconds",
  help: "Unix time of the last completed scheduler tick",
});

export const incidentsTotal = new client.Counter({
  name: "uptime_incidents_total",
  help: "Incidents opened and resolved",
  labelNames: ["event"],
});

export const incidentsOpen = new client.Gauge({
  name: "uptime_incidents_open",
  help: "Number of currently open incidents",
});
