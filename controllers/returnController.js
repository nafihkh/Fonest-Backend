const mongoose = require("mongoose");
const Return = require("../models/Return");
const ReturnItem = require("../models/ReturnItem");
const Order = require("../models/Order");
const pushService = require("../services/pushNotificationService");

const RETURN_REASONS = [
  "damaged_product",
  "wrong_product",
  "not_as_described",
  "changed_mind",
  "defective_product",
  "other",
];

// POST /api/returns
exports.createReturn = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId, items, reason, description } = req.body;

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Valid orderId is required" });
    }

    if (!reason || !RETURN_REASONS.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: `Reason must be one of: ${RETURN_REASONS.join(", ")}`,
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "At least one item is required" });
    }

    // Verify order belongs to this customer and is delivered
    const order = await Order.findOne({ _id: orderId, userId }).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.orderStatus !== "delivered") {
      return res.status(400).json({
        success: false,
        message: "Only delivered orders can be returned",
      });
    }

    // Check if a return already exists for this order
    const existing = await Return.findOne({ orderId, userId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A return request already exists for this order",
      });
    }

    // Validate each item against the order
    const orderItemMap = {};
    for (const item of order.items) {
      orderItemMap[String(item._id)] = item;
    }

    const validItems = [];
    for (const reqItem of items) {
      const { orderItemId, quantity } = reqItem;

      if (!orderItemId || !mongoose.Types.ObjectId.isValid(orderItemId)) {
        return res.status(400).json({ success: false, message: "Invalid orderItemId" });
      }

      const orderItem = orderItemMap[String(orderItemId)];
      if (!orderItem) {
        return res.status(400).json({
          success: false,
          message: `Item ${orderItemId} not found in this order`,
        });
      }

      const qty = Number(quantity);
      if (!qty || qty < 1 || qty > orderItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for item ${orderItemId}`,
        });
      }

      validItems.push({
        orderItemId,
        productId: orderItem.productId,
        quantity: qty,
        refundAmount: (orderItem.price || 0) * qty,
      });
    }

    // Create return + return items
    const newReturn = await Return.create({
      orderId,
      userId,
      reason: description ? `${reason}: ${String(description).trim().slice(0, 1000)}` : reason,
      status: "requested",
      refundStatus: "pending",
      requestedAt: new Date(),
    });

    const returnItemDocs = validItems.map((item) => ({
      returnId: newReturn._id,
      orderItemId: item.orderItemId,
      productId: item.productId,
      quantity: item.quantity,
      refundAmount: item.refundAmount,
    }));

    await ReturnItem.insertMany(returnItemDocs);

    // Trigger push notification for admins
    pushService.sendPushToAdmins("returnRequests", {
      title: "New Return Request",
      body: `Order ${String(orderId).slice(-6).toUpperCase()} has a new return request.`,
      tag: "returnRequests"
    });

    return res.status(201).json({
      success: true,
      message: "Return request submitted successfully",
      returnId: newReturn._id,
      ticketNo: `RET-${String(newReturn._id).slice(-6).toUpperCase()}`,
    });
  } catch (err) {
    console.error("createReturn error:", err);
    return res.status(500).json({ success: false, message: "Failed to submit return request" });
  }
};

// GET /api/returns/my-returns
exports.getMyReturns = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;
    const status = String(req.query.status || "").trim().toLowerCase();

    const filter = { userId };
    if (status && status !== "all") {
      filter.status = status;
    }

    const [returns, total] = await Promise.all([
      Return.find(filter)
        .populate("orderId", "items pricing totalAmount createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Return.countDocuments(filter),
    ]);

    // Attach return items
    const returnIds = returns.map((r) => r._id);
    const returnItems = await ReturnItem.find({ returnId: { $in: returnIds } })
      .populate("productId", "name images")
      .lean();

    const itemsMap = returnItems.reduce((acc, item) => {
      const key = String(item.returnId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const rows = returns.map((ret) => {
      const items = itemsMap[String(ret._id)] || [];
      const totalRefund = items.reduce((sum, i) => sum + (i.refundAmount || 0), 0);
      return {
        _id: ret._id,
        ticketNo: `RET-${String(ret._id).slice(-6).toUpperCase()}`,
        status: ret.status,
        refundStatus: ret.refundStatus,
        reason: ret.reason || "",
        adminNote: ret.adminNote || "",
        requestedAt: ret.requestedAt,
        processedAt: ret.processedAt,
        totalRefund,
        order: ret.orderId
          ? { _id: ret.orderId._id, totalAmount: ret.orderId.totalAmount || ret.orderId.pricing?.total }
          : null,
        items: items.map((item) => ({
          _id: item._id,
          productId: item.productId?._id,
          name: item.productId?.name || "Product",
          image:
            item.productId?.images?.find((img) => img.isPrimary)?.url ||
            item.productId?.images?.[0]?.url ||
            "",
          quantity: item.quantity,
          refundAmount: item.refundAmount,
        })),
      };
    });

    return res.json({
      success: true,
      returns: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error("getMyReturns error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch returns" });
  }
};

// GET /api/returns/:id
exports.getReturnById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid return id" });
    }

    const returnDoc = await Return.findOne({ _id: id, userId })
      .populate("orderId", "items pricing totalAmount orderStatus createdAt")
      .lean();

    if (!returnDoc) {
      return res.status(404).json({ success: false, message: "Return not found" });
    }

    const items = await ReturnItem.find({ returnId: id })
      .populate("productId", "name images price")
      .lean();

    return res.json({
      success: true,
      return: {
        ...returnDoc,
        ticketNo: `RET-${String(returnDoc._id).slice(-6).toUpperCase()}`,
        items,
      },
    });
  } catch (err) {
    console.error("getReturnById error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch return" });
  }
};
