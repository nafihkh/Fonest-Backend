const jwt = require("jsonwebtoken");

const signAccessToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: "15m"
  });

module.exports = { signAccessToken };