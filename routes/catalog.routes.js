const router = require("express").Router();
const upload = require("../middleware/uploadMemory");
const auth = require("../middleware/auth");

const category = require("../controllers/category.controller");
const brand = require("../controllers/brand.controller");

router.post("/categories", auth(["admin"]), upload.single("image"), category.createCategory);
router.get("/categories", auth(["admin"]), category.listCategories);
router.patch("/categories/:id", auth(["admin"]), upload.single("image"), category.updateCategory);
router.delete("/categories/:id", auth(["admin"]), category.deleteCategory);
;

// BRAND
router.post("/brands", auth(["admin"]), upload.single("logo"), brand.createBrand);
router.get("/brands", auth(["admin"]), brand.listBrands);
router.patch("/brands/:id", auth(["admin"]), upload.single("logo"), brand.updateBrand);
router.delete("/brands/:id", auth(["admin"]), brand.deleteBrand)

module.exports = router;