const mongoose = require("mongoose");

const collaborationRequestSchema = new mongoose.Schema(
  {
    playlist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "playlist",
      required: true,
      index: true,
    },
    playlistName: { type: String, default: "" },
    ownerUsername: { type: String, required: true, lowercase: true, trim: true, index: true },
    requesterUsername: { type: String, required: true, lowercase: true, trim: true, index: true },
    requesterDisplayName: { type: String, default: "" },
    message: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
      index: true,
    },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

collaborationRequestSchema.index({ playlist: 1, requesterUsername: 1, status: 1 });

module.exports = mongoose.model("collaborationRequest", collaborationRequestSchema);
