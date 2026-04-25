const mongoose = require("mongoose");

const songSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    titleKey: {
      type: String,
      index: true,
    },
    artistKey: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    artist: {
      type: String,
      default: "",
      trim: true,
    },
    audio: {
      type: String,
      required: true,
    },
    audioHash: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    mood: {
      type: String,
      default: "",
      trim: true,
    },
    likedBy: [{ type: String, lowercase: true, trim: true }],
    likesCount: { type: Number, default: 0, index: true },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userProfile",
      index: true,
    },
    ownerUsername: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
      index: true,
    },
  },
  { timestamps: true }
);

const song = mongoose.model("song", songSchema);

module.exports = song;
