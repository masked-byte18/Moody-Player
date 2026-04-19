const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipientUsername: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    senderUsername: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    senderDisplayName: { type: String, default: "" },
    type: {
      type: String,
      enum: ["follow", "new_playlist", "like_playlist", "collab_rejected"],
      required: true,
      index: true,
    },
    message: { type: String, default: "" },
    playlistId: { type: mongoose.Schema.Types.ObjectId, ref: "playlist", default: null },
    playlistName: { type: String, default: "" },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientUsername: 1, createdAt: -1 });

module.exports = mongoose.model("notification", notificationSchema);
