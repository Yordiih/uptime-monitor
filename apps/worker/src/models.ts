import { Schema, model } from "mongoose";

// Minimal copy of the API's Monitor schema (same "monitors" collection).
// Later this can move into a shared workspace package.
const monitorSchema = new Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    intervalMinutes: { type: Number, default: 5 },
    expectedStatus: { type: Number, default: 200 },
    paused: { type: Boolean, default: false },
    lastCheckedAt: { type: Date },
    lastStatus: { type: String, enum: ["up", "down"] },
    lastResponseTimeMs: { type: Number },
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
