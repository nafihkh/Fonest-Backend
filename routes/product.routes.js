const router = require("express").Router();
const upload = require("../middleware/uploadMemory");
const product = require("../controllers/product.controller");

// If you have auth middleware, add it:
// const { verifyAccessToken } = require("../middleware/auth");

router.post("/products", upload.array("images", 6), product.createProduct);
router.get("/products", product.listProducts);
router.get("/products/stats", product.productStats);
router.patch("/products/:id/publish", product.publishProduct);
router.patch("/products/bulk-action", product.bulkActionProducts);
router.get("/search-suggestions", product.searchProductSuggestions);
router.patch("/low-stock-threshold", product.applyLowStockThresholdToAllProducts);
module.exports = router;