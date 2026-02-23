const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { signAccessToken, signRefreshToken } = require("../utils/jwt");
const RefreshSession = require("../models/RefreshSession");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { getRefreshCookieOptions } = require("../utils/cookies");
const fetch = global.fetch || require("node-fetch");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
  const { idToken, access_token } = req.body;

  let payload;

  // 1️⃣ If frontend sends ID token (GoogleLogin component)
  if (idToken) {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    payload = ticket.getPayload();
  }

  // 2️⃣ If frontend sends access_token (useGoogleLogin custom button)
  if (!payload && access_token) {
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      }
    );

    if (!response.ok) {
      return res.status(400).json({ message: "Invalid Google access token" });
    }

    payload = await response.json();
  }

  if (!payload) {
    return res.status(400).json({
      message: "idToken or access_token required"
    });
  }
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
    ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip,
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