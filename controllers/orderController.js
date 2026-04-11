const mongoose = require("mongoose");
const Order = require("../models/Order");

function buildPagination(query) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.max(Number(query.limit) || 10, 1);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function buildPaginationMeta({ total, page, limit }) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

exports.getMyOrders = async (req, res) => {
  try {
    const { status, search = "", month, year } = req.query;
    const { page, limit, skip } = buildPagination(req.query);

    const filter = {
      userId: req.user.id,
    };

    if (status && status !== "all") {
      filter.orderStatus = status.toLowerCase();
    }

    if (search.trim()) {
      filter["items.name"] = { $regex: search.trim(), $options: "i" };
    }

    // Month + year filter on createdAt
    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10); // 1-based (1 = Jan, 12 = Dec)

    if (!isNaN(parsedYear) && !isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
      const startDate = new Date(parsedYear, parsedMonth - 1, 1);
      const endDate = new Date(parsedYear, parsedMonth, 1); // exclusive start of next month
      filter.createdAt = { $gte: startDate, $lt: endDate };
    } else if (!isNaN(parsedYear)) {
      // Year-only filter
      const startDate = new Date(parsedYear, 0, 1);
      const endDate = new Date(parsedYear + 1, 0, 1);
      filter.createdAt = { $gte: startDate, $lt: endDate };
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      orders,
      meta: buildPaginationMeta({ total, page, limit }),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch orders",
    });
  }
};

const Return = require("../models/Return");

exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order id",
      });
    }

    const order = await Order.findOne({
      _id: id,
      userId: req.user.id,
    }).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const returnInfo = await Return.findOne({ orderId: id, userId: req.user.id }).lean();

    return res.json({
      success: true,
      order: {
        ...order,
        returnInfo: returnInfo || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch order",
    });
  }
};

exports.getAdminOrders = async (req, res) => {
  try {
    const {
      search = "",
      status,
      paymentStatus,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const { page, limit, skip } = buildPagination(req.query);

    const filter = {};

    if (status && status !== "all") {
      filter.orderStatus = status.toLowerCase();
    }

    if (paymentStatus && paymentStatus !== "all") {
      filter["payment.status"] = paymentStatus.toLowerCase();
    }

    if (search.trim()) {
      filter.$or = [
        { "items.name": { $regex: search.trim(), $options: "i" } },
        { "address.fullName": { $regex: search.trim(), $options: "i" } },
        { _id: mongoose.Types.ObjectId.isValid(search.trim()) ? search.trim() : undefined },
      ].filter(Boolean);
    }

    const allowedSorts = ["createdAt", "orderStatus"];
    const finalSortBy = allowedSorts.includes(sortBy) ? sortBy : "createdAt";
    const finalSortOrder = sortOrder === "asc" ? 1 : -1;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ [finalSortBy]: finalSortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      orders,
      meta: buildPaginationMeta({ total, page, limit }),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch admin orders",
    });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus } = req.body;

    const allowedStatuses = [
      "placed",
      "confirmed",
      "packed",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order id",
      });
    }

    if (!allowedStatuses.includes(String(orderStatus).toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { orderStatus: String(orderStatus).toLowerCase() },
      { new: true }
    ).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.json({
      success: true,
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update order status",
    });
  }
};