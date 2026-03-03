const router = require("express").Router();
const upload = require("../middleware/uploadMemory");
const product = require("../controllers/product.controller");

// If you have auth middleware, add it:
// const { verifyAccessToken } = require("../middleware/auth");

router.post(
  "/products",
  /* verifyAccessToken, */
  upload.array("images", 6),
  product.createProduct
);

router.patch(
  "/products/:id/publish",
  /* verifyAccessToken, */
  product.publishProduct
);

router.get(
  "/products",
  /* verifyAccessToken, */
  product.listProducts
);

module.exports = router;