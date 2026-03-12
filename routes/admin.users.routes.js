const router = require("express").Router();
const usrctrl = require("../controllers/admin.users.controller");
const auth = require("../middleware/auth");
const multer = require("multer");
const {
  getMySettings,
  updateProfileSettings,
  updateAppearanceSettings,
  updateNotificationSettings,
  updateSecuritySettings,
  updateAvatar,
} = require("../controllers/settingsController");

const upload = multer({ storage: multer.memoryStorage() });


router.get("/users", usrctrl.listUsers);
router.get("/users/stats", usrctrl.userStats);

// optional generic status update
router.patch("/users/:id/status", usrctrl.updateUserStatus);

// direct actions
router.patch("/users/:id/block", usrctrl.blockUser);
router.patch("/users/:id/unblock", usrctrl.unblockUser);

router.delete("/users/:id", usrctrl.deleteUser);

router.get("/settings", auth(["admin"]), getMySettings);
router.patch("/settings/profile",auth(["admin"]), updateProfileSettings);
router.patch("/settings/appearance",auth(["admin"]), updateAppearanceSettings);
router.patch("/settings/notifications",auth(["admin"]), updateNotificationSettings);
router.patch("/settings/security",auth(["admin"]), updateSecuritySettings);
router.patch("/settings/avatar",auth(["admin"]), upload.single("avatar"), updateAvatar);

module.exports = router;