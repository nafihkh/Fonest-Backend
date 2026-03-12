const express = require("express");
const router = express.Router();

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

router.get("/", listReturns);
router.get("/stats", returnStats);
router.get("/:id", getReturnDetails);

router.patch("/:id/approve", approveReturn);
router.patch("/:id/reject", rejectReturn);
router.patch("/:id/receive", receiveReturn);

module.exports = router;