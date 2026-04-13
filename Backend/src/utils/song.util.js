const crypto = require("crypto");
const playlistModel = require("../models/playlist.model");
const songModel = require("../models/song.model");

const createTitleKey = (title = "") => String(title).trim().toLowerCase().replace(/\s+/g, " ");

const createAudioHash = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

const findSongConflict = async ({ title, audioHash, ownerUserId }) => {
  const conditions = [];

  if (title) {
    conditions.push({ titleKey: createTitleKey(title) });
  }

  if (audioHash) {
    conditions.push({ audioHash });
  }

  if (!conditions.length) {
    return null;
  }

  const filter = { $or: conditions };
  if (ownerUserId) {
    filter.ownerUserId = ownerUserId;
  }

  return songModel.findOne(filter);
};

const removeSongIfUnused = async (songId) => {
  const stillReferenced = await playlistModel.exists({ songs: songId });
  if (!stillReferenced) {
    await songModel.findByIdAndDelete(songId);
  }
};

module.exports = {
  createTitleKey,
  createAudioHash,
  findSongConflict,
  removeSongIfUnused,
};
