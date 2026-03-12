const User = require("../models/User");
const UserSettings = require("../models/UserSettings");
const { uploadBufferToCloudinary } = require("../utils/cloudinaryUpload");

async function getOrCreateSettings(userId) {
  let settings = await UserSettings.findOne({ userId });

  if (!settings) {
    settings = await UserSettings.create({ userId });
  }

  return settings;
}

// GET /api/settings
exports.getMySettings = async (req, res) => {
  try {
    console.log(req.user,"userid")
    const userId = req.user?._id || req.user?.id;
    

    const [user, settings] = await Promise.all([
      User.findById(userId).select("name email phone avatar"),
      getOrCreateSettings(userId),
    ]);

    return res.json({
      success: true,
      profile: {
        name: user?.name || "",
        email: user?.email || "",
        phone: user?.phone || "",
        avatar: user?.avatar || { url: "", publicId: "" },
      },
      settings,
    });
  } catch (err) {
    console.error("getMySettings error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load settings",
    });
  }
};

// PATCH /api/settings/profile
exports.updateProfileSettings = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { name, email, phone } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const normalizedName = String(name).trim();
    const normalizedEmail =
      email !== undefined ? String(email).trim().toLowerCase() : currentUser.email;
    const normalizedPhone =
      phone !== undefined ? String(phone).trim() : currentUser.phone;

    // check email duplicate only if email changed
    if (
      normalizedEmail &&
      normalizedEmail !== String(currentUser.email || "").trim().toLowerCase()
    ) {
      const existingEmail = await User.findOne({
        email: normalizedEmail,
      }).lean();

      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: "Email already in use",
        });
      }
    }

    // check phone duplicate only if phone changed
    if (
      normalizedPhone &&
      normalizedPhone !== String(currentUser.phone || "").trim()
    ) {
      const existingPhone = await User.findOne({
        phone: normalizedPhone,
      }).lean();

      if (existingPhone) {
        return res.status(409).json({
          success: false,
          message: "Phone already in use",
        });
      }
    }

    currentUser.name = normalizedName;
    currentUser.email = normalizedEmail;
    currentUser.phone = normalizedPhone;

    await currentUser.save();

    return res.json({
      success: true,
      message: "Profile updated successfully",
      profile: {
        name: currentUser.name || "",
        email: currentUser.email || "",
        phone: currentUser.phone || "",
        avatar: currentUser.avatar || { url: "", publicId: "" },
      },
    });
  } catch (err) {
    console.error("updateProfileSettings error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

// PATCH /api/settings/appearance
exports.updateAppearanceSettings = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { theme } = req.body;

    if (!["light", "dark", "system"].includes(theme)) {
      return res.status(400).json({
        success: false,
        message: "Invalid theme value",
      });
    }

    const settings = await getOrCreateSettings(userId);
    settings.appearance.theme = theme;
    await settings.save();

    return res.json({
      success: true,
      message: "Appearance settings updated",
      appearance: settings.appearance,
    });
  } catch (err) {
    console.error("updateAppearanceSettings error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update appearance settings",
    });
  }
};

// PATCH /api/settings/notifications
exports.updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const settings = await getOrCreateSettings(userId);

    const allowedKeys = [
      "stockAlerts",
      "outOfStockAlerts",
      "returnRequests",
      "dailySalesSummary",
      "systemUpdates",
    ];

    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        settings.notifications[key] = Boolean(req.body[key]);
      }
    }

    await settings.save();

    return res.json({
      success: true,
      message: "Notification settings updated",
      notifications: settings.notifications,
    });
  } catch (err) {
    console.error("updateNotificationSettings error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update notification settings",
    });
  }
};

// PATCH /api/settings/security
exports.updateSecuritySettings = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const settings = await getOrCreateSettings(userId);

    const {
      twoFactorEnabled,
      loginAlerts,
      sessionTimeoutMinutes,
      profileVisibility,
    } = req.body;

    if (twoFactorEnabled !== undefined) {
      settings.security.twoFactorEnabled = Boolean(twoFactorEnabled);
    }

    if (loginAlerts !== undefined) {
      settings.security.loginAlerts = Boolean(loginAlerts);
    }

    if (sessionTimeoutMinutes !== undefined) {
      const value = Number(sessionTimeoutMinutes);
      if (!Number.isFinite(value) || value < 5 || value > 1440) {
        return res.status(400).json({
          success: false,
          message: "Session timeout must be between 5 and 1440 minutes",
        });
      }
      settings.security.sessionTimeoutMinutes = value;
    }

    if (profileVisibility !== undefined) {
      if (!["private", "team", "public"].includes(profileVisibility)) {
        return res.status(400).json({
          success: false,
          message: "Invalid profile visibility value",
        });
      }
      settings.security.profileVisibility = profileVisibility;
    }

    await settings.save();

    return res.json({
      success: true,
      message: "Security & privacy settings updated",
      security: settings.security,
    });
  } catch (err) {
    console.error("updateSecuritySettings error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update security settings",
    });
  }
};

// PATCH /api/settings/avatar
exports.updateAvatar = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Avatar image is required",
      });
    }

    const folder = process.env.CLOUDINARY_FOLDER || "fonest/avatars";

    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder,
      resource_type: "image",
    });

    const user = await User.findByIdAndUpdate(
      userId,
      {
        avatar: {
          url: result.secure_url,
          publicId: result.public_id,
        },
      },
      { new: true }
    ).select("name email phone avatar");

    return res.json({
      success: true,
      message: "Avatar updated successfully",
      profile: user,
    });
  } catch (err) {
    console.error("updateAvatar error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to upload avatar",
    });
  }
};