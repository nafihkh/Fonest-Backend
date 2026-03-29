const mongoose = require("mongoose");
const User = require("../models/User");
const UserSettings = require("../models/UserSettings");
const UserAddress = require("../models/UserAddress");

exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const [user, settings, addresses] = await Promise.all([
      User.findById(userId).select(
        "name email phone profile_photo createdAt role status"
      ),
      UserSettings.findOne({ userId }),
      UserAddress.find({ userId }).sort({ isDefault: -1, createdAt: -1 }),
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      profile: {
        _id: user._id,
        fullName: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        avatar: user.profile_photo || "",
        memberSince: user.createdAt,
        settings: settings || null,
        addresses: addresses || [],
      },
    });
  } catch (error) {
    console.error("getMyProfile error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load profile",
    });
  }
};

exports.updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, email, phone, avatar } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          name: fullName,
          email,
          phone,
          profile_photo: avatar,
        },
      },
      { new: true, runValidators: true }
    ).select("name email phone profile_photo createdAt");

    return res.json({
      success: true,
      message: "Profile updated successfully",
      profile: {
        _id: user._id,
        fullName: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        avatar: user.profile_photo || "",
        memberSince: user.createdAt,
      },
    });
  } catch (error) {
    console.error("updateMyProfile error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

exports.getMySettings = async (req, res) => {
  try {
    const userId = req.user.id;

    let settings = await UserSettings.findOne({ userId });

    if (!settings) {
      settings = await UserSettings.create({ userId });
    }

    return res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("getMySettings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load settings",
    });
  }
};

exports.updateMySettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { appearance, notifications, security } = req.body;

    let settings = await UserSettings.findOne({ userId });

    if (!settings) {
      settings = new UserSettings({ userId });
    }

    if (appearance) {
      settings.appearance = {
        ...settings.appearance?.toObject?.(),
        ...appearance,
      };
    }

    if (notifications) {
      settings.notifications = {
        ...settings.notifications?.toObject?.(),
        ...notifications,
      };
    }

    if (security) {
      settings.security = {
        ...settings.security?.toObject?.(),
        ...security,
      };
    }

    await settings.save();

    return res.json({
      success: true,
      message: "Settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("updateMySettings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update settings",
    });
  }
};

exports.getMyAddresses = async (req, res) => {
  try {
    const userId = req.user.id;

    const addresses = await UserAddress.find({ userId }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    return res.json({
      success: true,
      addresses,
    });
  } catch (error) {
    console.error("getMyAddresses error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load addresses",
    });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      label,
      fullName,
      phone,
      line1,
      line2,
      city,
      state,
      pincode,
      landmark,
      isDefault,
    } = req.body;

    if (isDefault) {
      await UserAddress.updateMany(
        { userId, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const existingCount = await UserAddress.countDocuments({ userId });

    const address = await UserAddress.create({
      userId,
      label,
      fullName,
      phone,
      line1,
      line2,
      city,
      state,
      pincode,
      landmark,
      isDefault: existingCount === 0 ? true : !!isDefault,
    });

    const addresses = await UserAddress.find({ userId }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    return res.status(201).json({
      success: true,
      message: "Address added successfully",
      address,
      addresses,
    });
  } catch (error) {
    console.error("addAddress error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add address",
    });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const data = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address id",
      });
    }

    if (data.isDefault) {
      await UserAddress.updateMany(
        { userId, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const address = await UserAddress.findOneAndUpdate(
      { _id: id, userId },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const addresses = await UserAddress.find({ userId }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    return res.json({
      success: true,
      message: "Address updated successfully",
      address,
      addresses,
    });
  } catch (error) {
    console.error("updateAddress error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update address",
    });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address id",
      });
    }

    const address = await UserAddress.findOne({ _id: id, userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const wasDefault = address.isDefault;

    await UserAddress.deleteOne({ _id: id, userId });

    if (wasDefault) {
      const firstAddress = await UserAddress.findOne({ userId }).sort({
        createdAt: -1,
      });

      if (firstAddress) {
        firstAddress.isDefault = true;
        await firstAddress.save();
      }
    }

    const addresses = await UserAddress.find({ userId }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    return res.json({
      success: true,
      message: "Address deleted successfully",
      addresses,
    });
  } catch (error) {
    console.error("deleteAddress error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete address",
    });
  }
};

exports.setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address id",
      });
    }

    await UserAddress.updateMany(
      { userId, isDefault: true },
      { $set: { isDefault: false } }
    );

    const address = await UserAddress.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isDefault: true } },
      { new: true }
    );

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const addresses = await UserAddress.find({ userId }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    return res.json({
      success: true,
      message: "Default address updated successfully",
      addresses,
    });
  } catch (error) {
    console.error("setDefaultAddress error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to set default address",
    });
  }
};