const Order = require("../models/Order");

exports.generateOrderNumber = async () => {
  const count = await Order.countDocuments();
  const next = count + 1;
  return `FONEST-ORD-${String(next).padStart(6, "0")}`;
};
