const songModel = require("../models/song.model");
const playlistModel = require("../models/playlist.model");
const uploadFile = require("./storage.service");
const {
  createAudioHash,
  createTitleKey,
  findSongConflict,
  removeSongIfUnused,
} = require("../utils/song.util");

const normalizeMood = (value = "") => String(value).trim().toLowerCase();

const createSongFromUpload = async ({ file, title, artist, mood, user }) => {
  if (!user?._id) {
    return { error: { status: 401, message: "Login required" } };
  }

  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) {
    return { error: { status: 400, message: "title is required" } };
  }

  const audioHash = createAudioHash(file.buffer);
  const conflict = await findSongConflict({
    title: cleanTitle,
    audioHash,
    ownerUserId: user._id,
  });
  if (conflict) {
    return {
      error: {
        status: 409,
        message: "Song with same name or file already exists",
        song: conflict,
      },
    };
  }

  const fileData = await uploadFile(file, "cohort-audio");

  const song = await songModel.create({
    title: cleanTitle,
    titleKey: createTitleKey(cleanTitle),
    artist: String(artist || "").trim() || "Unknown",
    audio: fileData.url,
    audioHash,
    mood: normalizeMood(mood),
    ownerUserId: user._id,
    ownerUsername: user.username,
  });

  return { song };
};

const listSongs = async ({ mood }) => {
  const normalized = normalizeMood(mood);
  const filter = normalized ? { mood: normalized } : {};
  return songModel.find(filter).sort({ createdAt: -1 });
};

const listMySongs = async ({ mood, user }) => {
  if (!user?._id) {
    return [];
  }

  const normalized = normalizeMood(mood);
  const filter = normalized ? { mood: normalized, ownerUserId: user._id } : { ownerUserId: user._id };
  return songModel.find(filter).sort({ createdAt: -1 });
};

const deleteSongEverywhere = async ({ songId, user }) => {
  const song = await songModel.findById(songId);
  if (!song) {
    return { error: { status: 404, message: "Song not found" } };
  }

  if (!user?._id || song.ownerUserId?.toString() !== user._id.toString()) {
    return { error: { status: 403, message: "You can only delete your own songs" } };
  }

  await playlistModel.updateMany({ songs: song._id }, { $pull: { songs: song._id } });
  await removeSongIfUnused(song._id);

  return { song };
};

module.exports = {
  createSongFromUpload,
  listSongs,
  listMySongs,
  deleteSongEverywhere,
};
