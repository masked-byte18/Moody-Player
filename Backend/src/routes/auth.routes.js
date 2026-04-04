const crypto = require("crypto");
const dns = require("dns").promises;
const express = require("express");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");
const userProfileModel = require("../models/userProfile.model");
const playlistModel = require("../models/playlist.model");
const uploadFile = require("../service/storage.service");
const { requireAuth, getJwtSecret } = require("../middleware/auth.middleware");

const router = express.Router();

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image files are allowed"), false);
  },
});

const normalizeUsername = (value = "") => value.trim().toLowerCase();
const normalizeEmail = (value = "") => value.trim().toLowerCase();

const hashValue = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const createOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const createToken = (user) =>
  jwt.sign(
    {
      userId: user._id.toString(),
      username: user.username,
      email: user.email || "",
    },
    getJwtSecret(),
    { expiresIn: "7d" }
  );

const getMailTransportConfig = () => {
  const service = String(process.env.SMTP_SERVICE || "").trim();
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);

  if (service) {
    return {
      service,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };
  }

  return {
    host,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };
};

const smtpConfigured = () =>
  Boolean(
    (process.env.SMTP_SERVICE || (process.env.SMTP_HOST && process.env.SMTP_PORT)) &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.MAIL_FROM
  );

const sendOtpEmail = async (email, otp, purpose) => {
  const allowDevOtpFallback = String(process.env.ALLOW_DEV_OTP_FALLBACK || "").trim().toLowerCase() === "true";

  if (!smtpConfigured()) {
    if (!allowDevOtpFallback) {
      throw new Error("SMTP is not fully configured and dev OTP fallback is disabled");
    }
    console.log(`[DEV OTP] ${purpose} OTP for ${email}: ${otp}`);
    return;
  }

  const transporter = nodemailer.createTransport(getMailTransportConfig());

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: `Moody Player ${purpose} OTP`,
    text: `Your Moody Player ${purpose} OTP is ${otp}. It expires in 10 minutes.`,
  });
};

const isEmailDomainValid = async (email) => {
  const atIndex = email.indexOf("@");
  if (atIndex === -1) return false;

  const domain = email.slice(atIndex + 1);
  if (!domain) return false;

  try {
    const mx = await dns.resolveMx(domain);
    return Array.isArray(mx) && mx.length > 0;
  } catch (error) {
    return false;
  }
};

const userResponse = (user) => ({
  username: user.username,
  displayName: user.displayName || user.username,
  email: user.email || "",
  profilePhoto: user.profilePhoto || "",
  following: user.following || [],
  isEmailVerified: Boolean(user.isEmailVerified),
});

router.post("/auth/signup", async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username || "");
    const displayName = String(req.body.displayName || username || "").trim();
    const email = normalizeEmail(req.body.email || "");
    const password = String(req.body.password || "");

    if (!username || !email || !password) {
      return res.status(400).json({ message: "username, email and password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const emailSyntax = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailSyntax.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const emailExists = await isEmailDomainValid(email);
    if (!emailExists) {
      return res.status(400).json({ message: "Email domain is not valid or reachable" });
    }

    const existingUsername = await userProfileModel.findOne({ username });
    if (existingUsername && existingUsername.email && existingUsername.email !== email) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const existingEmail = await userProfileModel.findOne({ email });
    if (existingEmail && existingEmail.username !== username) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const otp = createOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await userProfileModel.findOneAndUpdate(
      { username },
      {
        $set: {
          username,
          displayName,
          email,
          passwordHash,
          isEmailVerified: false,
          otpCodeHash: hashValue(otp),
          otpExpiresAt,
          otpPurpose: "signup",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await sendOtpEmail(email, otp, "signup verification");

    return res.status(200).json({
      message: "OTP sent to email",
      requiresOtp: true,
      otpDelivery: smtpConfigured() ? "email" : "dev-console",
      user: userResponse(user),
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Signup failed" });
  }
});

router.post("/auth/verify-signup", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email || "");
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "email and otp are required" });
    }

    const user = await userProfileModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.otpPurpose !== "signup" || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired or invalid" });
    }

    if (user.otpCodeHash !== hashValue(otp)) {
      return res.status(400).json({ message: "Incorrect OTP" });
    }

    user.isEmailVerified = true;
    user.otpCodeHash = "";
    user.otpExpiresAt = null;
    user.otpPurpose = "";
    user.lastLoginAt = new Date();
    await user.save();

    return res.status(200).json({
      message: "Signup verified",
      token: createToken(user),
      user: userResponse(user),
    });
  } catch (error) {
    console.error("Verify signup error:", error);
    return res.status(500).json({ message: "Verification failed" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const identifier = String(req.body.identifier || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!identifier || !password) {
      return res.status(400).json({ message: "identifier and password are required" });
    }

    const user = await userProfileModel.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    });

    const passwordOk = user ? await bcrypt.compare(password, user.passwordHash || "") : false;
    if (!user || !passwordOk) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({ message: "Email not verified. Please complete signup OTP." });
    }

    if (!user.email) {
      return res.status(400).json({ message: "No email found for this account" });
    }

    const otp = createOtp();
    user.otpCodeHash = hashValue(otp);
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.otpPurpose = "login";
    await user.save();

    await sendOtpEmail(user.email, otp, "login");

    return res.status(200).json({
      message: "Login OTP sent",
      requiresOtp: true,
      otpDelivery: smtpConfigured() ? "email" : "dev-console",
      email: user.email,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login failed" });
  }
});

router.post("/auth/verify-login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email || "");
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "email and otp are required" });
    }

    const user = await userProfileModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.otpPurpose !== "login" || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired or invalid" });
    }

    if (user.otpCodeHash !== hashValue(otp)) {
      return res.status(400).json({ message: "Incorrect OTP" });
    }

    user.otpCodeHash = "";
    user.otpExpiresAt = null;
    user.otpPurpose = "";
    user.lastLoginAt = new Date();
    await user.save();

    return res.status(200).json({
      message: "Login successful",
      token: createToken(user),
      user: userResponse(user),
    });
  } catch (error) {
    console.error("Verify login error:", error);
    return res.status(500).json({ message: "Login verification failed" });
  }
});

router.post("/auth/google", async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken || !process.env.GOOGLE_CLIENT_ID) {
      return res.status(400).json({ message: "Valid Google configuration and idToken are required" });
    }

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = normalizeEmail(payload?.email || "");
    const displayName = String(payload?.name || "").trim();
    const googleSub = String(payload?.sub || "");

    if (!email) {
      return res.status(400).json({ message: "Google email is required" });
    }

    let user = await userProfileModel.findOne({ email });
    if (!user && googleSub) {
      user = await userProfileModel.findOne({ googleSub });
    }

    if (user) {
      user.displayName = displayName || user.displayName || user.username;
      user.googleSub = googleSub || user.googleSub;
      user.isEmailVerified = true;
      user.lastLoginAt = new Date();
      await user.save();

      return res.status(200).json({
        message: "Google sign-in successful",
        token: createToken(user),
        user: userResponse(user),
      });
    }

    const usernameBase = normalizeUsername(email.split("@")[0] || "user");
    let username = usernameBase || "user";
    let suffix = 1;

    while (await userProfileModel.exists({ username })) {
      suffix += 1;
      username = `${usernameBase}${suffix}`;
    }

    user = await userProfileModel.create({
      username,
      displayName: displayName || username,
      email,
      isEmailVerified: true,
      googleSub,
      lastLoginAt: new Date(),
    });

    return res.status(200).json({
      message: "Google sign-in successful",
      token: createToken(user),
      user: userResponse(user),
    });
  } catch (error) {
    console.error("Google sign-in error:", error);
    return res.status(500).json({ message: "Google sign-in failed" });
  }
});

router.get("/auth/profile", requireAuth, async (req, res) => {
  try {
    return res.status(200).json({ user: userResponse(req.user) });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return res.status(500).json({ message: "Failed to fetch profile" });
  }
});

router.put("/auth/profile", requireAuth, imageUpload.single("profilePhoto"), async (req, res) => {
  try {
    const currentUsername = req.user.username;
    const nextUsername = normalizeUsername(req.body.username || "");
    const displayName = String(req.body.displayName || "").trim();

    if (!nextUsername) {
      return res.status(400).json({ message: "username is required" });
    }

    if (nextUsername !== currentUsername) {
      const usernameTaken = await userProfileModel.findOne({ username: nextUsername });
      if (usernameTaken && usernameTaken._id.toString() !== req.user._id.toString()) {
        return res.status(409).json({ message: "Username already taken" });
      }

      await userProfileModel.updateMany(
        { following: currentUsername },
        { $set: { "following.$[entry]": nextUsername } },
        { arrayFilters: [{ entry: currentUsername }] }
      );

      await playlistModel.updateMany(
        { ownerUsername: currentUsername },
        { $set: { ownerUsername: nextUsername } }
      );
    }

    req.user.username = nextUsername;
    req.user.displayName = displayName || nextUsername;

    if (req.file) {
      const uploaded = await uploadFile(req.file, "cohort-profile-photos");
      req.user.profilePhoto = uploaded.url;
    }

    await req.user.save();

    await playlistModel.updateMany(
      { ownerUsername: req.user.username },
      { $set: { ownerDisplayName: req.user.displayName } }
    );

    return res.status(200).json({
      message: "Profile updated",
      token: createToken(req.user),
      user: userResponse(req.user),
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return res.status(500).json({ message: "Failed to update profile" });
  }
});

module.exports = router;
