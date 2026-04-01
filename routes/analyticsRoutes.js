const router = require("express").Router();
const auth = require("../middleware/auth");
const { getProfitStats, getReportStats } = require("../controllers/analyticsController");

router.get("/admin/analytics/profit", auth(["admin"]), getProfitStats);
router.get("/admin/analytics/reports", auth(["admin"]), getReportStats);

module.exports = router;
