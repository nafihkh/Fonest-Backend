const mongoose = require("mongoose");

const stockEntrySchema = new mongoose.Schema(
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

    quantityAdded: {
      type: Number,
      required: true,
      min: 1,
    },

    supplier: {
      type: String,
      trim: true,
      default: "",
    },

    reference: {
      type: String,
      trim: true,
      default: "",
    },

    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

stockEntrySchema.index({ createdAt: -1 });
stockEntrySchema.index({ productId: 1, createdAt: -1 });

module.exports = mongoose.model("StockEntry", stockEntrySchema);