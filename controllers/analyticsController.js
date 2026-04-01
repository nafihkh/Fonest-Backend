const Order = require("../models/Order");

exports.getProfitStats = async (req, res) => {
  try {
    const now = new Date();

    // Build date ranges
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Revenue = totalAmount of paid + delivered orders
    const baseFilter = {
      "payment.status": "paid",
      orderStatus: { $nin: ["cancelled"] },
    };

    const [
      monthlyOrders,
      lastMonthOrders,
      yearlyOrders,
      allTimeOrders,
      monthlyChart,
    ] = await Promise.all([
      // This month
      Order.aggregate([
        { $match: { ...baseFilter, createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, revenue: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      ]),
      // Last month
      Order.aggregate([
        { $match: { ...baseFilter, createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $group: { _id: null, revenue: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      ]),
      // This year
      Order.aggregate([
        { $match: { ...baseFilter, createdAt: { $gte: startOfYear } } },
        { $group: { _id: null, revenue: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      ]),
      // All time
      Order.aggregate([
        { $match: baseFilter },
        { $group: { _id: null, revenue: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      ]),
      // Last 7 months chart data
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
            revenue: { $sum: "$totalAmount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

    const COST_RATIO = 0.62; // Estimated cost ratio (62% of revenue = costs)

    const thisMonthRevenue = monthlyOrders[0]?.revenue || 0;
    const lastMonthRevenue = lastMonthOrders[0]?.revenue || 0;
    const thisYearRevenue = yearlyOrders[0]?.revenue || 0;
    const allTimeRevenue = allTimeOrders[0]?.revenue || 0;

    const thisMonthProfit = thisMonthRevenue * (1 - COST_RATIO);
    const lastMonthProfit = lastMonthRevenue * (1 - COST_RATIO);
    const thisYearProfit = thisYearRevenue * (1 - COST_RATIO);
    const allTimeProfit = allTimeRevenue * (1 - COST_RATIO);

    const monthDelta = lastMonthProfit > 0
      ? (((thisMonthProfit - lastMonthProfit) / lastMonthProfit) * 100).toFixed(1)
      : 0;

    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
        profitMargin: thisMonthRevenue > 0
          ? Number(((thisMonthProfit / thisMonthRevenue) * 100).toFixed(1))
          : 0,
        operatingRatio: Number((COST_RATIO * 100).toFixed(1)),
        chartData,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch profit stats",
    });
  }
};

exports.getReportStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [
      thisMonthData,
      lastMonthData,
      topProducts,
      statusBreakdown,
    ] = await Promise.all([
      Order.aggregate([
        { $match: { "payment.status": "paid", orderStatus: { $nin: ["cancelled"] }, createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, revenue: { $sum: "$totalAmount" }, units: { $sum: { $size: "$items" } }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { "payment.status": "paid", orderStatus: { $nin: ["cancelled"] }, createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $group: { _id: null, revenue: { $sum: "$totalAmount" }, units: { $sum: { $size: "$items" } }, count: { $sum: 1 } } },
      ]),
      // Top products by revenue this month
      Order.aggregate([
        { $match: { "payment.status": "paid", orderStatus: { $nin: ["cancelled"] }, createdAt: { $gte: startOfMonth } } },
        { $unwind: "$items" },
        {
          $group: {
            _id: { name: "$items.name", category: "$items.category" },
            revenue: { $sum: "$items.totalPrice" },
            units: { $sum: "$items.quantity" },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
      // Order status breakdown
      Order.aggregate([
        { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
      ]),
    ]);

    const thisMonthRevenue = thisMonthData[0]?.revenue || 0;
    const lastMonthRevenue = lastMonthData[0]?.revenue || 0;
    const thisMonthUnits = thisMonthData[0]?.units || 0;
    const lastMonthUnits = lastMonthData[0]?.units || 0;

    const revDelta = lastMonthRevenue > 0
      ? Number((((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1))
      : 0;
    const unitsDelta = lastMonthUnits > 0
      ? Number((((thisMonthUnits - lastMonthUnits) / lastMonthUnits) * 100).toFixed(1))
      : 0;

    return res.json({
      success: true,
      stats: {
        monthlyRevenue: Math.round(thisMonthRevenue),
        revenueDelta: revDelta,
        monthlySoldUnits: thisMonthUnits,
        unitsDelta,
        topProducts: topProducts.map((p) => ({
          name: p._id.name,
          category: p._id.category || "General",
          revenue: Math.round(p.revenue),
          units: p.units,
        })),
        statusBreakdown: statusBreakdown.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {}),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch report stats",
    });
  }
};
