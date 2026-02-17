const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Otp = require("../models/Otp");
const { signAccessToken } = require("../utils/jwt");

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

exports.sendOtp = async (req, res) => {
  const { contact } = req.body;
  console.log(contact);

  // remove existing OTP for this contact (so unique index won't fail)
  await Otp.deleteOne({ contact, purpose: "login" });

  const otp = generateOtp();
  const codeHash = await bcrypt.hash(otp, 10);

  await Otp.create({
    contact,
    codeHash,
    purpose: "login",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 mins
  });

  console.log("✅ OTP for", contact, "=>", otp);

  res.json({ message: "OTP sent (check console)" });
};

exports.verifyOtpAndLogin = async (req, res) => {
  const { contact, otp, name } = req.body;

  const record = await Otp.findOne({ contact, purpose: "login" });
  if (!record) return res.status(400).json({ message: "OTP expired or not found" });

  const ok = await bcrypt.compare(String(otp), record.codeHash);
  if (!ok) return res.status(400).json({ message: "Invalid OTP" });

  const isEmail = contact.includes("@");
  const query = isEmail ? { email: contact } : { phone: contact };

  let user = await User.findOne(query);

  // create new user = registration
  if (!user) {
    user = await User.create({
      ...query,
      name: name || "User",
      authProvider: "otp",
      isVerified: true,
      status: "active",
      lastActive: new Date()
    });
  } else {
    if (user.status === "suspended") return res.status(403).json({ message: "User suspended" });

    user.isVerified = true;
    user.lastActive = new Date();
    await user.save();
  }

  // OTP used -> delete it
  await Otp.deleteOne({ contact, purpose: "login" });

  const accessToken = signAccessToken(user);

  res.json({
    message: "Login success",
    accessToken,
    user: { id: user._id, name: user.name, role: user.role }
  });
};