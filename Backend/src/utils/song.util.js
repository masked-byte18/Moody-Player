const crypto = require("crypto");
const playlistModel = require("../models/playlist.model");
const songModel = require("../models/song.model");

const createTitleKey = (title = "") => String(title).trim().toLowerCase().replace(/\s+/g, " ");
const createArtistKey = (artist = "") => String(artist).trim().toLowerCase().replace(/\s+/g, " ");

const createAudioHash = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

const findSongConflict = async ({ title, audioHash, artist }) => {
  // Global central DB match by exact audio first (most reliable dedupe key).
  if (audioHash) {
    const byHash = await songModel.findOne({ audioHash });
    if (byHash) return byHash;
  }

  // Fallback: same normalized title + artist pair.
  const titleKey = createTitleKey(title);
  const artistKey = createArtistKey(artist);
  if (titleKey && artistKey) {
    return songModel.findOne({ titleKey, artistKey });
  }

  return null;
};

const removeSongIfUnused = async (songId) => {
  const stillReferenced = await playlistModel.exists({ songs: songId });
  if (!stillReferenced) {
    await songModel.findByIdAndDelete(songId);
  }
};

module.exports = {
  createTitleKey,
  createArtistKey,
  createAudioHash,
  findSongConflict,
  removeSongIfUnused,
};
