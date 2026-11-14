import { Schema, model } from "mongoose";

// Read-only view of the worker's check results (same collection).
// The worker owns the indexes, including the 30-day TTL, so index building is
// switched off here to avoid two services managing the same indexes.
const checkResultSchema = new Schema(
  {
    monitor: { type: Schema.Types.ObjectId, ref: "Monitor", required: true },
    checkedAt: { type: Date, required: true, default: Date.now },
    up: { type: Boolean, required: true },
    statusCode: { type: Number },
    responseTimeMs: { type: Number },
    error: { type: String },
  },
  { autoIndex: false }
);

export const CheckResult = model("CheckResult", checkResultSchema);
