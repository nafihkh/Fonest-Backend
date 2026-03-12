const express = require("express");
const router = express.Router();

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


router.get("/products/search", searchStockProducts);

router.post("/in", createStockEntry);
router.post("/out", createStockOutEntry);

router.get("/activity", listStockActivity);
router.get("/stats", stockStats);
router.get("/alerts", listStockAlerts);
router.get("/history", listStockHistory);
router.patch("/history/:type/:id", updateStockHistory);
router.delete("/history/:type/:id", deleteStockHistory);

router.get("/alerts/:id", getStockAlertDetails);
router.post("/alerts/rebuild", rebuildStockAlerts);

module.exports = router;