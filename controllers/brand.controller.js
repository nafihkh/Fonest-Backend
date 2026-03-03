const Brand = require("../models/Brand");
const { uploadBufferToCloudinary } = require("../utils/cloudinaryUpload");
const cloudinary = require("../config/cloudinary");

exports.createBrand = async (req, res) => {
  try {
    const { name, description, isActive } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "name is required" });
    }

    let logo = { url: "", publicId: "" };

    // file key: "logo"
    if (req.file?.buffer) {
      const folder = process.env.CLOUDINARY_FOLDER || "fonest";
      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: `${folder}/brands`,
        resource_type: "image",
      });

      logo = { url: result.secure_url, publicId: result.public_id };
    }

    const brand = await Brand.create({
      name: name.trim(),
      description: description || "",
      isActive: isActive !== undefined ? String(isActive) === "true" : true,
      logo,
    });

    return res.status(201).json({ success: true, brand });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: "Brand name already exists" });
    }
    console.error(err);
    return res.status(500).json({ success: false, message: "Create brand failed" });
  }
};

exports.listBrands = async (req, res) => {
  try {
    const { active } = req.query;
    const filter = {};
    if (active === "true") filter.isActive = true;

    const brands = await Brand.find(filter).sort({ createdAt: -1 });
    return res.json({ success: true, brands });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "List brands failed" });
  }
};

exports.updateBrand = async (req, res) => {
  try {
    const { id } = req.params;

    const brand = await Brand.findById(id);
    if (!brand) return res.status(404).json({ success: false, message: "Not found" });

    const { name, description, isActive } = req.body;

    if (name !== undefined) brand.name = name.trim();
    if (description !== undefined) brand.description = description;
    if (isActive !== undefined) brand.isActive = String(isActive) === "true";

    if (req.file?.buffer) {
      if (brand.logo?.publicId) {
        await cloudinary.uploader.destroy(brand.logo.publicId).catch(() => {});
      }

      const folder = process.env.CLOUDINARY_FOLDER || "fonest";
      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: `${folder}/brands`,
        resource_type: "image",
      });

      brand.logo = { url: result.secure_url, publicId: result.public_id };
    }

    await brand.save();
    return res.json({ success: true, brand });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Update brand failed" });
  }
};
exports.deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    const brand = await Brand.findByIdAndDelete(id);
    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }

    res.json({ message: "Brand deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed", error: err.message });
  }
};