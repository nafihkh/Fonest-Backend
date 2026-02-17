const mongoose = require("mongoose");

const refreshSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  tokenHash: { type: String, required: false},

  deviceName: { type: String },
  ip: { type: String },
  userAgent: { type: String },

  isRevoked: { type: Boolean, default: false },

  expiresAt: { type: Date, required: true },

  lastUsedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model("RefreshSession", refreshSessionSchema);