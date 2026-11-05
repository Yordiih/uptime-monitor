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
