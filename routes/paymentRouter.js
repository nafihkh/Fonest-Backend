const router = require("express").Router();
const checkout = require("../controllers/checkout.controller");
const auth = require("../middleware/auth");


router.post("/checkout/apply-coupon", auth(["customer"]), checkout.applyCoupon);
router.post("/coupons", checkout.createCoupon);
router.delete("/coupons/:id", auth(["admin"]), checkout.deleteCoupon);
router.post(
  "/checkout/create-razorpay-order",
  auth(["customer"]),
  checkout.createRazorpayOrder
);

router.post(
  "/checkout/verify-razorpay-payment",
  auth(["customer"]),
  checkout.verifyRazorpayPayment
);
router.post(
  "/checkout/create-cart-razorpay-order",
  auth(["customer"]),
  checkout.createCartRazorpayOrder );

  router.post(
  "/checkout/verify-cart-razorpay-payment",
  auth(["customer"]),
  checkout.verifyCartRazorpayPayment
);
router.post("/checkout/apply-cart-coupon", auth(["customer"]), checkout.applyCartCoupon);

module.exports = router;