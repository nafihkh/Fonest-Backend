const mongoose = require("mongoose");
const slugify = require("slugify");

const productImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true }, // for delete
    isPrimary: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    // your diagram -> Mongo version
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", required: true },

    sku: { type: String, unique: true, index: true },

    name: { type: String, required: true, trim: true },
    slug: { type: String, index: true },

    description: { type: String, default: "" },

    condition: { type: String, enum: ["new", "used"], default: "new" },

    price: { type: Number, required: true }, // selling price
    costPrice: { type: Number, default: 0 },
    compareAtPrice: { type: Number, default: 0 },

    stock: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 0 },

    // ✅ Draft system here
    status: {
      type: String,
      enum: ["draft", "active", "inactive", "archived"],
      default: "draft",
      index: true,
    },

    isFeatured: { type: Boolean, default: false },

    images: { type: [productImageSchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

productSchema.pre("save", function () {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

module.exports = mongoose.model("Product", productSchema);