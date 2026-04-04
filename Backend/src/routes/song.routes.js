const express = require("express");
const multer = require("multer");
const router = express.Router();
const uploadFile = require("../service/storage.service");
const songModel = require("../models/song.model");
const playlistModel = require("../models/playlist.model");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  createAudioHash,
  createTitleKey,
  findSongConflict,
  removeSongIfUnused,
} = require("../utils/song.util");

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

router.post("/songs", requireAuth, upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No audio file uploaded" });
    }

    const { title, artist, mood } = req.body;
    const cleanTitle = String(title || "").trim();

    if (!cleanTitle) {
      return res.status(400).json({ message: "title is required" });
    }

    const audioHash = createAudioHash(req.file.buffer);
    const conflict = await findSongConflict({ title: cleanTitle, audioHash });

    if (conflict) {
      return res.status(409).json({ message: "Song with same name or file already exists", song: conflict });
    }

    const fileData = await uploadFile(req.file);

    const song = await songModel.create({
      title: cleanTitle,
      titleKey: createTitleKey(cleanTitle),
      artist: String(artist || "").trim(),
      audio: fileData.url,
      audioHash,
      mood: String(mood || "").trim(),
    });

    res.status(201).json({
      message: "Song created successfully",
      song,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

router.get("/songs", async (req, res) => {
  try {
    const { mood } = req.query;
    const filter = mood ? { mood } : {};
    const songs = await songModel.find(filter);
    res.status(200).json({
      message: "Songs fetched success",
      songs,
    });
  } catch (err) {
    console.error("Songs fetch error:", err);
    res.status(500).json({ message: "Failed to fetch songs" });
  }
});

router.delete("/songs/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await songModel.findById(id);

    if (!deleted) {
      return res.status(404).json({ message: "Song not found" });
    }

    await playlistModel.updateMany({ songs: deleted._id }, { $pull: { songs: deleted._id } });
    await removeSongIfUnused(deleted._id);

    res.status(200).json({ message: "Song deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Delete failed" });
  }
});

module.exports = router;
