const router = require("express").Router();
const auth = require("../middleware/auth");
const {
  getProfitStats,
  getReportStats,
  getDashboardStats,
  getNotificationAlerts,
} = require("../controllers/analyticsController");

router.get("/admin/analytics/profit",        auth(["admin"]), getProfitStats);
router.get("/admin/analytics/reports",       auth(["admin"]), getReportStats);
router.get("/admin/analytics/dashboard",     auth(["admin"]), getDashboardStats);
router.get("/admin/analytics/alerts",        auth(["admin"]), getNotificationAlerts);

module.exports = router;
