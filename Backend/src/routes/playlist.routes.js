const express = require("express");
const multer = require("multer");
const uploadFile = require("../service/storage.service");
const playlistModel = require("../models/playlist.model");
const songModel = require("../models/song.model");
const userProfileModel = require("../models/userProfile.model");
const collaborationRequestModel = require("../models/collaborationRequest.model");
const playlistActivityModel = require("../models/playlistActivity.model");
const notificationModel = require("../models/notification.model");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  createAudioHash,
  createArtistKey,
  createTitleKey,
  findSongConflict,
  removeSongIfUnused,
} = require("../utils/song.util");

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
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return profile;
};

const cleanPlaylist = (playlistDoc) => {
  const obj = playlistDoc.toObject();
  obj.songs = (obj.songs || []).filter((song) => song !== null);
  return obj;
};

const isPlaylistOwner = (playlist, username) =>
  (playlist?.ownerUsername || "") === normalizeUsername(username || "");

const isPlaylistContributor = (playlist, username) => {
  const target = normalizeUsername(username);
  return (playlist?.contributors || []).some((c) => normalizeUsername(c) === target);
};

const canEditPlaylist = (playlist, username) =>
  isPlaylistOwner(playlist, username) ||
  (Boolean(playlist?.isFeatured) && isPlaylistContributor(playlist, username));

const logPlaylistActivity = async ({ playlist, actor, type, text }) => {
  if (!playlist?._id || !actor?.username || !text) return;

  await playlistActivityModel.create({
    playlist: playlist._id,
    playlistName: playlist.name || "Playlist",
    actorUsername: normalizeUsername(actor.username),
    actorDisplayName: actor.displayName || actor.username,
    type: type || "update",
    text,
  });
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

async function checkDuplicateName(name, excludeId = null) {
  const existingPlaylist = await playlistModel.findOne({ name: new RegExp(`^${name.trim()}$`, 'i') });
  if (existingPlaylist) {
    if (excludeId && existingPlaylist._id.toString() === excludeId.toString()) {
      return false;
    }
    return true;
  }
  return false;
}

router.post("/playlists", requireAuth, imageUpload.single("cover"), async (req, res) => {
  try {
    const { name, description, isFeatured } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Playlist name is required" });
    }
    
    // Check if playlist with same name already exists globally
    if (await checkDuplicateName(name)) {
      return res.status(409).json({ message: "This playlist already exists" });
    }

    const normalizedOwner = req.user.username;
    const displayName = toDisplayName(req.user.displayName || normalizedOwner);
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
      contributors: [],
      songs: [],
    });

    res.status(201).json({ message: "Playlist created", playlist });
  } catch (error) {
    console.error("Playlist create error:", error);
    res.status(500).json({ message: "Playlist creation failed" });
  }
});

router.post("/playlists/:id/clone", requireAuth, async (req, res) => {
  try {
    const original = await playlistModel.findById(req.params.id);
    if (!original) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (!original.isFeatured && original.ownerUsername !== req.user.username) {
      return res.status(403).json({ message: "Cannot clone private playlists" });
    }

    const existingClone = await playlistModel.findOne({
      ownerUsername: req.user.username,
      clonedFrom: original._id,
    });

    if (existingClone) {
      return res.status(409).json({ message: "This playlist already exists in your library" });
    }

    const clonedPlaylist = await playlistModel.create({
      name: original.name,
      description: original.description,
      ownerUsername: req.user.username,
      ownerDisplayName: req.user.displayName || req.user.username,
      coverImage: original.coverImage,
      isFeatured: false,
      songs: [...(original.songs || [])],
      contributors: [],
      clonedFrom: original._id,
    });

    res.status(201).json({ message: "Playlist saved to your library", playlist: clonedPlaylist });
  } catch (error) {
    console.error("Clone playlist error:", error);
    res.status(500).json({ message: "Failed to clone playlist" });
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
    } else if (normalizedUsername && scope === "public") {
      filter.ownerUsername = normalizedUsername;
      filter.isFeatured = true;
    }

    if (query && String(query).trim()) {
      const escaped = String(query).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
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

router.get("/playlists/mine", requireAuth, async (req, res) => {
  try {
    const playlists = await playlistModel
      .find({ ownerUsername: req.user.username })
      .populate("songs")
      .sort({ createdAt: -1 });

    res.status(200).json({ playlists: playlists.map(cleanPlaylist) });
  } catch (error) {
    console.error("My playlists fetch error:", error);
    res.status(500).json({ message: "Failed to fetch playlists" });
  }
});

router.get("/playlists/collab", requireAuth, async (req, res) => {
  try {
    const playlists = await playlistModel
      .find({ contributors: req.user.username, isFeatured: true })
      .populate("songs")
      .sort({ updatedAt: -1 });

    res.status(200).json({ playlists: playlists.map(cleanPlaylist) });
  } catch (error) {
    console.error("Collaborative playlists fetch error:", error);
    res.status(500).json({ message: "Failed to fetch collaborative playlists" });
  }
});

router.get("/playlists/managed", requireAuth, async (req, res) => {
  try {
    const playlists = await playlistModel
      .find({ ownerUsername: req.user.username, isFeatured: true, "contributors.0": { $exists: true } })
      .populate("songs")
      .sort({ updatedAt: -1 });

    res.status(200).json({ playlists: playlists.map(cleanPlaylist) });
  } catch (error) {
    console.error("Managed playlists fetch error:", error);
    res.status(500).json({ message: "Failed to fetch managed playlists" });
  }
});

router.get("/featured/playlists", async (req, res) => {
  try {
    const { query, owner } = req.query;
    const filter = { isFeatured: true };

    const andConditions = [];

    if (owner && String(owner).trim()) {
      const escapedOwner = String(owner).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const ownerRegex = new RegExp(escapedOwner, "i");
      andConditions.push({
        $or: [{ ownerDisplayName: ownerRegex }, { ownerUsername: ownerRegex }],
      });
    }

    if (query && String(query).trim()) {
      const escapedQuery = String(query).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escapedQuery, "i");
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

router.post("/playlists/:id/collab/request", requireAuth, async (req, res) => {
  try {
    const playlist = await playlistModel.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (!playlist.isFeatured) {
      return res.status(403).json({ message: "Collaboration is allowed only for featured playlists" });
    }

    if (isPlaylistOwner(playlist, req.user.username)) {
      return res.status(400).json({ message: "Owner cannot request collaboration" });
    }

    if (isPlaylistContributor(playlist, req.user.username)) {
      return res.status(409).json({ message: "You are already a contributor" });
    }

    const existingPending = await collaborationRequestModel.findOne({
      playlist: playlist._id,
      requesterUsername: req.user.username,
      status: "pending",
    });

    if (existingPending) {
      return res.status(409).json({ message: "Request already pending" });
    }

    const request = await collaborationRequestModel.create({
      playlist: playlist._id,
      playlistName: playlist.name,
      ownerUsername: playlist.ownerUsername,
      requesterUsername: req.user.username,
      requesterDisplayName: req.user.displayName || req.user.username,
      message: String(req.body?.message || "").trim(),
      status: "pending",
    });

    return res.status(201).json({ message: "Collaboration request sent", request });
  } catch (error) {
    console.error("Create collaboration request error:", error);
    return res.status(500).json({ message: "Failed to create collaboration request" });
  }
});

router.get("/collab/requests/inbox", requireAuth, async (req, res) => {
  try {
    const requests = await collaborationRequestModel
      .find({ ownerUsername: req.user.username })
      .sort({ createdAt: -1 });

    return res.status(200).json({ requests });
  } catch (error) {
    console.error("Collab inbox fetch error:", error);
    return res.status(500).json({ message: "Failed to fetch collaboration inbox" });
  }
});

router.get("/collab/requests/outgoing", requireAuth, async (req, res) => {
  try {
    const requests = await collaborationRequestModel
      .find({ requesterUsername: req.user.username })
      .sort({ createdAt: -1 });

    return res.status(200).json({ requests });
  } catch (error) {
    console.error("Collab outgoing fetch error:", error);
    return res.status(500).json({ message: "Failed to fetch outgoing collaboration requests" });
  }
});

router.delete("/collab/requests/:requestId/cancel", requireAuth, async (req, res) => {
  try {
    const request = await collaborationRequestModel.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.requesterUsername !== req.user.username) {
      return res.status(403).json({ message: "Only requester can cancel this request" });
    }

    if (request.status !== "pending") {
      return res.status(409).json({ message: "Only pending requests can be cancelled" });
    }

    await collaborationRequestModel.deleteOne({ _id: request._id });
    return res.status(200).json({ message: "Request withdrawn" });
  } catch (error) {
    console.error("Collab request cancel error:", error);
    return res.status(500).json({ message: "Failed to cancel collaboration request" });
  }
});

router.post("/collab/requests/:requestId/respond", requireAuth, async (req, res) => {
  try {
    const status = String(req.body?.status || "").trim().toLowerCase();
    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({ message: "status must be accepted or rejected" });
    }

    const request = await collaborationRequestModel.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.ownerUsername !== req.user.username) {
      return res.status(403).json({ message: "Only playlist owner can respond to request" });
    }

    request.status = status;
    request.respondedAt = new Date();
    if (status === "accepted") {
      const playlist = await playlistModel.findById(request.playlist);
      if (!playlist) {
        return res.status(404).json({ message: "Playlist not found" });
      }
      if (!playlist.isFeatured) {
        return res.status(409).json({ message: "Cannot accept request for an unfeatured playlist" });
      }
      await request.save();
      if (!playlist.contributors.includes(request.requesterUsername)) {
        playlist.contributors.push(request.requesterUsername);
        await playlist.save();
      }
    } else {
      await request.save();

      await notificationModel.create({
        recipientUsername: request.requesterUsername,
        senderUsername: req.user.username,
        senderDisplayName: req.user.displayName || req.user.username,
        type: "collab_rejected",
        message: `rejected your request to contribute to "${request.playlistName}"`,
        playlistId: request.playlist,
        playlistName: request.playlistName,
      });
    }

    return res.status(200).json({ message: `Request ${status}`, request });
  } catch (error) {
    console.error("Collab request respond error:", error);
    return res.status(500).json({ message: "Failed to respond collaboration request" });
  }
});

router.get("/playlists/:id/contributors", requireAuth, async (req, res) => {
  try {
    const playlist = await playlistModel.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (!isPlaylistOwner(playlist, req.user.username)) {
      return res.status(403).json({ message: "Only owner can view contributors" });
    }

    const contributors = playlist.contributors || [];
    return res.status(200).json({ contributors });
  } catch (error) {
    console.error("Contributors fetch error:", error);
    return res.status(500).json({ message: "Failed to fetch contributors" });
  }
});

router.delete("/playlists/:id/contributors/:username", requireAuth, async (req, res) => {
  try {
    const targetUsername = normalizeUsername(req.params.username || "");
    const playlist = await playlistModel.findById(req.params.id);

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (!isPlaylistOwner(playlist, req.user.username)) {
      return res.status(403).json({ message: "Only owner can remove contributors" });
    }

    playlist.contributors = (playlist.contributors || []).filter((user) => user !== targetUsername);
    await playlist.save();

    await collaborationRequestModel.updateMany(
      { playlist: playlist._id, requesterUsername: targetUsername, status: "accepted" },
      { $set: { status: "rejected", respondedAt: new Date() } }
    );

    return res.status(200).json({ message: "Contributor removed" });
  } catch (error) {
    console.error("Contributor remove error:", error);
    return res.status(500).json({ message: "Failed to remove contributor" });
  }
});

router.get("/playlists/:id/activity", requireAuth, async (req, res) => {
  try {
    const playlist = await playlistModel.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (!canEditPlaylist(playlist, req.user.username)) {
      return res.status(403).json({ message: "Not allowed to view activity" });
    }

    const activities = await playlistActivityModel.find({ playlist: playlist._id }).sort({ createdAt: -1 });
    return res.status(200).json({ activities });
  } catch (error) {
    console.error("Playlist activity fetch error:", error);
    return res.status(500).json({ message: "Failed to fetch playlist activity" });
  }
});

router.put("/playlists/:id", requireAuth, imageUpload.single("cover"), async (req, res) => {
  try {
    const playlist = await playlistModel.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (!isPlaylistOwner(playlist, req.user.username)) {
      return res.status(403).json({ message: "Only owner can update playlist details" });
    }

    const nextName = String(req.body?.name || "").trim();
    const nextDescription = String(req.body?.description || "").trim();

    if (nextName) {
      if (nextName.toLowerCase() !== playlist.name.toLowerCase()) {
        if (await checkDuplicateName(nextName, playlist._id)) {
          return res.status(409).json({ message: "This playlist already exists" });
        }
      }
      playlist.name = nextName;
    }
    playlist.description = nextDescription;

    if (req.file) {
      const coverData = await uploadFile(req.file, "cohort-playlists");
      playlist.coverImage = coverData.url;
    }

    await playlist.save();

    return res.status(200).json({ message: "Playlist updated", playlist });
  } catch (error) {
    console.error("Playlist update error:", error);
    return res.status(500).json({ message: "Failed to update playlist" });
  }
});

router.delete("/playlists/:id", requireAuth, async (req, res) => {
  try {
    const playlist = await playlistModel.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (req.user.username !== playlist.ownerUsername) {
      return res.status(403).json({ message: "You can only delete your own playlist" });
    }

    const songIds = playlist.songs.map((songId) => songId.toString());

    await userProfileModel.updateMany({}, { $pull: { savedFeatured: { playlist: playlist._id } } });
    await collaborationRequestModel.deleteMany({ playlist: playlist._id });
    await playlistActivityModel.deleteMany({ playlist: playlist._id });
    await playlistModel.findByIdAndDelete(req.params.id);

    await Promise.all(songIds.map((songId) => removeSongIfUnused(songId)));

    res.status(200).json({ message: "Playlist deleted" });
  } catch (error) {
    console.error("Playlist delete error:", error);
    res.status(500).json({ message: "Failed to delete playlist" });
  }
});

router.put("/playlists/:id/publish", requireAuth, async (req, res) => {
  try {
    const playlist = await playlistModel.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (req.user.username !== playlist.ownerUsername) {
      return res.status(403).json({ message: "Only the owner can publish this playlist" });
    }

    const nextFeatured = Boolean(req.body?.isFeatured);
    
    if (nextFeatured) {
      if (await checkDuplicateName(playlist.name, playlist._id)) {
        return res.status(409).json({ message: "A playlist with this name already exists" });
      }
    }

    const updates = {
      isFeatured: nextFeatured,
      featuredAt: nextFeatured ? new Date() : null,
    };

    if (!nextFeatured) {
      updates.contributors = [];
      await collaborationRequestModel.updateMany(
        {
          playlist: playlist._id,
          status: { $in: ["pending", "accepted"] },
        },
        { $set: { status: "rejected", respondedAt: new Date() } }
      );
    }

    const updatedPlaylist = await playlistModel.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );

    if (nextFeatured) {
      const followers = await userProfileModel.find(
        { following: playlist.ownerUsername },
        { username: 1 }
      ).lean();
      const notifications = followers.map((follower) => ({
        recipientUsername: follower.username,
        senderUsername: playlist.ownerUsername,
        senderDisplayName: playlist.ownerDisplayName || playlist.ownerUsername,
        type: "new_playlist",
        message: `published a new playlist "${playlist.name}"`,
        playlistId: playlist._id,
        playlistName: playlist.name,
      }));
      if (notifications.length) {
        await notificationModel.insertMany(notifications);
      }
    }

    res.status(200).json({ message: nextFeatured ? "Playlist published" : "Playlist unpublished", playlist: updatedPlaylist });
  } catch (error) {
    console.error("Playlist publish error:", error);
    res.status(500).json({ message: "Failed to update publish status" });
  }
});

router.post(
  "/playlists/:id/songs/upload",
  requireAuth,
  audioUpload.single("audio"),
  async (req, res) => {
    try {
      const playlist = await playlistModel.findById(req.params.id);
      if (!playlist) {
        return res.status(404).json({ message: "Playlist not found" });
      }

      if (!canEditPlaylist(playlist, req.user.username)) {
        return res.status(403).json({ message: "You do not have edit access for this playlist" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No audio file uploaded" });
      }

      const cleanTitle = String(req.body.title || "").trim();
      if (!cleanTitle) {
        return res.status(400).json({ message: "title is required" });
      }
      const cleanArtist = String(req.body.artist || "").trim();

      const audioHash = createAudioHash(req.file.buffer);
      let song = await findSongConflict({
        title: cleanTitle,
        audioHash,
        artist: cleanArtist,
      });

      if (song) {
        const alreadyInPlaylist = playlist.songs.some(
          (songId) => songId.toString() === song._id.toString()
        );

        if (alreadyInPlaylist) {
          return res.status(409).json({ message: "Song already exists in this playlist", song });
        }
      } else {
        const fileData = await uploadFile(req.file, "cohort-audio");

        try {
          song = await songModel.create({
            title: cleanTitle,
            titleKey: createTitleKey(cleanTitle),
            artist: cleanArtist,
            artistKey: createArtistKey(cleanArtist),
            audio: fileData.url,
            audioHash,
            mood: String(req.body.mood || "").trim(),
            ownerUserId: req.user._id,
            ownerUsername: req.user.username,
          });
        } catch (error) {
          // Another request may have inserted the same central song between check and create.
          if (error?.code === 11000) {
            song =
              (await songModel.findOne({ audioHash })) ||
              (await songModel.findOne({ titleKey: createTitleKey(cleanTitle), artistKey: createArtistKey(cleanArtist) }));
          }
          if (!song) {
            throw error;
          }
        }
      }

      playlist.songs.push(song._id);
      await playlist.save();
      await logPlaylistActivity({
        playlist,
        actor: req.user,
        type: "add_song",
        text: `added "${song.title}".`,
      });

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

router.delete("/playlists/:id/songs/:songId", requireAuth, async (req, res) => {
  try {
    const { id, songId } = req.params;
    const deleteSong = req.query.delete === "true";

    const playlist = await playlistModel.findById(id);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (!canEditPlaylist(playlist, req.user.username)) {
      return res.status(403).json({ message: "You do not have edit access for this playlist" });
    }

    const removedSong = await songModel.findById(songId);
    const songIdStr = String(songId);
    const hasSong = playlist.songs.some((id) => String(id) === songIdStr);

    if (!hasSong) {
      return res.status(400).json({ message: "Song is not in this playlist" });
    }

    playlist.songs.pull(songId);
    await playlist.save();
    await logPlaylistActivity({
      playlist,
      actor: req.user,
      type: deleteSong ? "delete_song" : "remove_song",
      text: `${deleteSong ? "deleted" : "removed"} "${removedSong?.title || "song"}" from the playlist.`,
    });

    if (deleteSong) {
      await removeSongIfUnused(songId);
    }

    res.status(200).json({ message: "Song removed" });
  } catch (error) {
    console.error("Playlist song remove error:", error);
    res.status(500).json({ message: "Failed to remove song" });
  }
});

router.put("/playlists/:id/songs/reorder", requireAuth, async (req, res) => {
  try {
    const { songIds } = req.body;
    const playlist = await playlistModel.findById(req.params.id);

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (!canEditPlaylist(playlist, req.user.username)) {
      return res.status(403).json({ message: "You do not have edit access for this playlist" });
    }

    if (!Array.isArray(songIds)) {
      return res.status(400).json({ message: "songIds must be an array" });
    }

    const normalizedIds = songIds.map((id) => String(id));
    const currentIds = playlist.songs.map((id) => id.toString());

    const sameLength = normalizedIds.length === currentIds.length;
    const sameMembers = sameLength && currentIds.every((id) => normalizedIds.includes(id));

    if (!sameMembers) {
      return res.status(400).json({ message: "songIds must contain the same playlist songs" });
    }

    playlist.songs = normalizedIds;
    await playlist.save();
    await logPlaylistActivity({
      playlist,
      actor: req.user,
      type: "reorder",
      text: "reordered the songs in this playlist.",
    });

    const updatedPlaylist = await playlistModel.findById(playlist._id).populate("songs");

    res.status(200).json({ message: "Playlist reordered", playlist: cleanPlaylist(updatedPlaylist) });
  } catch (error) {
    console.error("Playlist reorder error:", error);
    res.status(500).json({ message: "Failed to reorder playlist", error: error.message });
  }
});

router.post("/playlists/:targetId/songs/transfer", requireAuth, async (req, res) => {
  try {
    const { targetId } = req.params;
    const { songId } = req.body;

    if (!songId) {
      return res.status(400).json({ message: "songId is required" });
    }

    const targetPlaylist = await playlistModel.findById(targetId).populate("songs");
    if (!targetPlaylist) {
      return res.status(404).json({ message: "Target playlist not found" });
    }

    if (!canEditPlaylist(targetPlaylist, req.user.username)) {
      return res.status(403).json({ message: "You do not have edit access for this playlist" });
    }

    const originalSong = await songModel.findById(songId);
    if (!originalSong) {
      return res.status(404).json({ message: "Song not found" });
    }

    const alreadyInPlaylist = targetPlaylist.songs.some(
      (song) => song._id.toString() === originalSong._id.toString()
    );

    if (alreadyInPlaylist) {
      return res.status(200).json({
        message: "Song already exists in this playlist",
        targetPlaylist: cleanPlaylist(targetPlaylist),
        duplicate: true,
      });
    }

    targetPlaylist.songs.push(originalSong._id);
    await targetPlaylist.save();
    await logPlaylistActivity({
      playlist: targetPlaylist,
      actor: req.user,
      type: "add_song",
      text: `copied "${originalSong.title}" into this playlist.`,
    });

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

router.get("/featured/saved", requireAuth, async (req, res) => {
  try {
    const populated = await userProfileModel
      .findById(req.user._id)
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

router.post("/featured/playlists/:id/save", requireAuth, async (req, res) => {
  try {
    const playlist = await playlistModel.findById(req.params.id);
    if (!playlist || !playlist.isFeatured) {
      return res.status(404).json({ message: "Featured playlist not found" });
    }

    const profile = await ensureUserProfile(req.user.username, req.user.displayName || req.user.username);

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

router.put("/featured/saved/:playlistId/rename", requireAuth, async (req, res) => {
  try {
    const { playlistId } = req.params;
    const localName = String(req.body.localName || "").trim();

    const profile = await ensureUserProfile(req.user.username, req.user.displayName || req.user.username);
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

router.delete("/featured/saved/:playlistId", requireAuth, async (req, res) => {
  try {
    const { playlistId } = req.params;

    const profile = await ensureUserProfile(req.user.username, req.user.displayName || req.user.username);
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

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escapedQuery, "i");

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

    const usernames = users.map((user) => user.username);
    const featuredCounts = await playlistModel.aggregate([
      { $match: { isFeatured: true, ownerUsername: { $in: usernames } } },
      { $group: { _id: "$ownerUsername", count: { $sum: 1 } } },
    ]);
    const featuredCountMap = new Map(featuredCounts.map((entry) => [entry._id, entry.count]));

    const withStats = users.map((user) => ({
      ...user,
      featuredCount: featuredCountMap.get(user.username) || 0,
      isFollowing: followingSet.has(user.username),
    }));

    res.status(200).json({ users: withStats });
  } catch (error) {
    console.error("Social user search error:", error);
    res.status(500).json({ message: "Failed to search users" });
  }
});

router.get("/social/friends", requireAuth, async (req, res) => {
  try {
    const profile = await ensureUserProfile(req.user.username, req.user.displayName || req.user.username);
    const following = profile.following || [];

    const friendsProfiles = await userProfileModel.find({ username: { $in: following } }).lean();
    const friendMap = new Map(friendsProfiles.map((friend) => [friend.username, friend]));

    const featuredCounts = await playlistModel.aggregate([
      { $match: { isFeatured: true, ownerUsername: { $in: following } } },
      { $group: { _id: "$ownerUsername", count: { $sum: 1 } } },
    ]);
    const featuredCountMap = new Map(featuredCounts.map((entry) => [entry._id, entry.count]));

    const friends = following.map((friendUsername) => ({
      username: friendUsername,
      displayName: friendMap.get(friendUsername)?.displayName || friendUsername,
      featuredCount: featuredCountMap.get(friendUsername) || 0,
    }));

    res.status(200).json({ friends });
  } catch (error) {
    console.error("Friends fetch error:", error);
    res.status(500).json({ message: "Failed to fetch friends" });
  }
});

router.get("/social/stats/:username", requireAuth, async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username || "");
    if (!username) {
      return res.status(400).json({ message: "username is required" });
    }

    const profile = await ensureUserProfile(username, username);
    const followingCount = (profile.following || []).length;
    const followersCount = await userProfileModel.countDocuments({ following: username });

    return res.status(200).json({
      username,
      followersCount,
      followingCount,
    });
  } catch (error) {
    console.error("Social stats error:", error);
    return res.status(500).json({ message: "Failed to fetch social stats" });
  }
});

router.post("/social/follow/:targetUsername", requireAuth, async (req, res) => {
  try {
    const username = req.user.username;
    const targetUsername = normalizeUsername(req.params.targetUsername || "");

    if (!targetUsername) {
      return res.status(400).json({ message: "target username is required" });
    }

    if (username === targetUsername) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const profile = await ensureUserProfile(username, req.user.displayName || username);
    await ensureUserProfile(targetUsername, targetUsername);

    if (!profile.following.includes(targetUsername)) {
      profile.following.push(targetUsername);
      await profile.save();

      await notificationModel.create({
        recipientUsername: targetUsername,
        senderUsername: username,
        senderDisplayName: req.user.displayName || username,
        type: "follow",
        message: `started following you`,
      });
    }

    res.status(200).json({ message: "User followed" });
  } catch (error) {
    console.error("Follow user error:", error);
    res.status(500).json({ message: "Failed to follow user" });
  }
});

router.post("/social/unfollow/:targetUsername", requireAuth, async (req, res) => {
  try {
    const username = req.user.username;
    const targetUsername = normalizeUsername(req.params.targetUsername || "");

    if (!targetUsername) {
      return res.status(400).json({ message: "target username is required" });
    }

    const profile = await ensureUserProfile(username, req.user.displayName || username);
    profile.following = profile.following.filter((entry) => entry !== targetUsername);
    await profile.save();

    res.status(200).json({ message: "User unfollowed" });
  } catch (error) {
    console.error("Unfollow user error:", error);
    res.status(500).json({ message: "Failed to unfollow user" });
  }
});

router.post("/social/message/:targetUsername", requireAuth, async (req, res) => {
  try {
    const username = req.user.username;
    const targetUsername = normalizeUsername(req.params.targetUsername || "");
    const { message } = req.body;

    if (!targetUsername) {
      return res.status(400).json({ message: "target username is required" });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: "Message text is required" });
    }

    await notificationModel.create({
      recipientUsername: targetUsername,
      senderUsername: username,
      senderDisplayName: req.user.displayName || username,
      type: "request_message",
      message: String(message).trim(),
    });

    res.status(200).json({ message: "Message sent" });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
});

router.post("/playlists/:id/like", requireAuth, async (req, res) => {
  try {
    const playlist = await playlistModel.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    const username = normalizeUsername(req.user.username);
    const alreadyLiked = (playlist.likedBy || []).includes(username);

    if (alreadyLiked) {
      await playlistModel.findByIdAndUpdate(req.params.id, {
        $pull: { likedBy: username },
        $inc: { likesCount: -1 },
      });
      return res.status(200).json({ liked: false, likesCount: Math.max(0, (playlist.likesCount || 0) - 1) });
    }

    await playlistModel.findByIdAndUpdate(req.params.id, {
      $addToSet: { likedBy: username },
      $inc: { likesCount: 1 },
    });

    if (playlist.ownerUsername !== username) {
      await notificationModel.create({
        recipientUsername: playlist.ownerUsername,
        senderUsername: username,
        senderDisplayName: req.user.displayName || username,
        type: "like_playlist",
        message: `liked your playlist "${playlist.name}"`,
        playlistId: playlist._id,
        playlistName: playlist.name,
      });
    }

    return res.status(200).json({ liked: true, likesCount: (playlist.likesCount || 0) + 1 });
  } catch (error) {
    console.error("Like toggle error:", error);
    res.status(500).json({ message: "Failed to toggle like" });
  }
});

router.get("/playlists/:id/clone-status", requireAuth, async (req, res) => {
  try {
    const existing = await playlistModel.findOne({
      ownerUsername: req.user.username,
      clonedFrom: req.params.id,
    });
    res.status(200).json({ cloned: Boolean(existing) });
  } catch (error) {
    res.status(500).json({ message: "Failed to check clone status" });
  }
});

router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const notifications = await notificationModel
      .find({ recipientUsername: req.user.username })
      .sort({ createdAt: -1 })
      .limit(100);
    res.status(200).json({ notifications });
  } catch (error) {
    console.error("Notifications fetch error:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

router.put("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    await notificationModel.findByIdAndUpdate(req.params.id, { $set: { read: true } });
    res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark notification as read" });
  }
});

router.put("/notifications/read-all", requireAuth, async (req, res) => {
  try {
    await notificationModel.updateMany(
      { recipientUsername: req.user.username, read: false },
      { $set: { read: true } }
    );
    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Failed to mark all as read:", error);
    res.status(500).json({ message: "Failed to mark all notifications as read" });
  }
});

module.exports = router;
