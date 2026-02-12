const express = require("express");
const multer = require("multer");
const router = express.Router();
const uploadFile = require("../service/storage.service");
const songModel = require("../models/song.model");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = new Set(["audio/mpeg", "video/mpeg"]);
    if (file.mimetype.startsWith("audio/") || allowedTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only audio files allowed"), false);
  },
});

router.post("/songs", upload.single("audio"), async (req, res) => {
  try {
    // 🛑 Check file exists
    if (!req.file) {
      return res.status(400).json({ message: "No audio file uploaded" });
    }

    console.log(req.body);
    console.log(req.file);

    // ☁️ Upload to storage
    const fileData = await uploadFile(req.file);

    // 💾 Save in DB
    const song = await songModel.create({
      title: req.body.title,
      artist: req.body.artist,
      audio: fileData.url,
      mood: req.body.mood,
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
  const { mood } = req.query;
  const songs = await songModel.find({
    mood: mood,
  });

  res.status(200).json({
    message: "Songs fetched success",
    songs,
  });
});

module.exports = router;
