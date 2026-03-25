const Cart = require("../models/Cart");
const Product = require("../models/Product");

// POST /api/cart/add/:productId
exports.addToCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const quantity = Number(req.body.quantity || 1);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const product = await Product.findById(productId);

    if (!product || product.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.stock <= 0) {
      return res.status(400).json({
        success: false,
        message: "Product is out of stock",
      });
    }

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = await Cart.create({
        user: userId,
        items: [],
      });
    }

    const existingIndex = cart.items.findIndex(
      (item) => String(item.product) === String(productId)
    );

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += quantity;
    } else {
      cart.items.push({
        product: productId,
        quantity,
      });
    }

    await cart.save();

    return res.json({
      success: true,
      message: "Product added to cart",
      cart,
    });
  } catch (err) {
    console.error("addToCart error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to add to cart",
    });
  }
};