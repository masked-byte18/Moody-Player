const mongoose = require("mongoose");

const playlistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    ownerUsername: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      default: "guest",
      index: true,
    },
    ownerDisplayName: { type: String, default: "Guest" },
    isFeatured: { type: Boolean, default: false, index: true },
    featuredAt: { type: Date, default: null },
    savesCount: { type: Number, default: 0 },
    songs: [{ type: mongoose.Schema.Types.ObjectId, ref: "song" }],
  },
  { timestamps: true }
);

playlistSchema.index({ isFeatured: 1, ownerUsername: 1, createdAt: -1 });

const playlist = mongoose.model("playlist", playlistSchema);

module.exports = playlist;
