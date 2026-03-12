const jwt = require("jsonwebtoken");
const User = require("../models/User");

function auth(allowedRoles = []) {
  return async (req, res, next) => {
    try {
      let token = null;
        console.log("auth header:", req.headers.authorization);
      // 1) Read Bearer token from Authorization header
      if (req.headers.authorization?.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
      }

      // If you ever decide to store access token in cookie also,
      // you can optionally read it here:
      // if (!token && req.cookies?.accessToken) {
      //   token = req.cookies.accessToken;
      // }

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Access token missing",
        });
      }

      // 2) Verify access token
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      if (!decoded?.id) {
        return res.status(401).json({
          success: false,
          message: "Invalid access token",
        });
      }

      // 3) Load current user from DB
      const user = await User.findById(decoded.id).select(
        "_id name email role status"
      );

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      // Optional account status check
      if (user.status && user.status !== "active") {
        return res.status(403).json({
          success: false,
          message: "Account is not active",
        });
      }

      // 4) Role authorization
      if (
        Array.isArray(allowedRoles) &&
        allowedRoles.length > 0 &&
        !allowedRoles.includes(user.role)
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to access this resource",
        });
      }

      // 5) Attach user to request
      req.user = {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      };

      next();
    } catch (err) {
      console.error("auth middleware error:", err);

      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Access token expired",
          code: "ACCESS_TOKEN_EXPIRED",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
  };
}

module.exports = auth;