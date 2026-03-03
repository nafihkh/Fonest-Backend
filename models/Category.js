const mongoose = require("mongoose");
const slugify = require("slugify");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, index: true },
    description: { type: String, default: "" },

    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.pre("save", function () {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

module.exports = mongoose.model("Category", categorySchema);