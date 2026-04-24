require("dotenv").config();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const userProfileModel = require("./src/models/userProfile.model");
const playlistModel = require("./src/models/playlist.model");

const normalizeUsername = (v = "") => String(v).trim().toLowerCase();

const isPlaylistOwner = (playlist, username) =>
  (playlist?.ownerUsername || "") === normalizeUsername(username || "");

const isPlaylistContributor = (playlist, username) => {
  const target = normalizeUsername(username);
  return (playlist?.contributors || []).some((c) => normalizeUsername(c) === target);
};

const canEditPlaylist = (playlist, username) =>
  isPlaylistOwner(playlist, username) ||
  (Boolean(playlist?.isFeatured) && isPlaylistContributor(playlist, username));

mongoose.connect(process.env.MONGODB_URL).then(async () => {
  try {
    const playlistId = "69e3ea9d8c441f0fdf86a4ce";
    const collaboratorUsername = "test3";

    const user = await userProfileModel.findOne({ username: collaboratorUsername });
    if (!user) {
      console.log("❌ User test3 not found!");
      return;
    }
    console.log("✅ User found:", user.username, user._id.toString());

    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username, email: user.email || "" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    console.log("✅ Token created");

    const playlist = await playlistModel.findById(playlistId);
    if (!playlist) {
      console.log("❌ Playlist not found!");
      return;
    }
    console.log("✅ Playlist found:", playlist.name);
    console.log("   isFeatured:", playlist.isFeatured);
    console.log("   ownerUsername:", playlist.ownerUsername);
    console.log("   contributors:", playlist.contributors);
    console.log("   songs:", playlist.songs.map(s => s.toString()));

    const canEdit = canEditPlaylist(playlist, collaboratorUsername);
    console.log("   canEditPlaylist:", canEdit);

    if (!canEdit) {
      console.log("❌ PROBLEM: canEditPlaylist is false for test3!");
      console.log("   isOwner:", isPlaylistOwner(playlist, collaboratorUsername));
      console.log("   isFeatured:", playlist.isFeatured);
      console.log("   isContributor:", isPlaylistContributor(playlist, collaboratorUsername));
      return;
    }

    // Test actual API call
    const songId = playlist.songs[0]?.toString();
    if (!songId) {
      console.log("❌ No songs to test!");
      return;
    }

    console.log("\n🚀 Testing DELETE API call for song:", songId);
    const res = await fetch(`http://localhost:3000/playlists/${playlistId}/songs/${songId}?delete=true`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log("   Response status:", res.status);
    const data = await res.json();
    console.log("   Response data:", JSON.stringify(data));

  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    process.exit(0);
  }
});
