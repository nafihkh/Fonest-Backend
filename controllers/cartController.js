const Cart = require("../models/Cart");
const Product = require("../models/Product");


function isSameCartItem(item, productId) {
  return (
    String(item.product) === String(productId)
  );
}

// helper: calculate totals
function buildCartSummary(cart) {
  const items = cart.items || [];

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0),
    0
  );

  return {
    totalItems,
    subtotal,
  };
}

// GET /api/cart
exports.getCart = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    let cart = await Cart.findOne({ user: userId })
      .populate("items.product");

    if (!cart) {
      return res.json({
        success: true,
        message: "Cart fetched successfully",
        cart: {
          user: userId,
          items: [],
          totalItems: 0,
          subtotal: 0,
        },
      });
    }

    const summary = buildCartSummary(cart);

    return res.json({
      success: true,
      message: "Cart fetched successfully",
      cart: {
        ...cart.toObject(),
        ...summary,
      },
    });
  } catch (err) {
    console.error("getCart error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch cart",
    });
  }
};

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

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (!Number.isFinite(quantity) || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
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

    const existingIndex = cart.items.findIndex((item) =>
      isSameCartItem(item, productId)
    );

    if (existingIndex > -1) {
      const newQty = cart.items[existingIndex].quantity + quantity;

      if (newQty > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} item(s) available in stock`,
        });
      }

      cart.items[existingIndex].quantity = newQty;
      cart.items[existingIndex].unitPrice = product.price;
    } else {
      if (quantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} item(s) available in stock`,
        });
      }

      cart.items.push({
        product: productId,
        quantity,
        unitPrice: product.price,
      });
    }

    await cart.save();

    cart = await Cart.findOne({ user: userId })
      .populate("items.product");
    const summary = buildCartSummary(cart);

    return res.json({
      success: true,
      message: "Product added to cart",
      cart: {
        ...cart.toObject(),
        ...summary,
      },
    });
  } catch (err) {
    console.error("addToCart error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to add to cart",
    });
  }
};

// PATCH /api/cart/update/:productId
exports.updateCartQuantity = async (req, res) => {
  try {
    const { productId } = req.params;
    const quantity = Number(req.body.quantity);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (!Number.isFinite(quantity)) {
      return res.status(400).json({
        success: false,
        message: "Valid quantity is required",
      });
    }

    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const itemIndex = cart.items.findIndex((item) =>
      isSameCartItem(item, productId)
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart",
      });
    }

    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      const product = await Product.findById(productId);

      if (!product || product.status !== "active") {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      if (quantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} item(s) available in stock`,
        });
      }

      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].unitPrice = product.price;
    }

    await cart.save();

    const updatedCart = await Cart.findOne({ user: userId })
      .populate("items.product");

    const summary = buildCartSummary(updatedCart);

    return res.json({
      success: true,
      message: "Cart updated successfully",
      cart: {
        ...updatedCart.toObject(),
        ...summary,
      },
    });
  } catch (err) {
    console.error("updateCartQuantity error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update cart",
    });
  }
};

// DELETE /api/cart/remove/:productId
exports.removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const originalLength = cart.items.length;

    cart.items = cart.items.filter(
      (item) => !isSameCartItem(item, productId)
    );

    if (cart.items.length === originalLength) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart",
      });
    }

    await cart.save();

    const updatedCart = await Cart.findOne({ user: userId })
      .populate("items.product");

    const summary = buildCartSummary(updatedCart);

    return res.json({
      success: true,
      message: "Product removed from cart",
      cart: {
        ...updatedCart.toObject(),
        ...summary,
      },
    });
  } catch (err) {
    console.error("removeFromCart error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to remove product",
    });
  }
};

// DELETE /api/cart/clear
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = await Cart.create({
        user: userId,
        items: [],
      });
    } else {
      cart.items = [];
      await cart.save();
    }

    return res.json({
      success: true,
      message: "Cart cleared successfully",
      cart: {
        ...cart.toObject(),
        totalItems: 0,
        subtotal: 0,
      },
    });
  } catch (err) {
    console.error("clearCart error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to clear cart",
    });
  }
};