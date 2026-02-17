const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    contact: { type: String, required: true }, // email or phone
    codeHash: { type: String, required: true },
    purpose: { type: String, enum: ["login"], default: "login" },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ contact: 1, purpose: 1 }, { unique: true });

module.exports = mongoose.model("Otp", otpSchema);