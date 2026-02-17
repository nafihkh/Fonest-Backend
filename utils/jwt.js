const jwt = require("jsonwebtoken");

const signAccessToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );

const signRefreshToken = (user, sessionId) =>
  jwt.sign(
    { id: user._id, sessionId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

module.exports = { signAccessToken, signRefreshToken };