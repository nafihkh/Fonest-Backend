const router = require("express").Router();
const cartController = require("../controllers/cartController");
router.post("/cart/add/:productId", auth(["customer"]), cartController.addToCart);