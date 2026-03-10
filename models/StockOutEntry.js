const mongoose = require("mongoose");

const stockOutEntrySchema = new mongoose.Schema(
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

    quantityRemoved: {
      type: Number,
      required: true,
      min: 1,
    },

    reason: {
      type: String,
      trim: true,
      enum: ["sale", "damaged", "adjustment", "return_out", "manual"],
      default: "manual",
    },

    reference: {
      type: String,
      trim: true,
      default: "",
    },

    removedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

stockOutEntrySchema.index({ createdAt: -1 });
stockOutEntrySchema.index({ productId: 1, createdAt: -1 });

module.exports = mongoose.model("StockOutEntry", stockOutEntrySchema);