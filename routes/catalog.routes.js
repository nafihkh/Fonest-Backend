const router = require("express").Router();
const upload = require("../middleware/uploadMemory");

const category = require("../controllers/category.controller");
const brand = require("../controllers/brand.controller");

router.post("/categories", upload.single("image"), category.createCategory);
router.get("/categories", category.listCategories);
router.patch("/categories/:id", upload.single("image"), category.updateCategory);
router.delete("/categories/:id", category.deleteCategory);
;

// BRAND
router.post("/brands", upload.single("logo"), brand.createBrand);
router.get("/brands", brand.listBrands);
router.patch("/brands/:id", upload.single("logo"), brand.updateBrand);
router.delete("/brands/:id", brand.deleteBrand)

module.exports = router;