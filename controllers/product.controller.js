const Product = require("../models/Product");
const { uploadBufferToCloudinary } = require("../utils/cloudinaryUpload");
const { buildSku } = require("../utils/sku");
const Brand = require("../models/Brand");
const Category = require("../models/Category");
const {
  buildPagination,
  buildSort,
  buildSearch,
  buildPaginationMeta,
} = require("../utils/queryHelper");

// OPTIONAL: replace with your real category/brand code logic
async function getCategoryCode(categoryId) {
  return "MOB";
}
async function getBrandCode(brandId) {
  return "APL";
}

async function nextSerial() {
  const count = await Product.countDocuments();
  return count + 1;
}

// POST /api/products
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
      status,
      isFeatured,
    } = req.body;

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

    const serial = await nextSerial();
    const categoryCode = await getCategoryCode(categoryId);
    const brandCode = await getBrandCode(brandId);
    const sku = buildSku({ categoryCode, brandCode, serial });

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
      lowStockThreshold:
        lowStockThreshold !== undefined && lowStockThreshold !== ""
          ? Number(lowStockThreshold)
          : 10,
      status: (status || "draft").toLowerCase(),
      isFeatured: String(isFeatured) === "true" || isFeatured === true,
      images: uploaded,
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
    });

    return res.status(201).json({ success: true, product });
  } catch (err) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "SKU already exists. Try again." });
    }

    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Create product failed" });
  }
};

// PATCH /api/products/:id/publish
exports.publishProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    product.status = "active";
    product.updatedBy = req.user?.id;
    await product.save();

    return res.json({ success: true, product });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Publish failed" });
  }
};

// GET /api/products?search=&status=&page=&limit=&sortBy=&order=
exports.listProducts = async (req, res) => {
  try {
    const { search = "", status = "" } = req.query;
    const { page, limit, skip } = buildPagination(req.query);
    const sort = buildSort(req.query, ["createdAt", "name", "price", "stock", "status"]);

    const filter = {};

    if (status?.trim()) {
      filter.status = status.trim().toLowerCase();
    }

    Object.assign(filter, buildSearch(search, ["name", "sku"]));

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("brandId", "name")
        .populate("categoryId", "name")
        .select("name sku price stock status isFeatured slug images brandId categoryId createdAt"),
      Product.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      products,
      pagination: buildPaginationMeta(total, page, limit),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "List failed" });
  }
};

// GET /api/products/stats
exports.productStats = async (req, res) => {
  try {
    const [totalProducts, activeProducts, draftProducts, outOfStock, products] =
      await Promise.all([
        Product.countDocuments({}),
        Product.countDocuments({ status: "active" }),
        Product.countDocuments({ status: "draft" }),
        Product.countDocuments({ stock: 0 }),
        Product.find({}).select("stock lowStockThreshold").lean(),
      ]);

    const lowStockItems = products.filter((p) => {
      const stock = Number(p.stock || 0);
      const threshold = Number(
        p.lowStockThreshold !== undefined ? p.lowStockThreshold : 10
      );
      return stock > 0 && stock <= threshold;
    }).length;

    return res.json({
      success: true,
      stats: {
        totalProducts,
        activeProducts,
        draftProducts,
        outOfStock,
        lowStockItems,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Failed to load product stats",
    });
  }
};

// PATCH /api/products/bulk-action
// body: { ids: [], action: "publish" | "archive" | "delete" }
exports.bulkActionProducts = async (req, res) => {
  try {
    const { ids = [], action } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No product ids provided",
      });
    }

    if (!["publish", "archive", "delete"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bulk action",
      });
    }

    let result;

    if (action === "publish") {
      result = await Product.updateMany(
        { _id: { $in: ids } },
        {
          $set: {
            status: "active",
            updatedBy: req.user?.id,
          },
        }
      );
    }

    if (action === "archive") {
      result = await Product.updateMany(
        { _id: { $in: ids } },
        {
          $set: {
            status: "archived",
            updatedBy: req.user?.id,
          },
        }
      );
    }

    if (action === "delete") {
      result = await Product.deleteMany({ _id: { $in: ids } });
    }

    return res.json({
      success: true,
      message: `Bulk action "${action}" completed`,
      result,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Bulk action failed",
    });
  }
};

exports.searchProductSuggestions = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    if (!q) {
      return res.json({
        success: true,
        products: [],
      });
    }

    const filter = {
      $or: [
        { name: { $regex: q, $options: "i" } },
        { sku: { $regex: q, $options: "i" } },
      ],
      status: { $in: ["active", "draft", "inactive", "archived"] },
    };

    const products = await Product.find(filter)
      .select("name sku stock status price images lowStockThreshold")
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    const mapped = products.map((p) => ({
      _id: p._id,
      name: p.name,
      sku: p.sku,
      stock: Number(p.stock || 0),
      status: p.status,
      price: Number(p.price || 0),
      image: p.images?.find((img) => img.isPrimary)?.url || p.images?.[0]?.url || "",
      lowStockThreshold: Number(p.lowStockThreshold || 0),
    }));

    return res.json({
      success: true,
      products: mapped,
    });
  } catch (err) {
    console.error("searchProductSuggestions error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to search products",
    });
  }
};
// PATCH /api/products/low-stock-threshold
// body: { lowStockThreshold: 15 }
exports.applyLowStockThresholdToAllProducts = async (req, res) => {
  try {
    const { lowStockThreshold } = req.body;

    const threshold = Number(lowStockThreshold);

    if (!Number.isFinite(threshold) || threshold < 0) {
      return res.status(400).json({
        success: false,
        message: "Low stock threshold must be 0 or greater",
      });
    }

    const result = await Product.updateMany(
      {},
      {
        $set: {
          lowStockThreshold: threshold,
          updatedBy: req.user?.id || req.user?._id || null,
        },
      }
    );

    return res.json({
      success: true,
      message: `Low stock threshold updated to ${threshold} for all products`,
      result,
    });
  } catch (err) {
    console.error("applyLowStockThresholdToAllProducts error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update low stock threshold",
    });
  }
};
// GET /api/store/products
exports.listStoreProducts = async (req, res) => {
  try {
    const {
      search = "",
      featured = "",
      category = "",
      brand = "",
      minPrice = "",
      maxPrice = "",
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 12,
    } = req.query;

    const filter = {
      status: "active",
      stock: { $gt: 0 },
    };

    if (featured === "true") {
      filter.isFeatured = true;
    }

    if (category.trim()) {
      filter.categoryId = category;
    }

    if (brand.trim()) {
      filter.brandId = brand;
    }

    if (search.trim()) {
      Object.assign(filter, buildSearch(search, ["name", "sku"]));
    }

    if (minPrice !== "" || maxPrice !== "") {
      filter.price = {};
      if (minPrice !== "") filter.price.$gte = Number(minPrice);
      if (maxPrice !== "") filter.price.$lte = Number(maxPrice);
    }

    const allowedSort = ["createdAt", "name", "price"];
    const finalSortBy = allowedSort.includes(sortBy) ? sortBy : "createdAt";
    const finalOrder = order === "asc" ? 1 : -1;

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.max(Number(limit) || 12, 1);
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ [finalSortBy]: finalOrder })
        .skip(skip)
        .limit(limitNum)
        .populate("brandId", "name")
        .populate("categoryId", "name")
        .select(
          "name slug sku price compareAtPrice stock isFeatured images brandId categoryId createdAt"
        )
        .lean(),
      Product.countDocuments(filter),
    ]);

    const mapped = products.map((p) => ({
      _id: p._id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      price: Number(p.price || 0),
      compareAtPrice: Number(p.compareAtPrice || 0),
      stock: Number(p.stock || 0),
      isFeatured: !!p.isFeatured,
      brand: p.brandId?.name || "",
      brandId: p.brandId?._id || "",
      category: p.categoryId?.name || "",
      categoryId: p.categoryId?._id || "",
      image:
        p.images?.find((img) => img.isPrimary)?.url ||
        p.images?.[0]?.url ||
        "",
    }));

    return res.json({
      success: true,
      products: mapped,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("listStoreProducts error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load store products",
    });
  }
};

// GET /api/store/products/:id
exports.getStoreProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({
      _id: id,
      status: "active",
    })
      .populate("brandId", "name")
      .populate("categoryId", "name")
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({
      success: true,
      product: {
        _id: product._id,
        name: product.name,
        description: product.description,
        sku: product.sku,
        slug: product.slug,
        price: Number(product.price || 0),
        compareAtPrice: Number(product.compareAtPrice || 0),
        stock: Number(product.stock || 0),
        isFeatured: !!product.isFeatured,
        brand: product.brandId?.name || "",
        category: product.categoryId?.name || "",
        images: (product.images || []).map((img) => ({
          url: img.url,
          isPrimary: !!img.isPrimary,
          sortOrder: img.sortOrder || 0,
        })),
      },
    });
  } catch (err) {
    console.error("getStoreProductById error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load product",
    });
  }
};
// GET /api/store/featured-products
exports.listFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({
      status: "active",
      stock: { $gt: 0 },
      isFeatured: true,
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate("brandId", "name")
      .populate("categoryId", "name")
      .select(
        "name slug sku price compareAtPrice stock isFeatured images brandId categoryId createdAt"
      )
      .lean();

    const mapped = products.map((p) => ({
      _id: p._id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      price: Number(p.price || 0),
      compareAtPrice: Number(p.compareAtPrice || 0),
      stock: Number(p.stock || 0),
      isFeatured: !!p.isFeatured,
      brand: p.brandId?.name || "",
      category: p.categoryId?.name || "",
      image:
        p.images?.find((img) => img.isPrimary)?.url ||
        p.images?.[0]?.url ||
        "",
    }));

    return res.json({
      success: true,
      products: mapped,
    });
  } catch (err) {
    console.error("listFeaturedProducts error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load featured products",
    });
  }
};
// DELETE /api/products/:id
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    await Product.deleteOne({ _id: id });

    return res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (err) {
    console.error("deleteProduct error:", err);
    return res.status(500).json({
      success: false,
      message: "Delete product failed",
    });
  }
};

exports.getStoreFilters = async (req, res) => {
  try {
    const [brands, categories] = await Promise.all([
      Brand.find({}).select("_id name").sort({ name: 1 }).lean(),
      Category.find({}).select("_id name").sort({ name: 1 }).lean(),
    ]);

    return res.json({
      success: true,
      brands,
      categories,
    });
  } catch (err) {
    console.error("getStoreFilters error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load filters",
    });
  }
}