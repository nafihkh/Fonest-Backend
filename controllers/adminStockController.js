const mongoose = require("mongoose");
const Product = require("../models/Product");
const StockEntry = require("../models/StockEntry");
const StockOutEntry = require("../models/StockOutEntry");
const StockAlert = require("../models/StockAlert");

async function syncStockAlert(productId) {
  const product = await Product.findById(productId).select("stock lowStockThreshold");
  if (!product) return;

  const stock = Number(product.stock || 0);
  const threshold = Number(product.lowStockThreshold || 0);

  await StockAlert.updateMany(
    { productId, isResolved: false },
    {
      $set: {
        isResolved: true,
        resolvedAt: new Date(),
      },
    }
  );

  if (stock === 0) {
    await StockAlert.create({
      productId,
      alertType: "out_of_stock",
      threshold,
      currentStock: stock,
      isResolved: false,
    });
    return;
  }

  if (stock <= threshold) {
    await StockAlert.create({
      productId,
      alertType: "low_stock",
      threshold,
      currentStock: stock,
      isResolved: false,
    });
  }
}

// POST /api/admin/stock/in
exports.createStockEntry = async (req, res) => {
  try {
    const {
      productId,
      variantId = null,
      quantityAdded,
      supplier,
      reference,
      date,
      notes,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product id",
      });
    }

    const qty = Number(quantityAdded);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity added must be greater than 0",
      });
    }

    if (supplier && String(supplier).trim().length > 120) {
      return res.status(400).json({
        success: false,
        message: "Supplier is too long",
      });
    }

    if (reference && String(reference).trim().length > 120) {
      return res.status(400).json({
        success: false,
        message: "Reference is too long",
      });
    }

    if (notes && String(notes).trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: "Notes is too long",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    product.stock = Number(product.stock || 0) + qty;
    product.updatedBy = req.user?._id || req.user?.id || null;
    await product.save();

    const entry = await StockEntry.create({
      productId,
      variantId,
      quantityAdded: qty,
      supplier: supplier?.trim?.() || "",
      reference: reference?.trim?.() || "",
      notes: notes?.trim?.() || "",
      transactionDate: date ? new Date(date) : new Date(),
      addedBy: req.user?._id || req.user?.id || null,
    });

    await syncStockAlert(productId);

    return res.status(201).json({
      success: true,
      message: "Stock entry created successfully",
      entry,
      product: {
        _id: product._id,
        name: product.name,
        stock: product.stock,
      },
    });
  } catch (err) {
    console.error("createStockEntry error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create stock entry",
    });
  }
};


// POST /api/admin/stock/out
exports.createStockOutEntry = async (req, res) => {
  try {
    const {
      productId,
      variantId = null,
      quantityRemoved,
      reason = "manual",
      reference,
      date,
      notes,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product id",
      });
    }

    const qty = Number(quantityRemoved);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity removed must be greater than 0",
      });
    }

    const allowedReasons = ["sale", "damaged", "adjustment", "return_out", "manual"];
    if (reason && !allowedReasons.includes(String(reason).toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid stock out reason",
      });
    }

    if (reference && String(reference).trim().length > 120) {
      return res.status(400).json({
        success: false,
        message: "Reference is too long",
      });
    }

    if (notes && String(notes).trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: "Notes is too long",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const currentStock = Number(product.stock || 0);

    if (qty > currentStock) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available stock: ${currentStock}`,
      });
    }

    product.stock = currentStock - qty;
    product.updatedBy = req.user?._id || req.user?.id || null;
    await product.save();

    const outEntry = await StockOutEntry.create({
      productId,
      variantId,
      quantityRemoved: qty,
      reason: String(reason).toLowerCase(),
      reference: reference?.trim?.() || "",
      notes: notes?.trim?.() || "",
      transactionDate: date ? new Date(date) : new Date(),
      removedBy: req.user?._id || req.user?.id || null,
    });

    await syncStockAlert(productId);

    return res.status(201).json({
      success: true,
      message: "Stock out entry created successfully",
      outEntry,
      product: {
        _id: product._id,
        name: product.name,
        stock: product.stock,
      },
    });
  } catch (err) {
    console.error("createStockOutEntry error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create stock out entry",
    });
  }
};

// GET /api/admin/stock/products/search?q=
exports.searchStockProducts = async (req, res) => {
  try {
    const q = req.query.q?.trim() || "";

    const filter = {};

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { sku: { $regex: q, $options: "i" } },
      ];
    }

    const products = await Product.find(filter)
      .select("name sku stock lowStockThreshold status")
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    return res.json({
      success: true,
      products,
    });
  } catch (err) {
    console.error("searchStockProducts error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to search products",
    });
  }
};

// GET /api/admin/stock/activity?page=&limit=
exports.listStockActivity = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

    const [entries, outs] = await Promise.all([
      StockEntry.find()
        .populate("productId", "name sku stock")
        .populate("addedBy", "name email")
        .sort({ createdAt: -1 })
        .lean(),
      StockOutEntry.find()
        .populate("productId", "name sku stock")
        .populate("removedBy", "name email")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const merged = [
      ...entries.map((item) => ({
        _id: item._id,
        type: "in",
        quantity: item.quantityAdded,
        supplier: item.supplier,
        reference: item.reference,
        reason: "",
        createdAt: item.createdAt,
        product: item.productId
          ? {
              _id: item.productId._id,
              name: item.productId.name,
              sku: item.productId.sku,
              stock: item.productId.stock,
            }
          : null,
        user: item.addedBy
          ? {
              _id: item.addedBy._id,
              name: item.addedBy.name,
              email: item.addedBy.email,
            }
          : null,
      })),
      ...outs.map((item) => ({
        _id: item._id,
        type: "out",
        quantity: item.quantityRemoved,
        supplier: "",
        reference: item.reference,
        reason: item.reason,
        createdAt: item.createdAt,
        product: item.productId
          ? {
              _id: item.productId._id,
              name: item.productId.name,
              sku: item.productId.sku,
              stock: item.productId.stock,
            }
          : null,
        user: item.removedBy
          ? {
              _id: item.removedBy._id,
              name: item.removedBy.name,
              email: item.removedBy.email,
            }
          : null,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = merged.length;
    const paginated = merged.slice(skip, skip + limit);

    return res.json({
      success: true,
      activities: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error("listStockActivity error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load stock activity",
    });
  }
};

// GET /api/admin/stock/stats
exports.stockStats = async (req, res) => {
  try {
    const products = await Product.find()
      .select("stock price lowStockThreshold")
      .lean();

    const totalProducts = products.length;

    const totalStockValue = products.reduce((sum, p) => {
      return sum + Number(p.stock || 0) * Number(p.price || 0);
    }, 0);

    const lowStockItems = products.filter((p) => {
      const stock = Number(p.stock || 0);
      const threshold = Number(p.lowStockThreshold || 0);
      return stock > 0 && stock <= threshold;
    }).length;

    const outOfStockItems = products.filter((p) => Number(p.stock || 0) === 0).length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [stockInAgg, stockOutAgg] = await Promise.all([
      StockEntry.aggregate([
        { $match: { createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: "$quantityAdded" } } },
      ]),
      StockOutEntry.aggregate([
        { $match: { createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: "$quantityRemoved" } } },
      ]),
    ]);

    return res.json({
      success: true,
      stats: {
        totalProducts,
        totalStockValue,
        todayStockIn: stockInAgg[0]?.total || 0,
        todayStockOut: stockOutAgg[0]?.total || 0,
        lowStockItems,
        outOfStockItems,
      },
    });
  } catch (err) {
    console.error("stockStats error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load stock stats",
    });
  }
};

// GET /api/admin/stock/alerts
exports.listStockAlerts = async (req, res) => {
  try {
    const alerts = await StockAlert.find({ isResolved: false })
      .populate("productId", "name sku stock lowStockThreshold")
      .sort({ createdAt: -1 })
      .lean();

    const formatted = alerts.map((alert) => ({
      _id: alert._id,
      alertType: alert.alertType,
      threshold: alert.threshold,
      currentStock: alert.currentStock,
      createdAt: alert.createdAt,
      product: alert.productId
        ? {
            _id: alert.productId._id,
            name: alert.productId.name,
            sku: alert.productId.sku,
            stock: alert.productId.stock,
            lowStockThreshold: alert.productId.lowStockThreshold,
          }
        : null,
    }));

    return res.json({
      success: true,
      alerts: formatted,
    });
  } catch (err) {
    console.error("listStockAlerts error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load stock alerts",
    });
  }
};

exports.listStockHistory = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

    const type = String(req.query.type || "").trim().toLowerCase();
    const search = String(req.query.search || "").trim();

    let productIds = null;

    if (search) {
      const matchedProducts = await Product.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { sku: { $regex: search, $options: "i" } },
        ],
      })
        .select("_id")
        .lean();

      productIds = matchedProducts.map((p) => p._id);

      if (productIds.length === 0) {
        return res.json({
          success: true,
          history: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 1,
          },
        });
      }
    }

    const entryFilter = {};
    const outFilter = {};

    if (productIds) {
      entryFilter.productId = { $in: productIds };
      outFilter.productId = { $in: productIds };
    }

    let history = [];

    if (!type || type === "in") {
      const entries = await StockEntry.find(entryFilter)
        .populate("productId", "name sku stock")
        .populate("addedBy", "name email")
        .sort({ createdAt: -1 })
        .lean();

      history.push(
        ...entries.map((item) => ({
          _id: item._id,
          type: "in",
          quantity: item.quantityAdded,
          supplier: item.supplier || "",
          reference: item.reference || "",
          reason: "",
          createdAt: item.createdAt,
          product: item.productId
            ? {
                _id: item.productId._id,
                name: item.productId.name,
                sku: item.productId.sku,
                stock: item.productId.stock,
              }
            : null,
          user: item.addedBy
            ? {
                _id: item.addedBy._id,
                name: item.addedBy.name,
                email: item.addedBy.email,
              }
            : null,
        }))
      );
    }

    if (!type || type === "out") {
      const outs = await StockOutEntry.find(outFilter)
        .populate("productId", "name sku stock")
        .populate("removedBy", "name email")
        .sort({ createdAt: -1 })
        .lean();

      history.push(
        ...outs.map((item) => ({
          _id: item._id,
          type: "out",
          quantity: item.quantityRemoved,
          supplier: "",
          reference: item.reference || "",
          reason: item.reason || "",
          createdAt: item.createdAt,
          product: item.productId
            ? {
                _id: item.productId._id,
                name: item.productId.name,
                sku: item.productId.sku,
                stock: item.productId.stock,
              }
            : null,
          user: item.removedBy
            ? {
                _id: item.removedBy._id,
                name: item.removedBy.name,
                email: item.removedBy.email,
              }
            : null,
        }))
      );
    }

    history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = history.length;
    const paginated = history.slice(skip, skip + limit);

    return res.json({
      success: true,
      history: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error("listStockHistory error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load stock history",
    });
  }
};

exports.updateStockHistory = async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!["in", "out"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid history type",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid history id",
      });
    }

    if (type === "in") {
      const { quantityAdded, supplier, reference } = req.body;

      const entry = await StockEntry.findById(id);
      if (!entry) {
        return res.status(404).json({
          success: false,
          message: "Stock entry not found",
        });
      }

      const nextQty = Number(quantityAdded);
      if (!Number.isFinite(nextQty) || nextQty <= 0) {
        return res.status(400).json({
          success: false,
          message: "Quantity added must be greater than 0",
        });
      }

      const product = await Product.findById(entry.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Related product not found",
        });
      }

      const oldQty = Number(entry.quantityAdded || 0);
      const diff = nextQty - oldQty;

      const nextStock = Number(product.stock || 0) + diff;
      if (nextStock < 0) {
        return res.status(400).json({
          success: false,
          message: "Stock cannot become negative",
        });
      }

      product.stock = nextStock;
      product.updatedBy = req.user?._id || req.user?.id || null;
      await product.save();

      entry.quantityAdded = nextQty;
      entry.supplier = supplier?.trim?.() || "";
      entry.reference = reference?.trim?.() || "";
      await entry.save();

      await syncStockAlert(product._id);

      return res.json({
        success: true,
        message: "Stock entry updated successfully",
      });
    }

    if (type === "out") {
      const { quantityRemoved, reason, reference } = req.body;

      const outEntry = await StockOutEntry.findById(id);
      if (!outEntry) {
        return res.status(404).json({
          success: false,
          message: "Stock out entry not found",
        });
      }

      const nextQty = Number(quantityRemoved);
      if (!Number.isFinite(nextQty) || nextQty <= 0) {
        return res.status(400).json({
          success: false,
          message: "Quantity removed must be greater than 0",
        });
      }

      const allowedReasons = ["sale", "damaged", "adjustment", "return_out", "manual"];
      const normalizedReason = String(reason || "manual").toLowerCase();

      if (!allowedReasons.includes(normalizedReason)) {
        return res.status(400).json({
          success: false,
          message: "Invalid reason",
        });
      }

      const product = await Product.findById(outEntry.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Related product not found",
        });
      }

      const oldQty = Number(outEntry.quantityRemoved || 0);
      const diff = nextQty - oldQty;

      // out entry increase means product stock decreases more
      const nextStock = Number(product.stock || 0) - diff;

      if (nextStock < 0) {
        return res.status(400).json({
          success: false,
          message: "Insufficient stock for this update",
        });
      }

      product.stock = nextStock;
      product.updatedBy = req.user?._id || req.user?.id || null;
      await product.save();

      outEntry.quantityRemoved = nextQty;
      outEntry.reason = normalizedReason;
      outEntry.reference = reference?.trim?.() || "";
      await outEntry.save();

      await syncStockAlert(product._id);

      return res.json({
        success: true,
        message: "Stock out entry updated successfully",
      });
    }
  } catch (err) {
    console.error("updateStockHistory error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update stock history",
    });
  }
};

// DELETE /api/admin/stock/history/:type/:id
exports.deleteStockHistory = async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!["in", "out"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid history type",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid history id",
      });
    }

    if (type === "in") {
      const entry = await StockEntry.findById(id);
      if (!entry) {
        return res.status(404).json({
          success: false,
          message: "Stock entry not found",
        });
      }

      const product = await Product.findById(entry.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Related product not found",
        });
      }

      const qty = Number(entry.quantityAdded || 0);
      const nextStock = Number(product.stock || 0) - qty;

      if (nextStock < 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete this stock entry because stock would become negative",
        });
      }

      product.stock = nextStock;
      product.updatedBy = req.user?._id || req.user?.id || null;
      await product.save();

      await StockEntry.findByIdAndDelete(id);
      await syncStockAlert(product._id);

      return res.json({
        success: true,
        message: "Stock entry deleted successfully",
      });
    }

    if (type === "out") {
      const outEntry = await StockOutEntry.findById(id);
      if (!outEntry) {
        return res.status(404).json({
          success: false,
          message: "Stock out entry not found",
        });
      }

      const product = await Product.findById(outEntry.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Related product not found",
        });
      }

      const qty = Number(outEntry.quantityRemoved || 0);

      product.stock = Number(product.stock || 0) + qty;
      product.updatedBy = req.user?._id || req.user?.id || null;
      await product.save();

      await StockOutEntry.findByIdAndDelete(id);
      await syncStockAlert(product._id);

      return res.json({
        success: true,
        message: "Stock out entry deleted successfully",
      });
    }
  } catch (err) {
    console.error("deleteStockHistory error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete stock history",
    });
  }
};