import { checkUrl } from "./checker";
import { recordResult } from "./incidents";
import { processTestRequests, track } from "./notify";
import { log } from "./log";
import {
  activeMonitors,
  checkDuration,
  checksTotal,
  incidentsOpen,
} from "./metrics";
import { CheckResult, Incident, Monitor } from "./models";

const CONCURRENCY = 10;
const RETRY_DELAY_MS = 2_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

interface CheckTarget {
  id: string;
  url: string;
  expectedStatus: number;
}

async function runCheck(target: CheckTarget): Promise<void> {
  let outcome = await checkUrl(target.url, target.expectedStatus);

  // blocked targets can never succeed, so do not wait and retry them
  const permanent =
    outcome.error?.startsWith("blocked") || outcome.error === "unsupported protocol";
  if (!outcome.up && !permanent) {
    // retry once before counting the failure, to avoid false alarms
    await sleep(RETRY_DELAY_MS);
    outcome = await checkUrl(target.url, target.expectedStatus);
  }

  const result = outcome.up ? "up" : "down";
  checksTotal.inc({ result });
  checkDuration.observe(outcome.responseTimeMs / 1000);

  await CheckResult.create({
    monitor: target.id,
    up: outcome.up,
    statusCode: outcome.statusCode,
    responseTimeMs: outcome.responseTimeMs,
    error: outcome.error,
  });
  await recordResult(target.id, outcome);

  // the monitor id is logged, never the URL (URLs can contain secrets)
  log("info", "check complete", {
    monitorId: target.id,
    result,
    statusCode: outcome.statusCode,
    responseTimeMs: outcome.responseTimeMs,
    error: outcome.error,
  });
}

export async function tick(): Promise<void> {
  track(processTestRequests());
  const monitors = await Monitor.find({ paused: false });
  activeMonitors.set(monitors.length);
  incidentsOpen.set(await Incident.countDocuments({ open: true }));

  const now = Date.now();
  const due = monitors.filter(
    (m) =>
      !m.lastCheckedAt ||
      m.lastCheckedAt.getTime() + (m.intervalMinutes ?? 5) * 60_000 <= now
  );

  await mapLimit(due, CONCURRENCY, async (m) => {
    try {
      // Optimistic claim: only one worker replica wins this update,
      // so running several replicas does not double-check a monitor.
      const claimed = await Monitor.findOneAndUpdate(
        { _id: m._id, paused: false, lastCheckedAt: m.lastCheckedAt ?? null },
        { $set: { lastCheckedAt: new Date() } }
      );
      if (!claimed) return;

      await runCheck({ id: m.id, url: m.url, expectedStatus: m.expectedStatus ?? 200 });
    } catch (err) {
      log("error", "check failed unexpectedly", { monitorId: m.id, error: String(err) });
    }
  });
}
