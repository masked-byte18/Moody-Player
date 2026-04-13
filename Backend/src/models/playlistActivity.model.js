const mongoose = require("mongoose");

const playlistActivitySchema = new mongoose.Schema(
  {
    playlist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "playlist",
      required: true,
      index: true,
    },
    playlistName: { type: String, default: "" },
    actorUsername: { type: String, required: true, lowercase: true, trim: true, index: true },
    actorDisplayName: { type: String, default: "" },
    type: {
      type: String,
      enum: ["add_song", "delete_song", "remove_song", "reorder", "update"],
      default: "update",
      index: true,
    },
    text: { type: String, default: "" },
  },
  { timestamps: true }
);

playlistActivitySchema.index({ playlist: 1, createdAt: -1 });

module.exports = mongoose.model("playlistActivity", playlistActivitySchema);
