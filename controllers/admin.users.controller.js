const mongoose = require("mongoose");
const User = require("../models/User");
const {
  buildPagination,
  buildSort,
  buildSearch,
  buildPaginationMeta,
} = require("../utils/queryHelper");

// GET /api/admin/users?search=&role=&status=&page=&limit=&sortBy=&order=
exports.listUsers = async (req, res) => {
  try {
    const { search = "", role = "", status = "" } = req.query;
    const { page, limit, skip } = buildPagination(req.query);
    const sort = buildSort(req.query, ["createdAt", "name", "email", "role", "status"]);

    const filter = {
      isDeleted: { $ne: true },
    };

    if (role?.trim()) filter.role = role.trim().toLowerCase();
    if (status?.trim()) filter.status = status.trim().toLowerCase();

    Object.assign(filter, buildSearch(search, ["name", "email"]));

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select("name email role status createdAt"),
      User.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      users: items,
      pagination: buildPaginationMeta(total, page, limit),
    });
  } catch (err) {
    console.error("listUsers error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to list users",
    });
  }
};

// GET /api/admin/users/stats
exports.userStats = async (req, res) => {
  try {
    const filter = { isDeleted: { $ne: true } };

    const [total, admins, staff, customers, active, pending, suspended] = await Promise.all([
      User.countDocuments(filter),
      User.countDocuments({ ...filter, role: "admin" }),
      User.countDocuments({ ...filter, role: "staff" }),
      User.countDocuments({ ...filter, role: "customer" }),
      User.countDocuments({ ...filter, status: "active" }),
      User.countDocuments({ ...filter, status: "pending" }),
      User.countDocuments({ ...filter, status: "suspended" }),
    ]);

    return res.json({
      success: true,
      stats: {
        totalUsers: total,
        activeAdmins: admins,
        staffMembers: staff,
        totalCustomers: customers,
        activeUsers: active,
        pendingApproval: pending,
        blockedUsers: suspended,
      },
    });
  } catch (err) {
    console.error("userStats error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load stats",
    });
  }
};

// PATCH /api/admin/users/:id/status
// body: { status: "active" } or { status: "suspended" }
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const allowedStatus = ["active", "pending", "suspended"];

    if (!status || !allowedStatus.includes(String(status).toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const normalizedStatus = String(status).toLowerCase();

    const user = await User.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: { status: normalizedStatus } },
      { new: true }
    ).select("name email role status createdAt");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      message:
        normalizedStatus === "suspended"
          ? "User blocked successfully"
          : normalizedStatus === "active"
          ? "User unblocked successfully"
          : "User status updated successfully",
      user,
    });
  } catch (err) {
    console.error("updateUserStatus error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update user status",
    });
  }
};

// PATCH /api/admin/users/:id/block
exports.blockUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const user = await User.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: { status: "suspended" } },
      { new: true }
    ).select("name email role status createdAt");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      message: "User blocked successfully",
      user,
    });
  } catch (err) {
    console.error("blockUser error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to block user",
    });
  }
};

// PATCH /api/admin/users/:id/unblock
exports.unblockUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const user = await User.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: { status: "active" } },
      { new: true }
    ).select("name email role status createdAt");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      message: "User unblocked successfully",
      user,
    });
  } catch (err) {
    console.error("unblockUser error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to unblock user",
    });
  }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const user = await User.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err) {
    console.error("deleteUser error:", err);
    return res.status(500).json({
      success: false,
      message: "Delete failed",
    });
  }
};