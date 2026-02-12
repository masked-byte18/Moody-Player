const express = require("express");
const multer = require("multer");
const uploadFile = require("../service/storage.service");
const playlistModel = require("../models/playlist.model");
const songModel = require("../models/song.model");

const router = express.Router();

const audioUpload = multer({
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

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image files allowed"), false);
  },
});

router.post("/playlists", imageUpload.single("cover"), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Playlist name is required" });
    }

    let coverImage = "";
    if (req.file) {
      const coverData = await uploadFile(req.file, "cohort-playlists");
      coverImage = coverData.url;
    }

    const playlist = await playlistModel.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      coverImage,
      songs: [],
    });

    res.status(201).json({ message: "Playlist created", playlist });
  } catch (error) {
    console.error("Playlist create error:", error);
    res.status(500).json({ message: "Playlist creation failed" });
  }
});

router.get("/playlists", async (req, res) => {
  try {
    const playlists = await playlistModel.find().sort({ createdAt: -1 });
    res.status(200).json({ playlists });
  } catch (error) {
    console.error("Playlist fetch error:", error);
    res.status(500).json({ message: "Failed to fetch playlists" });
  }
});

router.get("/playlists/:id", async (req, res) => {
  try {
    const playlist = await playlistModel
      .findById(req.params.id)
      .populate("songs");

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    res.status(200).json({ playlist });
  } catch (error) {
    console.error("Playlist fetch error:", error);
    res.status(500).json({ message: "Failed to fetch playlist" });
  }
});

router.delete("/playlists/:id", async (req, res) => {
  try {
    const playlist = await playlistModel.findByIdAndDelete(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }
    res.status(200).json({ message: "Playlist deleted" });
  } catch (error) {
    console.error("Playlist delete error:", error);
    res.status(500).json({ message: "Failed to delete playlist" });
  }
});

router.post(
  "/playlists/:id/songs/upload",
  audioUpload.single("audio"),
  async (req, res) => {
    try {
      const playlist = await playlistModel.findById(req.params.id);
      if (!playlist) {
        return res.status(404).json({ message: "Playlist not found" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No audio file uploaded" });
      }

      const fileData = await uploadFile(req.file, "cohort-audio");

      const song = await songModel.create({
        title: req.body.title,
        artist: req.body.artist,
        audio: fileData.url,
        mood: req.body.mood,
      });

      playlist.songs.push(song._id);
      await playlist.save();

      const updatedPlaylist = await playlistModel
        .findById(playlist._id)
        .populate("songs");

      res.status(201).json({
        message: "Song added to playlist",
        playlist: updatedPlaylist,
        song,
      });
    } catch (error) {
      console.error("Playlist song upload error:", error);
      res.status(500).json({ message: "Failed to add song" });
    }
  }
);

router.delete("/playlists/:id/songs/:songId", async (req, res) => {
  try {
    const { id, songId } = req.params;
    const deleteSong = req.query.delete === "true";

    const playlist = await playlistModel.findById(id);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    playlist.songs = playlist.songs.filter(
      (song) => song.toString() !== songId
    );
    await playlist.save();

    if (deleteSong) {
      await songModel.findByIdAndDelete(songId);
    }

    res.status(200).json({ message: "Song removed" });
  } catch (error) {
    console.error("Playlist song remove error:", error);
    res.status(500).json({ message: "Failed to remove song" });
  }
});

router.put("/playlists/:id/songs/reorder", async (req, res) => {
  try {
    const { songIds } = req.body;
    const playlist = await playlistModel.findById(req.params.id);

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (!Array.isArray(songIds)) {
      return res.status(400).json({ message: "songIds must be an array" });
    }

    playlist.songs = songIds;
    await playlist.save();

    const updatedPlaylist = await playlistModel
      .findById(playlist._id)
      .populate("songs");

    res.status(200).json({ message: "Playlist reordered", playlist: updatedPlaylist });
  } catch (error) {
    console.error("Playlist reorder error:", error);
    res.status(500).json({ message: "Failed to reorder playlist" });
  }
});

router.post("/playlists/:targetId/songs/transfer", async (req, res) => {
  try {
    const { targetId } = req.params;
    const { songId, sourcePlaylistId } = req.body;

    if (!songId) {
      return res.status(400).json({ message: "songId is required" });
    }

    const targetPlaylist = await playlistModel.findById(targetId);
    if (!targetPlaylist) {
      return res.status(404).json({ message: "Target playlist not found" });
    }

    // Add to target playlist if not already there (copy, don't move)
    if (!targetPlaylist.songs.some((id) => id.toString() === songId)) {
      targetPlaylist.songs.push(songId);
      await targetPlaylist.save();
    }

    const updatedTargetPlaylist = await playlistModel
      .findById(targetId)
      .populate("songs");

    res.status(200).json({
      message: "Song copied successfully",
      targetPlaylist: updatedTargetPlaylist,
    });
  } catch (error) {
    console.error("Song copy error:", error);
    res.status(500).json({ message: "Failed to copy song" });
  }
});

module.exports = router;
