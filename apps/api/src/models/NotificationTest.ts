import { Schema, model } from "mongoose";

// A request for the worker to send a test message. The API never sends anything itself.
const notificationTestSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  channel: { type: String, enum: ["slack", "email"], required: true },
  status: {
    type: String,
    enum: ["pending", "processing", "sent", "failed"],
    default: "pending",
  },
  error: { type: String },
  createdAt: { type: Date, default: Date.now },
});

notificationTestSchema.index({ owner: 1, channel: 1, createdAt: -1 });
// test requests are deleted after one day
notificationTestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const NotificationTest = model(
  "NotificationTest",
  notificationTestSchema,
  "notification_tests"
);
