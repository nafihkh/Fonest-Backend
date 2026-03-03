const mongoose = require("mongoose");
const slugify = require("slugify");

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, index: true },

    // Optional but useful (your UI has it)
    description: { type: String, default: "" },

    logo: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

brandSchema.pre("save", function () {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

module.exports = mongoose.model("Brand", brandSchema);