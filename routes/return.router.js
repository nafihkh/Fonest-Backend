const router = require("express").Router();
const auth = require("../middleware/auth");
const {
  createReturn,
  getMyReturns,
  getReturnById,
} = require("../controllers/returnController");

// Customer return routes
router.post("/returns", auth(["customer"]), createReturn);
router.get("/returns/my-returns", auth(["customer"]), getMyReturns);
router.get("/returns/:id", auth(["customer"]), getReturnById);

module.exports = router;
