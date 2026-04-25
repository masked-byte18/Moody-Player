const songService = require("../service/song.service");

const createSong = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No audio file uploaded" });
    }

    const result = await songService.createSongFromUpload({
      file: req.file,
      title: req.body.title,
      artist: req.body.artist,
      mood: req.body.mood,
      user: req.user,
    });

    if (result.error) {
      return res
        .status(result.error.status)
        .json({ message: result.error.message, song: result.error.song });
    }

    return res.status(201).json({
      message: "Song created successfully",
      song: result.song,
    });
  } catch (error) {
    console.error("Song create error:", error);
    return res.status(500).json({ message: "Upload failed" });
  }
};

const createExternalSong = async (req, res) => {
  try {
    const { title, artist, audio, mood } = req.body;

    if (!audio) {
      return res.status(400).json({ message: "Audio URL is required" });
    }

    const result = await songService.createExternalSongRecord({
      title,
      artist,
      audio,
      mood,
      user: req.user,
    });

    if (result.error) {
      return res
        .status(result.error.status)
        .json({ message: result.error.message, song: result.error.song });
    }

    return res.status(201).json({
      message: "External song registered successfully",
      song: result.song,
    });
  } catch (error) {
    console.error("External song create error:", error);
    return res.status(500).json({ message: "Registration failed" });
  }
};

const getSongs = async (req, res) => {
  try {
    const songs = await songService.listSongs({
      mood: req.query.mood,
    });
    return res.status(200).json({
      message: "Songs fetched success",
      songs,
    });
  } catch (error) {
    console.error("Songs fetch error:", error);
    return res.status(500).json({ message: "Failed to fetch songs" });
  }
};

const getMySongs = async (req, res) => {
  try {
    const songs = await songService.listMySongs({
      mood: req.query.mood,
      user: req.user,
    });
    return res.status(200).json({
      message: "Songs fetched success",
      songs,
    });
  } catch (error) {
    console.error("My songs fetch error:", error);
    return res.status(500).json({ message: "Failed to fetch songs" });
  }
};

const getSongsByMood = async (req, res) => {
  try {
    const songs = await songService.listSongs({
      mood: req.params.mood,
    });
    return res.status(200).json({
      message: "Songs fetched success",
      songs,
    });
  } catch (error) {
    console.error("Songs by mood fetch error:", error);
    return res.status(500).json({ message: "Failed to fetch songs" });
  }
};

const deleteSong = async (req, res) => {
  try {
    const result = await songService.deleteSongEverywhere({
      songId: req.params.id,
      user: req.user,
    });
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    return res.status(200).json({ message: "Song deleted successfully" });
  } catch (error) {
    console.error("Song delete error:", error);
    return res.status(500).json({ message: "Delete failed" });
  }
};

const toggleLike = async (req, res) => {
  try {
    const result = await songService.toggleSongLike(req.params.id, req.user.username);
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
    return res.status(200).json({ isLiked: result.isLiked, song: result.song });
  } catch (error) {
    console.error("Toggle like error:", error);
    return res.status(500).json({ message: "Failed to toggle like" });
  }
};

const getTopLiked = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const result = await songService.getTopLikedSongs(limit);
    return res.status(200).json({ songs: result.songs });
  } catch (error) {
    console.error("Get top liked error:", error);
    return res.status(500).json({ message: "Failed to fetch top liked songs" });
  }
};

const getMyLikes = async (req, res) => {
  try {
    const result = await songService.getMyLikedSongs(req.user.username);
    return res.status(200).json({ songs: result.songs });
  } catch (error) {
    console.error("Get my likes error:", error);
    return res.status(500).json({ message: "Failed to fetch your liked songs" });
  }
};

module.exports = {
  createSong,
  getSongs,
  getMySongs,
  getSongsByMood,
  deleteSong,
  createExternalSong,
  toggleLike,
  getTopLiked,
  getMyLikes,
};
