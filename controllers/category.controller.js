const Category = require("../models/Category");
const { uploadBufferToCloudinary } = require("../utils/cloudinaryUpload");
const cloudinary = require("../config/cloudinary");

exports.createCategory = async (req, res) => {
  try {
    const { name, description, isActive } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "name is required" });
    }

    let image = { url: "", publicId: "" };

    // file key: "image"
    if (req.file?.buffer) {
      const folder = process.env.CLOUDINARY_FOLDER || "fonest";
      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: `${folder}/categories`,
        resource_type: "image",
      });

      image = { url: result.secure_url, publicId: result.public_id };
    }

    const category = await Category.create({
      name: name.trim(),
      description: description || "",
      isActive: isActive !== undefined ? String(isActive) === "true" : true,
      image,
    });

    return res.status(201).json({ success: true, category });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: "Category name already exists" });
    }
    console.error(err);
    return res.status(500).json({ success: false, message: "Create category failed" });
  }
};

exports.listCategories = async (req, res) => {
  try {
    const { active } = req.query;
    const filter = {};
    if (active === "true") filter.isActive = true;

    const categories = await Category.find(filter).sort({ createdAt: -1 });
    return res.json({ success: true, categories });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "List categories failed" });
  }
};

// Optional: update (handles replacing image & deleting old cloudinary image)
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) return res.status(404).json({ success: false, message: "Not found" });

    const { name, description, isActive } = req.body;

    if (name !== undefined) category.name = name.trim();
    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = String(isActive) === "true";

    if (req.file?.buffer) {
      // delete old
      if (category.image?.publicId) {
        await cloudinary.uploader.destroy(category.image.publicId).catch(() => {});
      }

      const folder = process.env.CLOUDINARY_FOLDER || "fonest";
      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: `${folder}/categories`,
        resource_type: "image",
      });

      category.image = { url: result.secure_url, publicId: result.public_id };
    }

    await category.save();
    return res.json({ success: true, category });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Update category failed" });
  }
};
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json({ message: "Category deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed", error: err.message });
  }
};