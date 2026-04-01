const mongoose = require("mongoose");
const Return = require("../models/Return");
const ReturnItem = require("../models/ReturnItem");
const Order = require("../models/Order");
const Product = require("../models/Product");

const ALLOWED_RETURN_STATUS = [
  "requested",
  "approved",
  "rejected",
  "picked_up",
  "received",
  "refunded",
];

const ALLOWED_REFUND_STATUS = [
  "n_a",
  "pending",
  "processing",
  "completed",
  "declined",
];

// GET /api/admin/returns?status=&search=&page=&limit=
exports.listReturns = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

    const status = String(req.query.status || "").trim().toLowerCase();
    const search = String(req.query.search || "").trim();

    const filter = {};

    if (status) {
      if (!ALLOWED_RETURN_STATUS.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid return status filter",
        });
      }
      filter.status = status;
    }

    if (search) {
      const matchingOrders = await Order.find({
        orderNo: { $regex: search, $options: "i" },
      })
        .select("_id")
        .lean();

      const orderIds = matchingOrders.map((o) => o._id);

      filter.$or = [
        { reason: { $regex: search, $options: "i" } },
        { orderId: { $in: orderIds } },
      ];
    }

    const [returns, total] = await Promise.all([
      Return.find(filter)
        .populate("userId", "name email")
        .populate("orderId", "orderNo")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Return.countDocuments(filter),
    ]);

    const returnIds = returns.map((r) => r._id);

    const returnItems = await ReturnItem.find({
      returnId: { $in: returnIds },
    })
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
      const firstItem = items[0];

      return {
        _id: ret._id,
        ticketNo: `RET-${String(ret._id).slice(-6).toUpperCase()}`,
        reason: ret.reason || "",
        status: ret.status,
        refundStatus: ret.refundStatus,
        requestedAt: ret.requestedAt,
        processedAt: ret.processedAt,
        stockRestored: !!ret.stockRestored,
        adminNote: ret.adminNote || "",
        user: ret.userId
          ? {
              _id: ret.userId._id,
              name: ret.userId.name,
              email: ret.userId.email,
            }
          : null,
        order: ret.orderId
          ? {
              _id: ret.orderId._id,
              orderNo: ret.orderId.orderNo,
            }
          : null,
        product: firstItem?.productId
          ? {
              _id: firstItem.productId._id,
              name: firstItem.productId.name,
              image:
                firstItem.productId.images?.find((img) => img.isPrimary)?.url ||
                firstItem.productId.images?.[0]?.url ||
                "",
            }
          : null,
        itemCount: items.length,
      };
    });

    return res.json({
      success: true,
      returns: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error("listReturns error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load returns",
    });
  }
};

// GET /api/admin/returns/stats
exports.returnStats = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      pendingApproval,
      receivedToday,
      totalRefundedMTD,
      avgInspectionAgg,
    ] = await Promise.all([
      Return.countDocuments({ status: "requested" }),
      Return.countDocuments({
        status: "received",
        updatedAt: { $gte: startOfToday },
      }),
      Return.countDocuments({ refundStatus: "completed" }),
      Return.aggregate([
        {
          $match: {
            status: { $in: ["approved", "received", "refunded", "rejected"] },
            requestedAt: { $ne: null },
            processedAt: { $ne: null },
          },
        },
        {
          $project: {
            diffMs: { $subtract: ["$processedAt", "$requestedAt"] },
          },
        },
        {
          $group: {
            _id: null,
            avgMs: { $avg: "$diffMs" },
          },
        },
      ]),
    ]);

    let avgInspectionTime = "0d";
    if (avgInspectionAgg[0]?.avgMs) {
      const days = avgInspectionAgg[0].avgMs / (1000 * 60 * 60 * 24);
      avgInspectionTime = `${days.toFixed(1)}d`;
    }

    return res.json({
      success: true,
      stats: {
        pendingApproval,
        receivedToday,
        avgInspectionTime,
        totalRefundedMTD,
      },
    });
  } catch (err) {
    console.error("returnStats error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load return stats",
    });
  }
};

// GET /api/admin/returns/:id
exports.getReturnDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid return id",
      });
    }

    const returnRequest = await Return.findById(id)
      .populate("userId", "name email phone")
      .populate("orderId", "orderNo totalAmount status")
      .lean();

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: "Return not found",
      });
    }

    const items = await ReturnItem.find({ returnId: id })
      .populate("productId", "name sku price stock images")
      .populate("orderItemId", "productName quantity lineTotal")
      .lean();

    return res.json({
      success: true,
      returnRequest: {
        ...returnRequest,
        items,
      },
    });
  } catch (err) {
    console.error("getReturnDetails error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load return details",
    });
  }
};

// PATCH /api/admin/returns/:id/approve
exports.approveReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote = "" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid return id",
      });
    }

    if (adminNote && String(adminNote).trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: "Admin note is too long",
      });
    }

    const ret = await Return.findById(id);
    if (!ret) {
      return res.status(404).json({
        success: false,
        message: "Return not found",
      });
    }

    if (!["requested", "picked_up"].includes(ret.status)) {
      return res.status(400).json({
        success: false,
        message: "Only requested or picked-up returns can be approved",
      });
    }

    ret.status = "approved";
    ret.refundStatus = "processing";
    ret.adminNote = String(adminNote).trim();
    ret.approvedBy = req.user?._id || req.user?.id || null;
    ret.processedAt = new Date();

    await ret.save();

    return res.json({
      success: true,
      message: "Return approved successfully",
    });
  } catch (err) {
    console.error("approveReturn error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to approve return",
    });
  }
};

// PATCH /api/admin/returns/:id/reject
exports.rejectReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote = "" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid return id",
      });
    }

    if (adminNote && String(adminNote).trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: "Admin note is too long",
      });
    }

    const ret = await Return.findById(id);
    if (!ret) {
      return res.status(404).json({
        success: false,
        message: "Return not found",
      });
    }

    if (!["requested", "picked_up", "approved"].includes(ret.status)) {
      return res.status(400).json({
        success: false,
        message: "This return cannot be rejected now",
      });
    }

    ret.status = "rejected";
    ret.refundStatus = "declined";
    ret.adminNote = String(adminNote).trim();
    ret.rejectedBy = req.user?._id || req.user?.id || null;
    ret.processedAt = new Date();

    await ret.save();

    return res.json({
      success: true,
      message: "Return rejected successfully",
    });
  } catch (err) {
    console.error("rejectReturn error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to reject return",
    });
  }
};

// PATCH /api/admin/returns/:id/receive
exports.receiveReturn = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid return id",
      });
    }

    session.startTransaction();

    const ret = await Return.findById(id).session(session);
    if (!ret) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Return not found",
      });
    }

    if (!["approved", "picked_up"].includes(ret.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Only approved or picked-up returns can be received",
      });
    }

    const items = await ReturnItem.find({ returnId: id }).session(session);

    if (!ret.stockRestored) {
      for (const item of items) {
        const product = await Product.findById(item.productId).session(session);
        if (product) {
          product.stock = Number(product.stock || 0) + Number(item.quantity || 0);
          await product.save({ session });
        }
      }
      ret.stockRestored = true;
    }

    ret.status = "received";
    ret.refundStatus = "processing";
    ret.processedAt = new Date();

    await ret.save({ session });

    await session.commitTransaction();

    return res.json({
      success: true,
      message: "Return received and stock restored successfully",
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("receiveReturn error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to receive return",
    });
  } finally {
    session.endSession();
  }
};