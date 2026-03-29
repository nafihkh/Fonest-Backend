const express = require("express");
const router = express.Router();

const cartController = require("../controllers/cartController");
const auth = require("../middleware/auth");

router.get("/", auth(["customer"]), cartController.getCart);
router.post("/add/:productId", auth(["customer"]), cartController.addToCart);
router.patch("/update/:productId", auth(["customer"]), cartController.updateCartQuantity);
router.delete("/remove/:productId", auth(["customer"]), cartController.removeFromCart);
router.delete("/clear", auth(["customer"]), cartController.clearCart);

module.exports = router;