type Level = "info" | "warn" | "error";

// One JSON object per line: easy for Loki to parse later.
export function log(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields }));
}
