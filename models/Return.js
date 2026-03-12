const mongoose = require("mongoose");

const returnSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["requested", "approved", "rejected", "picked_up", "received", "refunded"],
      default: "requested",
      index: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    adminNote: {
      type: String,
      trim: true,
      default: "",
    },
    stockRestored: {
      type: Boolean,
      default: false,
    },
    refundStatus: {
      type: String,
      enum: ["n_a", "pending", "processing", "completed", "declined"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

returnSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Return", returnSchema);