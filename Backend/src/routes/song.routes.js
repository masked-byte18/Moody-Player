const express = require("express");
const multer = require("multer");
const router = express.Router();
const { requireAuth, optionalAuth } = require("../middleware/auth.middleware");
const songController = require("../controllers/song.controller");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = new Set(["audio/mpeg", "video/mpeg"]);
    if (file.mimetype.startsWith("audio/") || allowedTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only audio files allowed"), false);
  },
});

router.post("/songs", requireAuth, upload.single("audio"), songController.createSong);
router.post("/songs/external", requireAuth, songController.createExternalSong);

router.get("/songs", optionalAuth, songController.getSongs);
router.get("/songs/mine", requireAuth, songController.getMySongs);
router.get("/songs/mood/:mood", optionalAuth, songController.getSongsByMood);

router.post("/songs/:id/like", requireAuth, songController.toggleLike);
router.get("/songs/top-liked", songController.getTopLiked);
router.get("/songs/my-likes", requireAuth, songController.getMyLikes);

router.delete("/songs/:id", requireAuth, songController.deleteSong);

// ── Mood Library (persistent per-user mood queue) ──
const userProfile = require("../models/userProfile.model");
const songModel = require("../models/song.model");

router.get("/mood-library", requireAuth, async (req, res) => {
  try {
    const profile = await userProfile.findOne({ username: req.user.username });
    if (!profile || !profile.moodLibrary?.length) {
      return res.json({ songs: [] });
    }
    const songs = await songModel.find({
      _id: { $in: profile.moodLibrary },
      mood: { $ne: "explore" },
    });
    // Preserve the order from moodLibrary
    const songMap = new Map(songs.map((s) => [s._id.toString(), s]));
    const ordered = profile.moodLibrary
      .map((id) => songMap.get(id.toString()))
      .filter(Boolean);
    return res.json({ songs: ordered });
  } catch (err) {
    console.error("Get mood library error:", err);
    return res.status(500).json({ message: "Failed to fetch mood library" });
  }
});

router.post("/mood-library", requireAuth, async (req, res) => {
  try {
    const { songId } = req.body;
    if (!songId) return res.status(400).json({ message: "songId required" });

    const profile = await userProfile.findOne({ username: req.user.username });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    // Avoid duplicates
    const alreadyExists = profile.moodLibrary.some(
      (id) => id.toString() === songId
    );
    if (!alreadyExists) {
      profile.moodLibrary.push(songId);
      await profile.save();
    }

    return res.json({ success: true, moodLibrary: profile.moodLibrary });
  } catch (err) {
    console.error("Add to mood library error:", err);
    return res.status(500).json({ message: "Failed to add to mood library" });
  }
});

router.delete("/mood-library/:songId", requireAuth, async (req, res) => {
  try {
    const profile = await userProfile.findOne({ username: req.user.username });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    profile.moodLibrary = profile.moodLibrary.filter(
      (id) => id.toString() !== req.params.songId
    );
    await profile.save();
    return res.json({ success: true, moodLibrary: profile.moodLibrary });
  } catch (err) {
    console.error("Remove from mood library error:", err);
    return res.status(500).json({ message: "Failed to remove from mood library" });
  }
});

router.put("/mood-library/reorder", requireAuth, async (req, res) => {
  try {
    const { songIds } = req.body;
    if (!Array.isArray(songIds)) {
      return res.status(400).json({ message: "songIds array required" });
    }

    const profile = await userProfile.findOne({ username: req.user.username });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    // Validate that all songIds are valid ObjectIds
    const mongoose = require("mongoose");
    const validIds = songIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

    profile.moodLibrary = validIds;
    await profile.save();

    return res.json({ success: true, moodLibrary: profile.moodLibrary });
  } catch (err) {
    console.error("Reorder mood library error:", err);
    return res.status(500).json({ message: "Failed to reorder mood library" });
  }
});

module.exports = router;
