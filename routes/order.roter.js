const router = require("express").Router();
const orderController = require("../controllers/orderController")
const auth = require("../middleware/auth");


router.get("/orders/:id", auth(["customer"]), orderController.getOrderById);
router.get("/orders/my-orders", auth(["customer"]), orderController.getMyOrders);
module.exports = router;