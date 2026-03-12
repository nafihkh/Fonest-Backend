const mongoose = require("mongoose");

const userSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    appearance: {
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "system",
      },
    },

    notifications: {
      stockAlerts: { type: Boolean, default: true },
      outOfStockAlerts: { type: Boolean, default: true },
      returnRequests: { type: Boolean, default: true },
      dailySalesSummary: { type: Boolean, default: true },
      systemUpdates: { type: Boolean, default: true },
    },

    security: {
      twoFactorEnabled: { type: Boolean, default: false },
      loginAlerts: { type: Boolean, default: true },
      sessionTimeoutMinutes: { type: Number, default: 30, min: 5, max: 1440 },
      profileVisibility: {
        type: String,
        enum: ["private", "team", "public"],
        default: "private",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserSettings", userSettingsSchema);