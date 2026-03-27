const Coupon = require("../models/Coupon");
const Product = require("../models/Product");
const crypto = require("crypto");
const razorpay = require("../utils/razorpay");
const Payment = require("../models/Payment");
const Order = require("../models/Order");
const mongoose = require("mongoose");

exports.applyCoupon = async (req, res) => {
  try {
    const { productId, quantity, couponCode } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({
        success: false,
        message: "Product and quantity are required",
      });
    }

    const qty = Number(quantity);
    if (qty < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const subtotal = Number(product.price || 0) * qty;
    const deliveryCharge = 0;

    if (!couponCode?.trim()) {
      return res.json({
        success: true,
        pricing: {
          subtotal,
          couponDiscount: 0,
          deliveryCharge,
          finalAmount: subtotal + deliveryCharge,
        },
        coupon: null,
        message: "No coupon applied",
      });
    }

    const code = couponCode.trim().toUpperCase();

    const coupon = await Coupon.findOne({ code });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Invalid coupon code",
      });
    }

    if (!coupon.isActive) {
      return res.status(400).json({
        success: false,
        message: "Coupon is inactive",
      });
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Coupon has expired",
      });
    }

    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: "Coupon usage limit reached",
      });
    }

    if (subtotal < coupon.minOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value is ₹${coupon.minOrderValue}`,
      });
    }

    let couponDiscount = 0;

    if (coupon.type === "flat") {
      couponDiscount = coupon.value;
    }

    if (coupon.type === "percent") {
      couponDiscount = (subtotal * coupon.value) / 100;

      if (coupon.maxDiscount > 0) {
        couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
      }
    }

    couponDiscount = Math.min(couponDiscount, subtotal);

    const finalAmount = Math.max(subtotal - couponDiscount + deliveryCharge, 0);

    return res.json({
      success: true,
      pricing: {
        subtotal,
        couponDiscount,
        deliveryCharge,
        finalAmount,
      },
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
      },
      message: "Coupon applied successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to apply coupon",
    });
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      type,
      value,
      minOrderValue,
      maxDiscount,
      expiresAt,
      usageLimit,
    } = req.body;

    if (!code || !type || !value) {
      return res.status(400).json({
        success: false,
        message: "code, type, and value are required",
      });
    }

    const existing = await Coupon.findOne({
      code: code.toUpperCase(),
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Coupon already exists",
      });
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      type,
      value,
      minOrderValue: minOrderValue || 0,
      maxDiscount: maxDiscount || 0,
      expiresAt: expiresAt || null,
      usageLimit: usageLimit || 0,
    });

    return res.status(201).json({
      success: true,
      coupon,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    await Coupon.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete coupon",
    });
  }
};

exports.createRazorpayOrder = async (req, res) => {
  try {
    const { productId, quantity, couponCode } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({
        success: false,
        message: "Product and quantity are required",
      });
    }

    const qty = Number(quantity);
    if (qty < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const subtotal = Number(product.price || 0) * qty;
    const deliveryCharge = 0;

    let couponDiscount = 0;
    let appliedCoupon = null;

    if (couponCode?.trim()) {
      const code = couponCode.trim().toUpperCase();
      const coupon = await Coupon.findOne({ code });

      if (coupon && coupon.isActive) {
        const isExpired =
          coupon.expiresAt && new Date(coupon.expiresAt) < new Date();

        const usageExceeded =
          coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit;

        const minOrderFailed = subtotal < coupon.minOrderValue;

        if (!isExpired && !usageExceeded && !minOrderFailed) {
          if (coupon.type === "flat") {
            couponDiscount = coupon.value;
          }

          if (coupon.type === "percent") {
            couponDiscount = (subtotal * coupon.value) / 100;

            if (coupon.maxDiscount > 0) {
              couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
            }
          }

          couponDiscount = Math.min(couponDiscount, subtotal);
          appliedCoupon = coupon;
        }
      }
    }

    const finalAmount = Math.max(
      subtotal - couponDiscount + deliveryCharge,
      0
    );

    const options = {
      amount: Math.round(finalAmount * 100), // paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: {
        productId: String(product._id),
        quantity: String(qty),
        couponCode: appliedCoupon?.code || "",
      },
    };

    const order = await razorpay.orders.create(options);

    return res.status(201).json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      pricing: {
        subtotal,
        couponDiscount,
        deliveryCharge,
        finalAmount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create Razorpay order",
    });
  }
};

exports.verifyRazorpayPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      productId,
      quantity,
      couponCode,
      address,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !productId ||
      !quantity
    ) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "Missing required payment fields",
      });
    }
    console.log("verify body:", req.body);
    console.log("req.user:", req.user);

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    const qty = Number(quantity);

    const product = await Product.findById(productId).session(session);

    if (!product) {
      await session.abortTransaction();
      session.endSession();

      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.stock < qty) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "Not enough stock available",
      });
    }

    const subtotal = Number(product.price || 0) * qty;
    const deliveryCharge = 0;

    let couponDiscount = 0;
    let appliedCoupon = null;

    if (couponCode?.trim()) {
      const code = couponCode.trim().toUpperCase();

      const coupon = await Coupon.findOne({ code }).session(session);

      if (coupon && coupon.isActive) {
        const isExpired =
          coupon.expiresAt && new Date(coupon.expiresAt) < new Date();

        const usageExceeded =
          coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit;

        const minOrderFailed = subtotal < coupon.minOrderValue;

        if (!isExpired && !usageExceeded && !minOrderFailed) {
          if (coupon.type === "flat") {
            couponDiscount = coupon.value;
          } else if (coupon.type === "percent") {
            couponDiscount = (subtotal * coupon.value) / 100;

            if (coupon.maxDiscount > 0) {
              couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
            }
          }

          couponDiscount = Math.min(couponDiscount, subtotal);
          appliedCoupon = coupon;
        }
      }
    }

    const finalAmount = Math.max(
      subtotal - couponDiscount + deliveryCharge,
      0
    );

    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 5);

    const estimatedDeliveryText = deliveryDate.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    const paymentDocs = await Payment.create(
      [
        {
          userId: req.user?.id,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          amount: finalAmount,
          currency: "INR",
          status: "paid",
          meta: {
            productId: String(product._id),
            quantity: qty,
            couponCode: appliedCoupon?.code || "",
          },
        },
      ],
      { session }
    );

    const payment = paymentDocs[0];

    const orderDocs = await Order.create(
      [
        {
          userId: req.user?.id,
          items: [
            {
              productId: product._id,
              name: product.name,
              image: product.images?.[0]?.url || product.images?.[0] || "",
              price: product.price,
              quantity: qty,
            },
          ],
          paymentId: payment._id,
          address: {
            fullName: address?.fullName || "",
            phone: address?.phone || "",
            line1: address?.line1 || "",
            line2: address?.line2 || "",
            city: address?.city || "",
            state: address?.state || "",
            pincode: address?.pincode || "",
            country: address?.country || "India",
          },
          pricing: {
            subtotal,
            couponDiscount,
            deliveryCharge,
            total: finalAmount,
          },
          coupon: appliedCoupon
            ? {
                code: appliedCoupon.code,
                type: appliedCoupon.type,
                value: appliedCoupon.value,
              }
            : null,
          payment: {
            method: "razorpay",
            status: "paid",
          },
          orderStatus: "placed",
          estimatedDeliveryText,
        },
      ],
      { session }
    );

    const order = orderDocs[0];

    payment.orderId = order._id;
    await payment.save({ session });

    product.stock = product.stock - qty;
    await product.save({ session });

    if (appliedCoupon) {
      appliedCoupon.usedCount += 1;
      await appliedCoupon.save({ session });
    }

    await session.commitTransaction();
    session.endSession();
    console.log("payment created:", payment._id);
    console.log("order created:", order._id);

    return res.json({
      success: true,
      message: "Order placed successfully",
      orderId: order._id,
      order,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to place order",
    });
  }
};
