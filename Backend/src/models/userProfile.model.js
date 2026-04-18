const mongoose = require("mongoose");

const savedFeaturedSchema = new mongoose.Schema(
  {
    playlist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "playlist",
      required: true,
    },
    localName: { type: String, default: "" },
    savedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userProfileSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: { type: String, default: "" },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
    },
    passwordHash: { type: String, default: "" },
    profilePhoto: { type: String, default: "" },
    isEmailVerified: { type: Boolean, default: false },
    otpCodeHash: { type: String, default: "" },
    otpExpiresAt: { type: Date, default: null },
    otpPurpose: { type: String, default: "" },
    lastLoginAt: { type: Date, default: null },
    googleSub: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      default: undefined,
      set: (value) => {
        const normalized = String(value || "").trim();
        return normalized || undefined;
      },
    },
    following: [{ type: String, lowercase: true, trim: true }],
    savedFeatured: [savedFeaturedSchema],
  },
  { timestamps: true }
);

const userProfile = mongoose.model("userProfile", userProfileSchema);

module.exports = userProfile;
