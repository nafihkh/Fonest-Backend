const mongoose = require("mongoose");

const returnItemSchema = new mongoose.Schema(
  {
    returnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Return",
      required: true,
      index: true,
    },
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrderItem",
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReturnItem", returnItemSchema);