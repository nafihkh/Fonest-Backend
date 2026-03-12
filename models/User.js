const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, minlength: 2, maxlength: 60 },

    email: { type: String, lowercase: true, trim: true, sparse: true, unique: true },

    phone: { type: String, trim: true, sparse: true, unique: true },

    authProvider: { type: String, enum: ["otp", "google"], default: "otp", required: true },

    googleId: { type: String, sparse: true, unique: true },

    role: { type: String, enum: ["admin", "customer"], default: "customer" },

    profilePhoto: { type: String },

    status: { type: String, enum: ["active", "suspended"], default: "active" },

    isVerified: { type: Boolean, default: false },
    avatar: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    lastActive: { type: Date, default: null },

    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);