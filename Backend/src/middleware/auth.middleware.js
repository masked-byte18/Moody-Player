const jwt = require("jsonwebtoken");
const userProfileModel = require("../models/userProfile.model");

const getJwtSecret = () => process.env.JWT_SECRET || "dev_jwt_secret_change_me";
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "moody_auth_token";

const resolveTokenFromHeader = (headerValue = "") => {
  const [scheme, token] = String(headerValue).split(" ");
  if (scheme !== "Bearer" || !token) {
    return "";
  }
  return token;
};

const parseCookies = (cookieHeader = "") => {
  const pairs = String(cookieHeader || "")
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return pairs.reduce((accumulator, pair) => {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0) return accumulator;

    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    accumulator[name] = decodeURIComponent(value);
    return accumulator;
  }, {});
};

const resolveTokenFromCookie = (cookieHeader = "") => {
  const cookies = parseCookies(cookieHeader);
  return cookies[AUTH_COOKIE_NAME] || "";
};

const resolveAuthToken = (req) =>
  resolveTokenFromHeader(req.headers.authorization || "") ||
  resolveTokenFromCookie(req.headers.cookie || "");

const requireAuth = async (req, res, next) => {
  try {
    const token = resolveAuthToken(req);
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
    const token = resolveAuthToken(req);
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
  AUTH_COOKIE_NAME,
};
