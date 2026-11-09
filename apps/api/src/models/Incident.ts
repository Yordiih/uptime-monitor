import { Schema, model } from "mongoose";

const incidentSchema = new Schema(
  {
    monitor: { type: Schema.Types.ObjectId, ref: "Monitor", required: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    open: { type: Boolean, default: true },
    startedAt: { type: Date, required: true },
    resolvedAt: { type: Date },
    lastError: { type: String },
    lastStatusCode: { type: Number },
  },
  { timestamps: true }
);

// at most one open incident per monitor, enforced by the database
incidentSchema.index(
  { monitor: 1 },
  { unique: true, partialFilterExpression: { open: true } }
);
incidentSchema.index({ monitor: 1, startedAt: -1 });
incidentSchema.index({ owner: 1, startedAt: -1 });
// resolved incidents are deleted after 90 days (open ones have no resolvedAt)
incidentSchema.index({ resolvedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Incident = model("Incident", incidentSchema);
