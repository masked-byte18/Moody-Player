const jwt = require("jsonwebtoken");
const userProfileModel = require("../models/userProfile.model");

const getJwtSecret = () => process.env.JWT_SECRET || "dev_jwt_secret_change_me";

const resolveTokenFromHeader = (headerValue = "") => {
  const [scheme, token] = String(headerValue).split(" ");
  if (scheme !== "Bearer" || !token) {
    return "";
  }
  return token;
};

const requireAuth = async (req, res, next) => {
  try {
    const token = resolveTokenFromHeader(req.headers.authorization || "");
    if (!token) {
      return res.status(401).json({ message: "Authorization token is required" });
    }

    const payload = jwt.verify(token, getJwtSecret());
    const user = await userProfileModel.findById(payload.userId);

    if (!user) {
      return res.status(401).json({ message: "User not found for token" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = resolveTokenFromHeader(req.headers.authorization || "");
    if (!token) {
      return next();
    }

    const payload = jwt.verify(token, getJwtSecret());
    const user = await userProfileModel.findById(payload.userId);

    if (user) {
      req.user = user;
    }
  } catch (error) {
    // Optional auth should not block public access.
  }

  return next();
};

module.exports = {
  requireAuth,
  optionalAuth,
  getJwtSecret,
};
