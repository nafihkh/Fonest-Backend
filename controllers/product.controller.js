const Product = require("../models/Product");
const { uploadBufferToCloudinary } = require("../utils/cloudinaryUpload");
const { buildSku } = require("../utils/sku");

// OPTIONAL: replace with your real category/brand code logic
async function getCategoryCode(categoryId) {
  // Example: "MOB"
  return "MOB";
}
async function getBrandCode(brandId) {
  // Example: "APL"
  return "APL";
}

async function nextSerial() {
  // simple serial: count + 1 (ok for small scale; later use counter collection)
  const count = await Product.countDocuments();
  return count + 1;
}

// POST /api/products  (creates as draft by default)
exports.createProduct = async (req, res) => {
  try {
    const {
      categoryId,
      brandId,
      name,
      description,
      condition,
      price,
      costPrice,
      compareAtPrice,
      stock,
      lowStockThreshold,
      status, // allow draft/active if you want (optional)
      isFeatured,
    } = req.body;

    // 1) upload images to cloudinary
    const files = req.files || [];
    const folder = process.env.CLOUDINARY_FOLDER || "fonest/products";

    const uploaded = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const result = await uploadBufferToCloudinary(f.buffer, {
        folder,
        resource_type: "image",
      });
      uploaded.push({
        url: result.secure_url,
        publicId: result.public_id,
        isPrimary: i === 0,
        sortOrder: i,
      });
    }

    // 2) generate SKU
    const serial = await nextSerial();
    const categoryCode = await getCategoryCode(categoryId);
    const brandCode = await getBrandCode(brandId);
    const sku = buildSku({ categoryCode, brandCode, serial });

    // 3) create product
    const product = await Product.create({
      categoryId,
      brandId,
      sku,
      name,
      description,
      condition: condition || "new",
      price: Number(price),
      costPrice: Number(costPrice || 0),
      compareAtPrice: Number(compareAtPrice || 0),
      stock: Number(stock || 0),
      lowStockThreshold: Number(lowStockThreshold || 0),
      status: status || "draft", // ✅ draft by default
      isFeatured: Boolean(isFeatured),
      images: uploaded,
      createdBy: req.user?.id, // if you have auth
      updatedBy: req.user?.id,
    });

    return res.status(201).json({ success: true, product });
  } catch (err) {
    // handle duplicate SKU error
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: "SKU already exists. Try again." });
    }
    console.error(err);
    return res.status(500).json({ success: false, message: "Create product failed" });
  }
};

// PATCH /api/products/:id/publish  (draft -> active)
exports.publishProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: "Not found" });

    product.status = "active";
    product.updatedBy = req.user?.id;
    await product.save();

    return res.json({ success: true, product });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Publish failed" });
  }
};

// GET /api/products?status=draft|active
exports.listProducts = async (req, res) => {
  try {
    const { status } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .select("name sku price stock status isFeatured slug images createdAt");

    return res.json({ success: true, products });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "List failed" });
  }
};