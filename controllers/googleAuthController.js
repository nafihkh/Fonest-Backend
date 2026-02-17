const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { signAccessToken, signRefreshToken } = require("../utils/jwt");
const RefreshSession = require("../models/RefreshSession");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { getRefreshCookieOptions } = require("../utils/cookies");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ message: "idToken required" });

  // ✅ verify token
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();
  const googleId = payload.sub;
  const email = payload.email;
  const name = payload.name || "User";
  const picture = payload.picture;

  // find user
  let user = await User.findOne({ $or: [{ googleId }, { email }] });
  let isNewUser = false;
  if (!user) {
      isNewUser = true;
    user = await User.create({
      name,
      email,
      googleId,
      profilePhoto: picture,
      authProvider: "google",
      isVerified: true,
      status: "active",
      lastActive: new Date()
    });
  } else {
    if (user.status === "suspended") return res.status(403).json({ message: "User suspended" });

    user.googleId = user.googleId || googleId;
    user.authProvider = "google";
    user.isVerified = true;
    user.lastActive = new Date();
    if (!user.profilePhoto && picture) user.profilePhoto = picture;
    if (!user.name && name) user.name = name;

    await user.save();
  }

  // ✅ tokens
  const accessToken = signAccessToken(user);

  // refresh session
  const sessionId = new mongoose.Types.ObjectId();
  const refreshToken = signRefreshToken(user, sessionId);
  const tokenHash = await bcrypt.hash(refreshToken, 10);

  await RefreshSession.create({
    _id: sessionId,
    userId: user._id,
    deviceName: req.headers["x-device-name"] || "unknown",
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    tokenHash,
    isRevoked: false,
    lastUsedAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  res.cookie("refreshToken", refreshToken, getRefreshCookieOptions());

  return res.json({
    message: "Google login success",
    accessToken,
     isNewUser,
    user: { id: user._id, name: user.name, role: user.role }
  });
};