import type { Monitor } from "./api";

export type Status = "up" | "down" | "paused" | "pending";
export type StatusFilter = "all" | Status;
export type SortKey = "newest" | "name" | "status" | "slowest";

export function statusOf(monitor: Monitor): Status {
  if (monitor.paused) return "paused";
  return monitor.lastStatus ?? "pending";
}

export interface Summary {
  total: number;
  up: number;
  down: number;
  paused: number;
  pending: number;
  avgResponseMs: number | null;
}

export function summarize(monitors: Monitor[]): Summary {
  const summary: Summary = {
    total: monitors.length,
    up: 0,
    down: 0,
    paused: 0,
    pending: 0,
    avgResponseMs: null,
  };
  const times: number[] = [];
  for (const monitor of monitors) {
    const status = statusOf(monitor);
    summary[status] += 1;
    if (status === "up" && monitor.lastResponseTimeMs !== undefined) {
      times.push(monitor.lastResponseTimeMs);
    }
  }
  if (times.length > 0) {
    summary.avgResponseMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  }
  return summary;
}

const STATUS_ORDER: Record<Status, number> = { down: 0, pending: 1, up: 2, paused: 3 };

export function filterAndSort(
  monitors: Monitor[],
  options: { query: string; status: StatusFilter; sort: SortKey }
): Monitor[] {
  const query = options.query.trim().toLowerCase();
  const filtered = monitors.filter(
    (monitor) =>
      (options.status === "all" || statusOf(monitor) === options.status) &&
      (query === "" ||
        monitor.name.toLowerCase().includes(query) ||
        monitor.url.toLowerCase().includes(query))
  );
  switch (options.sort) {
    case "name":
      return filtered.sort((a, b) => a.name.localeCompare(b.name));
    case "status":
      return filtered.sort((a, b) => STATUS_ORDER[statusOf(a)] - STATUS_ORDER[statusOf(b)]);
    case "slowest":
      return filtered.sort(
        (a, b) => (b.lastResponseTimeMs ?? -1) - (a.lastResponseTimeMs ?? -1)
      );
    default:
      return filtered; // "newest": the API already returns newest first
  }
}
