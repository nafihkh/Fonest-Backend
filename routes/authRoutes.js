const router = require("express").Router();
const validate = require("../middleware/validate");
const authValid = require("../validators/authValidators");
const otpAuthctrl = require("../controllers/otpAuthController");
const google = require("../controllers/googleAuthController");

router.post("/otp/send", validate(authValid.sendOtpSchema), otpAuthctrl.sendOtp);
router.post("/otp/verify", validate(authValid.verifyOtpSchema), otpAuthctrl.verifyOtpAndLogin);
router.post("/google", google.googleLogin);

module.exports = router;