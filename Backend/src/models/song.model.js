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
      unique: true,
      sparse: true,
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
  },
  { timestamps: true }
);

const song = mongoose.model("song", songSchema);

module.exports = song;
