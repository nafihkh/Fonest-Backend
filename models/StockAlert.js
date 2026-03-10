const mongoose = require("mongoose");

const stockAlertSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    alertType: {
      type: String,
      enum: ["low_stock", "out_of_stock"],
      required: true,
      index: true,
    },

    threshold: {
      type: Number,
      required: true,
      default: 0,
    },

    currentStock: {
      type: Number,
      required: true,
      default: 0,
    },

    isResolved: {
      type: Boolean,
      default: false,
      index: true,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

stockAlertSchema.index({ productId: 1, alertType: 1, isResolved: 1 });

module.exports = mongoose.model("StockAlert", stockAlertSchema);