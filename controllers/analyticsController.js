const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Return = require("../models/Return");

// ─────────────────────────────────────────────────────────────
//  PROFIT ANALYSIS
// ─────────────────────────────────────────────────────────────
exports.getProfitStats = async (req, res) => {
  try {
    const now = new Date();

    const startOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear      = new Date(now.getFullYear(), 0, 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const baseFilter = {
      "payment.status": "paid",
      orderStatus: { $nin: ["cancelled"] },
    };

    const [monthlyOrders, lastMonthOrders, yearlyOrders, allTimeOrders, monthlyChart] =
      await Promise.all([
        Order.aggregate([
          { $match: { ...baseFilter, createdAt: { $gte: startOfMonth } } },
          { $group: { _id: null, revenue: { $sum: "$pricing.total" }, count: { $sum: 1 } } },
        ]),
        Order.aggregate([
          { $match: { ...baseFilter, createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
          { $group: { _id: null, revenue: { $sum: "$pricing.total" }, count: { $sum: 1 } } },
        ]),
        Order.aggregate([
          { $match: { ...baseFilter, createdAt: { $gte: startOfYear } } },
          { $group: { _id: null, revenue: { $sum: "$pricing.total" }, count: { $sum: 1 } } },
        ]),
        Order.aggregate([
          { $match: baseFilter },
          { $group: { _id: null, revenue: { $sum: "$pricing.total" }, count: { $sum: 1 } } },
        ]),
        Order.aggregate([
          {
            $match: {
              ...baseFilter,
              createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 6, 1) },
            },
          },
          {
            $group: {
              _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
              revenue: { $sum: "$pricing.total" },
              count: { $sum: 1 },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]),
      ]);

    const COST_RATIO = 0.62;

    const thisMonthRevenue = monthlyOrders[0]?.revenue || 0;
    const lastMonthRevenue = lastMonthOrders[0]?.revenue || 0;
    const thisYearRevenue  = yearlyOrders[0]?.revenue || 0;
    const allTimeRevenue   = allTimeOrders[0]?.revenue || 0;

    const thisMonthProfit = thisMonthRevenue * (1 - COST_RATIO);
    const lastMonthProfit = lastMonthRevenue * (1 - COST_RATIO);
    const thisYearProfit  = thisYearRevenue * (1 - COST_RATIO);
    const allTimeProfit   = allTimeRevenue * (1 - COST_RATIO);

    const monthDelta =
      lastMonthRevenue > 0
        ? (((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1)
        : 0; // Fix: month delta on profit should use previous profit, or we use revenue delta

    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const chartData = monthlyChart.map((m) => ({
      month: MONTHS[m._id.month - 1],
      revenue: Math.round(m.revenue),
      cost: Math.round(m.revenue * COST_RATIO),
      profit: Math.round(m.revenue * (1 - COST_RATIO)),
      orders: m.count,
    }));

    return res.json({
      success: true,
      stats: {
        monthlyProfit: Math.round(thisMonthProfit),
        yearlyProfit: Math.round(thisYearProfit),
        allTimeProfit: Math.round(allTimeProfit),
        monthlyRevenue: Math.round(thisMonthRevenue),
        monthDelta: Number(monthDelta),
        profitMargin:
          thisMonthRevenue > 0
            ? Number(((thisMonthProfit / thisMonthRevenue) * 100).toFixed(1))
            : 38,
        operatingRatio: Number((COST_RATIO * 100).toFixed(1)),
        chartData,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch profit stats" });
  }
};

// ─────────────────────────────────────────────────────────────
//  REPORTS
// ─────────────────────────────────────────────────────────────
exports.getReportStats = async (req, res) => {
  try {
    const now             = new Date();
    const startOfMonth    = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth  = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [thisMonthData, lastMonthData, returnsCount, ordersCount, salesRowsAgg, statusBreakdown] = await Promise.all([
      // 0: This month revenue & units
      Order.aggregate([
        {
          $match: {
            "payment.status": "paid",
            orderStatus: { $nin: ["cancelled"] },
            createdAt: { $gte: startOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$pricing.total" },
            units: { $sum: { $sum: "$items.quantity" } },
            count: { $sum: 1 },
          },
        },
      ]),
      // 1: Last month revenue & units
      Order.aggregate([
        {
          $match: {
            "payment.status": "paid",
            orderStatus: { $nin: ["cancelled"] },
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$pricing.total" },
            units: { $sum: { $sum: "$items.quantity" } },
            count: { $sum: 1 },
          },
        },
      ]),
      // 2: Returns this month
      Return.countDocuments({ createdAt: { $gte: startOfMonth } }),
      // 3: Orders this month
      Order.countDocuments({ createdAt: { $gte: startOfMonth }, "payment.status": "paid", orderStatus: { $nin: ["cancelled"] } }),
      // 4: Comprehensive Sales Data
      Order.aggregate([
        {
          $match: {
            "payment.status": "paid",
            orderStatus: { $nin: ["cancelled"] },
            createdAt: { $gte: startOfMonth },
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            name: { $first: "$items.name" },
            revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
            units: { $sum: "$items.quantity" },
          },
        },
        {
           $lookup: {
              from: "products",
              localField: "_id",
              foreignField: "_id",
              as: "product"
           }
        },
        { $unwind: "$product" },
        {
           $lookup: {
              from: "categories",
              localField: "product.categoryId",
              foreignField: "_id",
              as: "category"
           }
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
        {
           $lookup: {
              from: "brands",
              localField: "product.brandId",
              foreignField: "_id",
              as: "brand"
           }
        },
        { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
        { $sort: { revenue: -1 } }
      ]),
      // 5: Status Breakdown
      Order.aggregate([{ $match: { createdAt: { $gte: startOfMonth } } }, { $group: { _id: "$orderStatus", count: { $sum: 1 } } }]),
    ]);

    const thisMonthRevenue = thisMonthData[0]?.revenue || 0;
    const lastMonthRevenue = lastMonthData[0]?.revenue || 0;
    const thisMonthUnits   = thisMonthData[0]?.units || 0;
    const lastMonthUnits   = lastMonthData[0]?.units || 0;

    const revDelta =
      lastMonthRevenue > 0
        ? Number((((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1))
        : 0;
    const unitsDelta =
      lastMonthUnits > 0
        ? Number((((thisMonthUnits - lastMonthUnits) / lastMonthUnits) * 100).toFixed(1))
        : 0;

    const returnRate = ordersCount > 0 ? Number(((returnsCount / ordersCount) * 100).toFixed(1)) : 0;

    // Process salesRows into formats needed by the frontend
    const salesRows = salesRowsAgg.map(p => ({
      id: p._id,
      name: p.name,
      category: p.category ? p.category.name : "Uncategorized",
      brand: p.brand ? p.brand.name : "Unbranded",
      units: p.units,
      revenue: Math.round(p.revenue),
      stock: p.product.stock,
      status: p.product.stock > 0 ? "In Stock" : "Out of Stock",
    }));

    // Top 5 products
    const topProducts = salesRows.slice(0, 5).map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        revenue: p.revenue,
        units: p.units
    }));

    // Worst products (lowest revenue but > 0 units is best to show from the active sales, or just lowest in the salesRows)
    const worstProducts = salesRows.slice().reverse().slice(0, 5).map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        revenue: p.revenue,
        units: p.units
    }));

    // Category Distribution Data
    const categoryMap = {};
    salesRows.forEach(p => {
        if (!categoryMap[p.category]) categoryMap[p.category] = { units: 0, revenue: 0 };
        categoryMap[p.category].units += p.units;
        categoryMap[p.category].revenue += p.revenue;
    });
    const categoryData = Object.keys(categoryMap).map(k => ({
        name: k,
        units: categoryMap[k].units,
        revenue: categoryMap[k].revenue,
        percent: thisMonthUnits > 0 ? Math.round((categoryMap[k].units / thisMonthUnits) * 100) : 0
    })).sort((a,b) => b.units - a.units);

    // Brand Data
    const brandMap = {};
    salesRows.forEach(p => {
        if (!brandMap[p.brand]) brandMap[p.brand] = { units: 0, revenue: 0 };
        brandMap[p.brand].units += p.units;
        brandMap[p.brand].revenue += p.revenue;
    });
    const brandData = Object.keys(brandMap).map(k => ({
        name: k,
        pct: thisMonthRevenue > 0 ? Math.round((brandMap[k].revenue / thisMonthRevenue) * 100) : 0
    })).sort((a,b) => b.pct - a.pct).slice(0,4);


    return res.json({
      success: true,
      stats: {
        monthlyRevenue: Math.round(thisMonthRevenue),
        revenueDelta: revDelta,
        monthlySoldUnits: thisMonthUnits,
        unitsDelta,
        returnRate,
        topProducts,
        worstProducts,
        categoryData,
        brandData,
        salesRows,
        statusBreakdown: statusBreakdown.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {}),
      },
    });
  } catch (err) {
      console.error(err);
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch report stats" });
  }
};

// ─────────────────────────────────────────────────────────────
//  ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const now              = new Date();
    const startOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear      = new Date(now.getFullYear(), 0, 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const baseFilter = { "payment.status": "paid", orderStatus: { $nin: ["cancelled"] } };

    const [
      monthlyRevData,
      lastMonthRevData,
      yearlyRevData,
      allTimeRevData,
      chartData,
      productStats,
      totalUsers,
      pendingReturns,
      recentOrders,
    ] = await Promise.all([
      // Revenue aggregations
      Order.aggregate([
        { $match: { ...baseFilter, createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, revenue: { $sum: "$pricing.total" } } },
      ]),
      Order.aggregate([
        { $match: { ...baseFilter, createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $group: { _id: null, revenue: { $sum: "$pricing.total" } } },
      ]),
      Order.aggregate([
        { $match: { ...baseFilter, createdAt: { $gte: startOfYear } } },
        { $group: { _id: null, revenue: { $sum: "$pricing.total" } } },
      ]),
      Order.aggregate([
        { $match: baseFilter },
        { $group: { _id: null, revenue: { $sum: "$pricing.total" } } },
      ]),
      // Last 6 months chart
      Order.aggregate([
        {
          $match: {
            ...baseFilter,
            createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) },
          },
        },
        {
          $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            revenue: { $sum: "$pricing.total" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      // Product stats
      Product.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
            lowStock: [{ $match: { $expr: { $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", "$lowStockThreshold"] }] } } }, { $count: "count" }],
            outOfStock: [{ $match: { stock: 0 } }, { $count: "count" }],
          },
        },
      ]),
      // Total users
      User.countDocuments({ role: "customer" }),
      // Pending returns
      Return.countDocuments({ status: "requested" }),
      // Recent 5 orders
      Order.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select("_id orderStatus pricing.total address.fullName createdAt payment")
        .lean(),
    ]);

    const COST_RATIO = 0.62;
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const monthlyRevenue = monthlyRevData[0]?.revenue || 0;
    const lastMonthRevenue = lastMonthRevData[0]?.revenue || 0;
    const yearlyRevenue = yearlyRevData[0]?.revenue || 0;
    const totalRevenue = allTimeRevData[0]?.revenue || 0;

    const monthlyProfit = monthlyRevenue * (1 - COST_RATIO);
    const yearlyProfit  = yearlyRevenue * (1 - COST_RATIO);
    const totalProfit   = totalRevenue * (1 - COST_RATIO);

    const monthDelta =
      lastMonthRevenue > 0
        ? Number((((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1))
        : 0;

    const ps = productStats[0] || {};
    const totalProducts   = ps.total?.[0]?.count || 0;
    const lowStockItems   = ps.lowStock?.[0]?.count || 0;
    const outOfStockItems = ps.outOfStock?.[0]?.count || 0;

    const chart = chartData.map((m) => ({
      month: MONTHS[m._id.month - 1],
      revenue: Math.round(m.revenue),
      profit: Math.round(m.revenue * (1 - COST_RATIO)),
      orders: m.orders,
    }));

    return res.json({
      success: true,
      stats: {
        monthlyRevenue: Math.round(monthlyRevenue),
        yearlyRevenue:  Math.round(yearlyRevenue),
        totalRevenue:   Math.round(totalRevenue),
        monthlyProfit:  Math.round(monthlyProfit),
        yearlyProfit:   Math.round(yearlyProfit),
        totalProfit:    Math.round(totalProfit),
        monthDelta,
        totalProducts,
        lowStockItems,
        outOfStockItems,
        totalUsers,
        pendingReturns,
        chartData: chart,
        recentOrders: recentOrders.map((o) => ({
          id: String(o._id).slice(-6).toUpperCase(),
          customer: o.address?.fullName || "Customer",
          total: o.pricing?.total || 0,
          status: o.orderStatus,
          date: o.createdAt,
          paymentStatus: o.payment?.status || "pending",
        })),
      },
    });
  } catch (err) {
    console.error("getDashboardStats error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch dashboard stats" });
  }
};

// ─────────────────────────────────────────────────────────────
//  NOTIFICATION CHECK (for push triggers)
// ─────────────────────────────────────────────────────────────
exports.getNotificationAlerts = async (req, res) => {
  try {
    const [lowStockProducts, pendingReturns] = await Promise.all([
      Product.find({ stock: 0 })
        .select("name stock lowStockThreshold")
        .limit(5)
        .lean(),
      Return.find({ status: "requested" })
        .sort({ createdAt: -1 })
        .limit(3)
        .select("orderId reason requestedAt")
        .lean(),
    ]);

    const outOfStock = lowStockProducts.filter((p) => p.stock === 0);

    return res.json({
      success: true,
      alerts: {
        outOfStockCount: outOfStock.length,
        outOfStockProducts: outOfStock.map((p) => p.name),
        pendingReturnCount: pendingReturns.length,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch alerts" });
  }
};
