import { Schema, model } from "mongoose";

// Minimal copy of the API's schemas (same collections).
// Later this can move into a shared workspace package.
const monitorSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    intervalMinutes: { type: Number, default: 5 },
    expectedStatus: { type: Number, default: 200 },
    paused: { type: Boolean, default: false },
    lastCheckedAt: { type: Date },
    lastStatus: { type: String, enum: ["up", "down"] },
    lastResponseTimeMs: { type: Number },
    state: { type: String, enum: ["up", "down"] },
    failureStreak: { type: Number, default: 0 },
    firstFailureAt: { type: Date },
  },
  { timestamps: true }
);

export const Monitor = model("Monitor", monitorSchema);

const checkResultSchema = new Schema({
  monitor: { type: Schema.Types.ObjectId, ref: "Monitor", required: true },
  checkedAt: { type: Date, required: true, default: Date.now },
  up: { type: Boolean, required: true },
  statusCode: { type: Number },
  responseTimeMs: { type: Number },
  error: { type: String },
});

// history queries: latest results for one monitor
checkResultSchema.index({ monitor: 1, checkedAt: -1 });
// retention: MongoDB deletes results older than 30 days automatically
checkResultSchema.index({ checkedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const CheckResult = model("CheckResult", checkResultSchema);

const incidentSchema = new Schema(
  {
    monitor: { type: Schema.Types.ObjectId, ref: "Monitor", required: true },
    owner: { type: Schema.Types.ObjectId, required: true },
    open: { type: Boolean, default: true },
    startedAt: { type: Date, required: true },
    resolvedAt: { type: Date },
    lastError: { type: String },
    lastStatusCode: { type: Number },
  },
  { timestamps: true }
);

// must stay identical to the API's definitions
incidentSchema.index(
  { monitor: 1 },
  { unique: true, partialFilterExpression: { open: true } }
);
incidentSchema.index({ monitor: 1, startedAt: -1 });
incidentSchema.index({ owner: 1, startedAt: -1 });
incidentSchema.index({ resolvedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Incident = model("Incident", incidentSchema);
