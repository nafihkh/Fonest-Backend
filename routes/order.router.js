const router = require("express").Router();
const orderController = require("../controllers/orderController")
const auth = require("../middleware/auth");


router.get("/orders/my-orders", auth(["customer"]), orderController.getMyOrders);
router.get("/orders/:id", auth(["customer"]), orderController.getOrderById);

router.get("/admin/orders", auth(["admin"]), orderController.getAdminOrders);
router.patch("/admin/orders/:id/status", auth(["admin"]), orderController.updateOrderStatus);

module.exports = router;