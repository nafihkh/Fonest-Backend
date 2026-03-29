const router = require("express").Router();
const profile = require("../controllers/profile.controller");
const auth = require("../middleware/auth");

router.get("/profile/me", auth(["customer", "admin", "staff"]), profile.getMyProfile);
router.patch("/profile/me", auth(["customer", "admin", "staff"]), profile.updateMyProfile);

router.get("/profile/settings", auth(["customer", "admin", "staff"]), profile.getMySettings);
router.patch("/profile/settings", auth(["customer", "admin", "staff"]), profile.updateMySettings);

router.get("/profile/addresses", auth(["customer", "admin", "staff"]), profile.getMyAddresses);
router.post("/profile/addresses", auth(["customer", "admin", "staff"]), profile.addAddress);
router.patch("/profile/addresses/:id", auth(["customer", "admin", "staff"]), profile.updateAddress);
router.delete("/profile/addresses/:id", auth(["customer", "admin", "staff"]), profile.deleteAddress);
router.patch("/profile/addresses/:id/default", auth(["customer", "admin", "staff"]), profile.setDefaultAddress);

module.exports = router;