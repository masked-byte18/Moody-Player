const express = require("express");
const multer = require("multer");
const uploadFile = require("../service/storage.service");
const playlistModel = require("../models/playlist.model");
const songModel = require("../models/song.model");
const userProfileModel = require("../models/userProfile.model");

const router = express.Router();

const normalizeUsername = (value = "") => value.trim().toLowerCase();

const toDisplayName = (value = "") => {
  const trimmed = value.trim();
  if (!trimmed) return "Guest";
  return trimmed;
};

const ensureUserProfile = async (username, displayName = "") => {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;

  const nextDisplayName = toDisplayName(displayName || normalized);
  const syntheticEmail = `${normalized.replace(/[^a-z0-9._-]/g, "") || "user"}@local.moody`;

  const profile = await userProfileModel.findOneAndUpdate(
    { username: normalized },
    {
      $setOnInsert: {
        username: normalized,
        email: syntheticEmail,
        following: [],
        savedFeatured: [],
      },
      $set: displayName ? { displayName: nextDisplayName } : {},
    },
    { new: true, upsert: true }
  );

  return profile;
};

const cleanPlaylist = (playlistDoc) => {
  const obj = playlistDoc.toObject();
  obj.songs = (obj.songs || []).filter((song) => song !== null);
  return obj;
};

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
    const { name, description, ownerUsername, ownerDisplayName, isFeatured } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Playlist name is required" });
    }

    const normalizedOwner = normalizeUsername(ownerUsername || "guest");
    const displayName = toDisplayName(ownerDisplayName || normalizedOwner);
    const featured = String(isFeatured) === "true";

    await ensureUserProfile(normalizedOwner, displayName);

    let coverImage = "";
    if (req.file) {
      const coverData = await uploadFile(req.file, "cohort-playlists");
      coverImage = coverData.url;
    }

    const playlist = await playlistModel.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      coverImage,
      ownerUsername: normalizedOwner,
      ownerDisplayName: displayName,
      isFeatured: featured,
      featuredAt: featured ? new Date() : null,
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
    const { username, scope, query } = req.query;
    const normalizedUsername = normalizeUsername(username || "");

    const filter = {};

    if (normalizedUsername && scope === "personal") {
      filter.ownerUsername = normalizedUsername;
      filter.isFeatured = false;
    } else if (normalizedUsername && scope === "owned") {
      filter.ownerUsername = normalizedUsername;
    }

    if (query && String(query).trim()) {
      const regex = new RegExp(String(query).trim(), "i");
      filter.$or = [
        { name: regex },
        { description: regex },
        { ownerDisplayName: regex },
        { ownerUsername: regex },
      ];
    }

    const playlists = await playlistModel.find(filter).populate("songs").sort({ createdAt: -1 });
    const cleaned = playlists.map(cleanPlaylist);

    res.status(200).json({ playlists: cleaned });
  } catch (error) {
    console.error("Playlist fetch error:", error);
    res.status(500).json({ message: "Failed to fetch playlists" });
  }
});

router.get("/featured/playlists", async (req, res) => {
  try {
    const { query, owner } = req.query;
    const filter = { isFeatured: true };

    const andConditions = [];

    if (owner && String(owner).trim()) {
      const ownerRegex = new RegExp(String(owner).trim(), "i");
      andConditions.push({
        $or: [{ ownerDisplayName: ownerRegex }, { ownerUsername: ownerRegex }],
      });
    }

    if (query && String(query).trim()) {
      const searchRegex = new RegExp(String(query).trim(), "i");
      andConditions.push({
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { ownerDisplayName: searchRegex },
          { ownerUsername: searchRegex },
        ],
      });
    }

    if (andConditions.length) {
      filter.$and = andConditions;
    }

    const playlists = await playlistModel
      .find(filter)
      .populate("songs")
      .sort({ featuredAt: -1, createdAt: -1 })
      .limit(80);

    res.status(200).json({ playlists: playlists.map(cleanPlaylist) });
  } catch (error) {
    console.error("Featured playlists fetch error:", error);
    res.status(500).json({ message: "Failed to fetch featured playlists" });
  }
});

router.get("/playlists/:id", async (req, res) => {
  try {
    const playlist = await playlistModel.findById(req.params.id).populate("songs");

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    res.status(200).json({ playlist: cleanPlaylist(playlist) });
  } catch (error) {
    console.error("Playlist fetch error:", error);
    res.status(500).json({ message: "Failed to fetch playlist" });
  }
});

router.delete("/playlists/:id", async (req, res) => {
  try {
    const playlist = await playlistModel.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    const actingUsername = normalizeUsername(req.query.username || "");
    if (actingUsername && actingUsername !== playlist.ownerUsername) {
      return res.status(403).json({ message: "You can only delete your own playlist" });
    }

    if (playlist.songs.length > 0) {
      await songModel.deleteMany({ _id: { $in: playlist.songs } });
    }

    await userProfileModel.updateMany({}, { $pull: { savedFeatured: { playlist: playlist._id } } });

    await playlistModel.findByIdAndDelete(req.params.id);
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

      const actingUsername = normalizeUsername(req.body.username || req.query.username || "");
      if (actingUsername && actingUsername !== playlist.ownerUsername) {
        return res.status(403).json({ message: "You can only update your own playlist" });
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

      const updatedPlaylist = await playlistModel.findById(playlist._id).populate("songs");

      res.status(201).json({
        message: "Song added to playlist",
        playlist: cleanPlaylist(updatedPlaylist),
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

    const actingUsername = normalizeUsername(req.query.username || "");
    if (actingUsername && actingUsername !== playlist.ownerUsername) {
      return res.status(403).json({ message: "You can only update your own playlist" });
    }

    playlist.songs = playlist.songs.filter((song) => song.toString() !== songId);
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
    const { songIds, username } = req.body;
    const playlist = await playlistModel.findById(req.params.id);

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    const actingUsername = normalizeUsername(username || req.query.username || "");
    if (actingUsername && actingUsername !== playlist.ownerUsername) {
      return res.status(403).json({ message: "You can only update your own playlist" });
    }

    if (!Array.isArray(songIds)) {
      return res.status(400).json({ message: "songIds must be an array" });
    }

    const validSongIds = songIds.filter((id) => {
      if (!id) return false;
      return playlist.songs.some((existingId) => existingId.toString() === id.toString());
    });

    if (validSongIds.length === 0) {
      return res.status(400).json({ message: "No valid song IDs provided" });
    }

    playlist.songs = validSongIds;
    await playlist.save();

    const updatedPlaylist = await playlistModel.findById(playlist._id).populate("songs");

    res.status(200).json({ message: "Playlist reordered", playlist: cleanPlaylist(updatedPlaylist) });
  } catch (error) {
    console.error("Playlist reorder error:", error);
    res.status(500).json({ message: "Failed to reorder playlist", error: error.message });
  }
});

router.post("/playlists/:targetId/songs/transfer", async (req, res) => {
  try {
    const { targetId } = req.params;
    const { songId, username } = req.body;

    if (!songId) {
      return res.status(400).json({ message: "songId is required" });
    }

    const targetPlaylist = await playlistModel.findById(targetId).populate("songs");
    if (!targetPlaylist) {
      return res.status(404).json({ message: "Target playlist not found" });
    }

    const actingUsername = normalizeUsername(username || req.query.username || "");
    if (actingUsername && actingUsername !== targetPlaylist.ownerUsername) {
      return res.status(403).json({ message: "You can only copy songs to your own playlist" });
    }

    const originalSong = await songModel.findById(songId);
    if (!originalSong) {
      return res.status(404).json({ message: "Song not found" });
    }

    const isDuplicate = targetPlaylist.songs.some(
      (song) =>
        song.title.toLowerCase().trim() === originalSong.title.toLowerCase().trim() &&
        song.artist.toLowerCase().trim() === originalSong.artist.toLowerCase().trim()
    );

    if (isDuplicate) {
      return res.status(200).json({
        message: "Song already exists in this playlist",
        targetPlaylist: cleanPlaylist(targetPlaylist),
        duplicate: true,
      });
    }

    const newSong = await songModel.create({
      title: originalSong.title,
      artist: originalSong.artist,
      audio: originalSong.audio,
      mood: originalSong.mood,
    });

    targetPlaylist.songs.push(newSong._id);
    await targetPlaylist.save();

    const updatedTargetPlaylist = await playlistModel.findById(targetId).populate("songs");

    res.status(200).json({
      message: "Song copied successfully",
      targetPlaylist: cleanPlaylist(updatedTargetPlaylist),
      duplicate: false,
    });
  } catch (error) {
    console.error("Song copy error:", error);
    res.status(500).json({ message: "Failed to copy song" });
  }
});

router.get("/featured/saved", async (req, res) => {
  try {
    const username = normalizeUsername(req.query.username || "");
    if (!username) {
      return res.status(400).json({ message: "username is required" });
    }

    const profile = await ensureUserProfile(username);
    const populated = await userProfileModel
      .findById(profile._id)
      .populate({ path: "savedFeatured.playlist", populate: { path: "songs" } });

    const saved = (populated.savedFeatured || [])
      .filter((item) => item.playlist && item.playlist.isFeatured)
      .map((item) => ({
        playlist: cleanPlaylist(item.playlist),
        localName: item.localName || item.playlist.name,
        savedAt: item.savedAt,
      }));

    res.status(200).json({ saved });
  } catch (error) {
    console.error("Saved featured fetch error:", error);
    res.status(500).json({ message: "Failed to fetch saved featured playlists" });
  }
});

router.post("/featured/playlists/:id/save", async (req, res) => {
  try {
    const playlist = await playlistModel.findById(req.params.id);
    if (!playlist || !playlist.isFeatured) {
      return res.status(404).json({ message: "Featured playlist not found" });
    }

    const username = normalizeUsername(req.body.username || "");
    const displayName = toDisplayName(req.body.displayName || username);
    if (!username) {
      return res.status(400).json({ message: "username is required" });
    }

    const profile = await ensureUserProfile(username, displayName);

    const existing = profile.savedFeatured.find(
      (entry) => entry.playlist.toString() === playlist._id.toString()
    );

    if (!existing) {
      profile.savedFeatured.push({
        playlist: playlist._id,
        localName: req.body.localName ? String(req.body.localName).trim() : playlist.name,
        savedAt: new Date(),
      });
      await profile.save();
      await playlistModel.findByIdAndUpdate(playlist._id, { $inc: { savesCount: 1 } });
    }

    res.status(200).json({ message: "Featured playlist saved" });
  } catch (error) {
    console.error("Save featured playlist error:", error);
    res.status(500).json({ message: "Failed to save featured playlist" });
  }
});

router.put("/featured/saved/:playlistId/rename", async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username || "");
    const { playlistId } = req.params;
    const localName = String(req.body.localName || "").trim();

    if (!username) {
      return res.status(400).json({ message: "username is required" });
    }

    const profile = await ensureUserProfile(username);
    const target = profile.savedFeatured.find((entry) => entry.playlist.toString() === playlistId);

    if (!target) {
      return res.status(404).json({ message: "Saved playlist not found" });
    }

    target.localName = localName;
    await profile.save();

    res.status(200).json({ message: "Saved playlist renamed" });
  } catch (error) {
    console.error("Rename saved playlist error:", error);
    res.status(500).json({ message: "Failed to rename saved playlist" });
  }
});

router.delete("/featured/saved/:playlistId", async (req, res) => {
  try {
    const username = normalizeUsername(req.query.username || "");
    const { playlistId } = req.params;

    if (!username) {
      return res.status(400).json({ message: "username is required" });
    }

    const profile = await ensureUserProfile(username);
    const beforeCount = profile.savedFeatured.length;
    profile.savedFeatured = profile.savedFeatured.filter((entry) => entry.playlist.toString() !== playlistId);

    if (profile.savedFeatured.length < beforeCount) {
      await profile.save();
      await playlistModel.findByIdAndUpdate(playlistId, { $inc: { savesCount: -1 } });
    }

    res.status(200).json({ message: "Saved playlist removed" });
  } catch (error) {
    console.error("Remove saved playlist error:", error);
    res.status(500).json({ message: "Failed to remove saved playlist" });
  }
});

router.get("/social/users/search", async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();
    const viewer = normalizeUsername(req.query.viewer || "");

    if (!query) {
      return res.status(200).json({ users: [] });
    }

    const searchRegex = new RegExp(query, "i");

    const profileMatches = await userProfileModel
      .find({ $or: [{ username: searchRegex }, { displayName: searchRegex }] })
      .limit(30)
      .lean();

    const featuredOwners = await playlistModel
      .find({ isFeatured: true, $or: [{ ownerUsername: searchRegex }, { ownerDisplayName: searchRegex }] })
      .select("ownerUsername ownerDisplayName")
      .limit(30)
      .lean();

    const userMap = new Map();

    profileMatches.forEach((profile) => {
      userMap.set(profile.username, {
        username: profile.username,
        displayName: profile.displayName || profile.username,
      });
    });

    featuredOwners.forEach((owner) => {
      if (!userMap.has(owner.ownerUsername)) {
        userMap.set(owner.ownerUsername, {
          username: owner.ownerUsername,
          displayName: owner.ownerDisplayName || owner.ownerUsername,
        });
      }
    });

    const users = Array.from(userMap.values()).slice(0, 30);

    let followingSet = new Set();
    if (viewer) {
      const viewerProfile = await ensureUserProfile(viewer);
      followingSet = new Set(viewerProfile.following || []);
    }

    const withStats = await Promise.all(
      users.map(async (user) => {
        const featuredCount = await playlistModel.countDocuments({
          ownerUsername: user.username,
          isFeatured: true,
        });

        return {
          ...user,
          featuredCount,
          isFollowing: followingSet.has(user.username),
        };
      })
    );

    res.status(200).json({ users: withStats });
  } catch (error) {
    console.error("Social user search error:", error);
    res.status(500).json({ message: "Failed to search users" });
  }
});

router.get("/social/friends", async (req, res) => {
  try {
    const username = normalizeUsername(req.query.username || "");
    if (!username) {
      return res.status(400).json({ message: "username is required" });
    }

    const profile = await ensureUserProfile(username);

    const friends = await Promise.all(
      (profile.following || []).map(async (friendUsername) => {
        const friendProfile = await userProfileModel.findOne({ username: friendUsername }).lean();
        const featuredCount = await playlistModel.countDocuments({
          ownerUsername: friendUsername,
          isFeatured: true,
        });

        return {
          username: friendUsername,
          displayName: friendProfile?.displayName || friendUsername,
          featuredCount,
        };
      })
    );

    res.status(200).json({ friends });
  } catch (error) {
    console.error("Friends fetch error:", error);
    res.status(500).json({ message: "Failed to fetch friends" });
  }
});

router.post("/social/follow/:targetUsername", async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username || "");
    const targetUsername = normalizeUsername(req.params.targetUsername || "");

    if (!username || !targetUsername) {
      return res.status(400).json({ message: "username and target username are required" });
    }

    if (username === targetUsername) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const profile = await ensureUserProfile(username, req.body.displayName || username);
    await ensureUserProfile(targetUsername, targetUsername);

    if (!profile.following.includes(targetUsername)) {
      profile.following.push(targetUsername);
      await profile.save();
    }

    res.status(200).json({ message: "User followed" });
  } catch (error) {
    console.error("Follow user error:", error);
    res.status(500).json({ message: "Failed to follow user" });
  }
});

router.post("/social/unfollow/:targetUsername", async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username || "");
    const targetUsername = normalizeUsername(req.params.targetUsername || "");

    if (!username || !targetUsername) {
      return res.status(400).json({ message: "username and target username are required" });
    }

    const profile = await ensureUserProfile(username);
    profile.following = profile.following.filter((entry) => entry !== targetUsername);
    await profile.save();

    res.status(200).json({ message: "User unfollowed" });
  } catch (error) {
    console.error("Unfollow user error:", error);
    res.status(500).json({ message: "Failed to unfollow user" });
  }
});

module.exports = router;
