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
const pushCtrl = require("../controllers/webPushController");

const upload = multer({ storage: multer.memoryStorage() });


router.get("/users", auth(["admin"]), usrctrl.listUsers);
router.get("/users/stats", auth(["admin"]), usrctrl.userStats);

// optional generic status update
router.patch("/users/:id/status", auth(["admin"]), usrctrl.updateUserStatus);

// direct actions
router.patch("/users/:id/block", auth(["admin"]), usrctrl.blockUser);
router.patch("/users/:id/unblock", auth(["admin"]), usrctrl.unblockUser);

router.delete("/users/:id", auth(["admin"]), usrctrl.deleteUser);

router.get("/settings", auth(["admin"]), getMySettings);
router.patch("/settings/profile",auth(["admin"]), updateProfileSettings);
router.patch("/settings/appearance",auth(["admin"]), updateAppearanceSettings);
router.patch("/settings/notifications",auth(["admin"]), updateNotificationSettings);
router.patch("/settings/security",auth(["admin"]), updateSecuritySettings);
router.patch("/settings/avatar",auth(["admin"]), upload.single("avatar"), updateAvatar);

router.get("/settings/push/vapidPublicKey", auth(["admin"]), pushCtrl.getVapidPublicKey);
router.post("/settings/push/subscribe", auth(["admin"]), pushCtrl.subscribe);
router.post("/settings/push/unsubscribe", auth(["admin"]), pushCtrl.unsubscribe);
router.post("/settings/push/test", auth(["admin"]), pushCtrl.testPush);

module.exports = router;