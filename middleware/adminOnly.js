module.exports = function adminOnly(req, res, next) {
  // req.user should be set by your auth middleware
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role !== "Admin") return res.status(403).json({ message: "Forbidden" });
  next();
};