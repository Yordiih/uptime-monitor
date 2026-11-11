export interface IncidentInfo {
  id: string;
  startedAt: Date;
  resolvedAt?: Date | null;
  lastError?: string | null;
  lastStatusCode?: number | null;
}

export interface MonitorInfo {
  id: string;
  owner: { toString(): string };
  name: string;
  url: string;
}

export interface Message {
  subject: string;
  text: string;
  slack: string;
}

// strips control characters (header and log injection) and limits the length
export function clean(value: string, max = 200): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);
}

// Slack requires & < > to be escaped, which also stops <!channel> style mentions
export function slackEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// only the host is shown: full URLs can contain tokens
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown host";
  }
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function buildIncidentMessage(
  event: "opened" | "resolved",
  incident: IncidentInfo,
  monitor: MonitorInfo
): Message {
  const name = clean(monitor.name, 100);
  const host = hostnameOf(monitor.url);

  if (event === "opened") {
    const reason = clean(incident.lastError ?? "check failed");
    const started = incident.startedAt.toISOString();
    return {
      subject: `[DOWN] ${name}`,
      text: `${name} (${host}) is down.\n\nReason: ${reason}\nStarted: ${started}\n`,
      slack: `:red_circle: *Down:* ${slackEscape(name)} (${slackEscape(host)})\nReason: ${slackEscape(reason)}\nStarted: ${started}`,
    };
  }

  const end = incident.resolvedAt ?? new Date();
  const duration = formatDuration(end.getTime() - incident.startedAt.getTime());
  return {
    subject: `[RECOVERED] ${name}`,
    text: `${name} (${host}) is back up.\n\nDowntime: ${duration}\nResolved: ${end.toISOString()}\n`,
    slack: `:large_green_circle: *Recovered:* ${slackEscape(name)} (${slackEscape(host)})\nDowntime: ${duration}`,
  };
}

export function buildTestMessage(): Message {
  const text = "This is a test notification from Uptime Monitor. Your alert channel works.";
  return { subject: "Uptime Monitor test notification", text, slack: `:white_check_mark: ${text}` };
}
