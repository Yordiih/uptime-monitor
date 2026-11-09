import type { CheckOutcome } from "./checker";
import { config } from "./config";
import { incidentOpened, incidentResolved } from "./events";
import { Incident, Monitor } from "./models";

// Applies one check result to the monitor's state and opens or resolves incidents.
export async function recordResult(
  monitorId: string,
  outcome: CheckOutcome,
  threshold: number = config.failureThreshold
): Promise<void> {
  const now = new Date();

  if (outcome.up) {
    const before = await Monitor.findOneAndUpdate(
      { _id: monitorId },
      {
        $set: {
          lastStatus: "up",
          lastResponseTimeMs: outcome.responseTimeMs,
          state: "up",
          failureStreak: 0,
        },
        $unset: { firstFailureAt: 1 },
      },
      { returnDocument: "before" }
    );
    if (before?.state === "down") {
      const incident = await Incident.findOneAndUpdate(
        { monitor: monitorId, open: true },
        { $set: { open: false, resolvedAt: now } },
        { returnDocument: "after" }
      );
      if (incident) incidentResolved(incident, before);
    }
    return;
  }

  const after = await Monitor.findOneAndUpdate(
    { _id: monitorId },
    {
      $set: { lastStatus: "down", lastResponseTimeMs: outcome.responseTimeMs },
      $inc: { failureStreak: 1 },
    },
    { returnDocument: "after" }
  );
  if (!after) return; // the monitor was deleted meanwhile

  if (after.failureStreak === 1) {
    after.firstFailureAt = now;
    await Monitor.updateOne({ _id: monitorId }, { $set: { firstFailureAt: now } });
  }
  if ((after.failureStreak ?? 0) < threshold) return;

  // only one caller wins this state change
  const moved = await Monitor.findOneAndUpdate(
    { _id: monitorId, state: { $ne: "down" } },
    { $set: { state: "down" } }
  );
  if (!moved) return;

  try {
    const incident = await Incident.create({
      monitor: after._id,
      owner: after.owner,
      startedAt: after.firstFailureAt ?? now,
      lastError: outcome.error,
      lastStatusCode: outcome.statusCode,
    });
    incidentOpened(incident, after);
  } catch (err) {
    // the unique partial index says an incident is already open
    if ((err as { code?: number }).code !== 11000) throw err;
  }
}
