const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const Otp = require("../models/Otp");
const OtpRateLimit = require("../models/OtpRateLimit");
const RefreshSession = require("../models/RefreshSession");
const { signAccessToken, signRefreshToken } = require("../utils/jwt");
const { getRefreshCookieOptions } = require("../utils/cookies");
const { sendMessage } = require("../services/otpService");

/**
 * 6-digit OTP
 */
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

exports.sendOtp = async (req, res) => {
  const { contact } = req.body;

  const isEmail = contact.includes("@");
  const query = isEmail ? { email: contact } : { phone: contact };
  const existing = await User.findOne(query).select("_id");
  const isNewUser = !existing;

  // Rate Limiting check (max 5 OTPs per day per contact)
  const today = new Date().toISOString().split('T')[0]; 
  let rateLimit = await OtpRateLimit.findOne({ contact, date: today });

  if (rateLimit) {
    if (rateLimit.count >= 5) {
      return res.status(429).json({ message: "Daily OTP limit reached (5 requests/day). Please try again tomorrow." });
    }
    rateLimit.count += 1;
    await rateLimit.save();
  } else {
    await OtpRateLimit.create({ contact, date: today, count: 1 });
  }

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

  try {
    const message = `Your FONEST login OTP is: ${otp}. It is valid for 5 minutes. Please do not share this code.`;
    await sendMessage(contact, message, "FONEST Login OTP");
    res.json({ message: "OTP sent successfully", isNewUser });
  } catch (error) {
    console.error("Failed to send OTP:", error);
    res.status(500).json({ message: "Failed to send OTP", error: error.message });
  }
};

exports.verifyOtpAndLogin = async (req, res) => {
  const { contact, otp, name } = req.body;
  
  if (!contact) return res.status(400).json({ message: "contact required" });
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
    isNewUser = true; 
    
    // ✅ set true for new user
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name required for new user" });
    }
    user = await User.create({
      ...query,
      name: name || "User",
      authProvider: "otp",
      isVerified: true,
      status: "active",
      lastActive: new Date()
    });
  } else {
    if (user.status === "suspended") {
      return res.status(403).json({ message: "User suspended" });
    }

    user.isVerified = true;
    user.lastActive = new Date();
    await user.save();
  }

  await Otp.deleteOne({ contact, purpose: "login" });

  // ✅ tokens
  const accessToken = signAccessToken(user);

  // ✅ refresh session (single write)
  const sessionId = new mongoose.Types.ObjectId();
  const refreshToken = signRefreshToken(user, sessionId);
  const tokenHash = await bcrypt.hash(refreshToken, 10);
  
  await RefreshSession.create({
    _id: sessionId,
    userId: user._id,
    deviceName: req.headers["x-device-name"] || "unknown",
    ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip,
    userAgent: req.headers["user-agent"],
    tokenHash,
    isRevoked: false,
    lastUsedAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  res.cookie("refreshToken", refreshToken, getRefreshCookieOptions());

  return res.json({
    message: "Login success",
    accessToken,
    isNewUser,
    user: { id: user._id, name: user.name, role: user.role }
  });
};