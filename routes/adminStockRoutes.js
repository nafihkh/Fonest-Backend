const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const {
  createStockEntry,
  createStockOutEntry,
  searchStockProducts,
  listStockActivity,
  stockStats,
  listStockAlerts,
  listStockHistory,
  updateStockHistory,
  deleteStockHistory,
  getStockAlertDetails,
  rebuildStockAlerts,
} = require("../controllers/adminStockController");


router.get("/products/search", auth(["admin"]), searchStockProducts);

router.post("/in", auth(["admin"]), createStockEntry);
router.post("/out", auth(["admin"]), createStockOutEntry);

router.get("/activity", auth(["admin"]), listStockActivity);
router.get("/stats", auth(["admin"]), stockStats);
router.get("/alerts", auth(["admin"]), listStockAlerts);
router.get("/history", auth(["admin"]), listStockHistory);
router.patch("/history/:type/:id", auth(["admin"]), updateStockHistory);
router.delete("/history/:type/:id", auth(["admin"]), deleteStockHistory);

router.get("/alerts/:id", auth(["admin"]), getStockAlertDetails);
router.post("/alerts/rebuild", auth(["admin"]), rebuildStockAlerts);

module.exports = router;