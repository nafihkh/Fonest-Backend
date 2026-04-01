const mongoose = require("mongoose");

const otpRateLimitSchema = new mongoose.Schema(
  {
    contact: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: String, // Format: YYYY-MM-DD
      required: true,
      index: true,
    },
    count: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

// Optional: Automatically delete documents older than a few days to save space
// Creating a TTL index on createdAt for 2 days (172800 seconds)
otpRateLimitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

module.exports = mongoose.model("OtpRateLimit", otpRateLimitSchema);
