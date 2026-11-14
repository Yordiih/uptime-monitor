export interface Monitor {
  _id: string;
  name: string;
  url: string;
  intervalMinutes: number;
  expectedStatus: number;
  paused: boolean;
  lastCheckedAt?: string;
  lastStatus?: "up" | "down";
  lastResponseTimeMs?: number;
}

const TOKEN_KEY = "uptime_token";

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage can be unavailable (private mode) */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: { path: string; message: string }[];

  constructor(status: number, code: string, details?: { path: string; message: string }[]) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 204) {
    return undefined as T;
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // an expired or invalid token while logged in: send the user to the login page
    if (res.status === 401 && token) {
      onUnauthorized();
    }
    throw new ApiError(res.status, body.error ?? "request_failed", body.details);
  }
  return body as T;
}

export const register = (email: string, password: string) =>
  request<{ token: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const login = (email: string, password: string) =>
  request<{ token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const listMonitors = () => request<Monitor[]>("/monitors");

export const createMonitor = (input: { name: string; url: string; intervalMinutes: number }) =>
  request<Monitor>("/monitors", { method: "POST", body: JSON.stringify(input) });

export const updateMonitor = (id: string, changes: { paused?: boolean }) =>
  request<Monitor>(`/monitors/${id}`, { method: "PATCH", body: JSON.stringify(changes) });

export const deleteMonitor = (id: string) =>
  request<void>(`/monitors/${id}`, { method: "DELETE" });

export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return "Too many attempts. Please wait a few minutes and try again.";
    }
    switch (err.code) {
      case "invalid_credentials":
        return "Wrong email or password.";
      case "email_taken":
        return "That email is already registered.";
      case "slack_webhook_required":
        return "Add a Slack webhook URL first.";
      case "test_already_pending":
        return "A test is already being sent. Please wait a moment.";
      case "monitor_limit_reached":
        return "You reached the limit of 20 monitors.";
      case "validation_error":
        return (
          err.details?.map((d) => `${d.path}: ${d.message}`).join(", ") ||
          "Please check the form values."
        );
      default:
        return "Something went wrong. Please try again.";
    }
  }
  return "Cannot reach the server.";
}

export interface TestStatus {
  status: "pending" | "processing" | "sent" | "failed";
  error: string | null;
  at: string;
}

export interface NotificationSettings {
  slack: { enabled: boolean; configured: boolean; webhookHint: string | null };
  email: { enabled: boolean; address: string | null };
  lastTests: { slack: TestStatus | null; email: TestStatus | null };
}

export interface Incident {
  _id: string;
  monitorId: string;
  monitorName: string | null;
  open: boolean;
  startedAt: string;
  resolvedAt: string | null;
  durationMs: number;
  lastError: string | null;
  lastStatusCode: number | null;
}

export const getNotificationSettings = () =>
  request<NotificationSettings>("/notifications/settings");

export const updateNotificationSettings = (changes: {
  slack?: { enabled?: boolean; webhookUrl?: string | null };
  email?: { enabled?: boolean };
}) =>
  request<NotificationSettings>("/notifications/settings", {
    method: "PUT",
    body: JSON.stringify(changes),
  });

export const sendTestNotification = (channel: "slack" | "email") =>
  request<{ id: string; status: string }>("/notifications/test", {
    method: "POST",
    body: JSON.stringify({ channel }),
  });

export const listIncidents = (
  params: { status?: "open" | "resolved"; monitor?: string; limit?: number } = {}
) => {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.monitor) query.set("monitor", params.monitor);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return request<Incident[]>(`/incidents${qs ? `?${qs}` : ""}`);
};

export type Range = "24h" | "7d" | "30d";

export interface SeriesPoint {
  t: number;
  checks: number;
  up: number;
  avgMs: number | null;
}

export interface MonitorStats {
  range: Range;
  from: number;
  to: number;
  bucketMs: number;
  summary: {
    checks: number;
    up: number;
    uptimePercent: number | null;
    avgResponseMs: number | null;
    maxResponseMs: number | null;
    incidents: number;
  };
  series: SeriesPoint[];
}

export interface CheckEntry {
  _id: string;
  checkedAt: string;
  up: boolean;
  statusCode: number | null;
  responseTimeMs: number | null;
  error: string | null;
}

export const getMonitor = (id: string) =>
  request<Monitor>(`/monitors/${encodeURIComponent(id)}`);

export const getMonitorStats = (id: string, range: Range) =>
  request<MonitorStats>(`/monitors/${encodeURIComponent(id)}/stats?range=${range}`);

export const getMonitorChecks = (id: string, limit = 50) =>
  request<CheckEntry[]>(`/monitors/${encodeURIComponent(id)}/checks?limit=${limit}`);
