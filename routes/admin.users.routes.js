const router = require("express").Router();
const usrctrl = require("../controllers/admin.users.controller");


router.get("/users", usrctrl.listUsers);
router.get("/users/stats", usrctrl.userStats);

// optional generic status update
router.patch("/users/:id/status", usrctrl.updateUserStatus);

// direct actions
router.patch("/users/:id/block", usrctrl.blockUser);
router.patch("/users/:id/unblock", usrctrl.unblockUser);

router.delete("/users/:id", usrctrl.deleteUser);

module.exports = router;