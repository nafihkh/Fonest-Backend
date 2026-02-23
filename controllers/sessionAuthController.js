const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const RefreshSession = require("../models/RefreshSession");
const { signAccessToken } = require("../utils/jwt");
const { getRefreshCookieOptions } = require("../utils/cookies");
const User = require("../models/User");

exports.refreshAccessToken = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) return res.status(401).json({ message: "No refresh token" });

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (e) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const sessionId = decoded.sid || decoded.sessionId;
  const userId = decoded.sub || decoded.id || decoded.userId;

  if (!sessionId || !userId) {
    return res.status(401).json({ message: "Invalid refresh token payload" });
  }

  const session = await RefreshSession.findById(sessionId);
  if (!session) return res.status(401).json({ message: "Session not found" });

  if (session.isRevoked) return res.status(401).json({ message: "Session revoked" });
  if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
    return res.status(401).json({ message: "Session expired" });
  }

  const ok = await bcrypt.compare(refreshToken, session.tokenHash);
  if (!ok) return res.status(401).json({ message: "Refresh token mismatch" });

  // ✅ issue new access token (short-lived)
  const accessToken = signAccessToken({ _id: session.userId, role: session.role });
  const user = await User.findById(session.userId).select("name role");
  session.lastUsedAt = new Date();
  await session.save();

  return res.json({ 
    accessToken,
    user: {
    id: user._id,
    name: user.name,
    role: user.role
  }
   });
};

exports.logout = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  // best effort revoke
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      const sessionId = decoded.sid || decoded.sessionId;
      if (sessionId) {
        await RefreshSession.updateOne(
          { _id: sessionId },
          { $set: { isRevoked: true, lastUsedAt: new Date() } }
        );
      }
    } catch (e) {
      // ignore
    }
  }

  // ✅ clear cookie (must match same options: especially path)
  res.clearCookie("refreshToken", getRefreshCookieOptions());
  return res.json({ message: "Logged out" });
};


