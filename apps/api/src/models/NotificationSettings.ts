import { Schema, model } from "mongoose";

const notificationSettingSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    slackEnabled: { type: Boolean, default: false },
    slackWebhookUrl: { type: String },
    emailEnabled: { type: Boolean, default: false },
    // daily email budget, maintained by the worker
    emailWindowStart: { type: Date },
    emailCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const NotificationSettings = model(
  "NotificationSetting",
  notificationSettingSchema,
  "notification_settings"
);
