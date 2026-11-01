import { Schema, model } from "mongoose";

const monitorSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    url: { type: String, required: true },
    intervalMinutes: { type: Number, default: 5 },
    expectedStatus: { type: Number, default: 200 },
    paused: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Monitor = model("Monitor", monitorSchema);
