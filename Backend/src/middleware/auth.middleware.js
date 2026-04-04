const jwt = require("jsonwebtoken");
const userProfileModel = require("../models/userProfile.model");

const getJwtSecret = () => process.env.JWT_SECRET || "dev_jwt_secret_change_me";

const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
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

module.exports = {
  requireAuth,
  getJwtSecret,
};
