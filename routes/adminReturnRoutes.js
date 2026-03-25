const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  listReturns,
  returnStats,
  getReturnDetails,
  approveReturn,
  rejectReturn,
  receiveReturn,
} = require("../controllers/adminReturnController");

// add auth/admin middleware here if needed
// const { protect } = require("../middlewares/authMiddleware");
// const { requireAdmin } = require("../middlewares/roleMiddleware");
// router.use(protect, requireAdmin);

router.get("/", auth(["admin"]), listReturns);
router.get("/stats", auth(["admin"]), returnStats);
router.get("/:id", auth(["admin"]), getReturnDetails);

router.patch("/:id/approve", auth(["admin"]), approveReturn);
router.patch("/:id/reject", auth(["admin"]), rejectReturn);
router.patch("/:id/receive", auth(["admin"]), receiveReturn);

module.exports = router;