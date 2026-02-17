const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Otp = require("../models/Otp");
const RefreshSession = require("../models/RefreshSession");
const { signAccessToken, signRefreshToken } = require("../utils/jwt");
const { getRefreshCookieOptions } = require("../utils/cookies");

/**
 * 6-digit OTP
 */
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

exports.sendOtp = async (req, res) => {
  const { contact } = req.body;

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

  if (record.expiresAt.getTime() < Date.now()) {
    await Otp.deleteOne({ _id: record._id });
    return res.status(400).json({ message: "OTP expired" });
  }

  const ok = await bcrypt.compare(String(otp), record.codeHash);
  if (!ok) return res.status(400).json({ message: "Invalid OTP" });

  const isEmail = contact.includes("@");
  const query = isEmail ? { email: contact } : { phone: contact };

  let user = await User.findOne(query);
  let isNewUser = false;

  if (!user) {
    let isNewUser = false;
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

  await Otp.deleteOne({ contact, purpose: "login" });
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, session._id);
  const tokenHash = await bcrypt.hash(refreshToken, 10);

  const session = await RefreshSession.create({
    userId: user._id,
    deviceName: req.headers["x-device-name"] || "unknown",
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    tokenHash,
    isRevoked: false,
    lastUsedAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });

  await session.save();


  res.cookie("refreshToken", refreshToken, getRefreshCookieOptions());


  res.json({
    message: "Login success",
    accessToken,
     isNewUser,
    user: { id: user._id, name: user.name, role: user.role }
  });
};