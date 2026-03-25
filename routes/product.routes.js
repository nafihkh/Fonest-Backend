const router = require("express").Router();
const upload = require("../middleware/uploadMemory");
const product = require("../controllers/product.controller");
const auth = require("../middleware/auth");

// If you have auth middleware, add it:
// const { verifyAccessToken } = require("../middleware/auth");

router.post("/products", auth(["admin"]), upload.array("images", 6), product.createProduct);
router.get("/products", auth(["admin"]), product.listProducts);
router.get("/products/stats", auth(["admin"]), product.productStats);
router.patch("/products/:id/publish", auth(["admin"]), product.publishProduct);
router.patch("/products/bulk-action", auth(["admin"]), product.bulkActionProducts);
router.get("/search-suggestions", auth(["admin"]), product.searchProductSuggestions);
router.patch("/low-stock-threshold", auth(["admin"]), product.applyLowStockThresholdToAllProducts);
router.delete("/products/:id", auth(["admin"]), product.deleteProduct);


router.get("/store/featured-products", product.listFeaturedProducts);
router.get("/store/products", product.listStoreProducts);
router.get("/store/products/:id", product.getStoreProductById);
router.get("/store/filters", product.getStoreFilters);
module.exports = router;