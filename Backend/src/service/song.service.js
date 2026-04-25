const songModel = require("../models/song.model");
const playlistModel = require("../models/playlist.model");
const uploadFile = require("./storage.service");
const {
  createAudioHash,
  createArtistKey,
  createTitleKey,
  findSongConflict,
  removeSongIfUnused,
} = require("../utils/song.util");

const normalizeMood = (value = "") => String(value).trim().toLowerCase();

// Strip session-specific params from Jamendo URLs so the same track always maps to one DB record
const normalizeExternalUrl = (url) => {
  try {
    const u = new URL(url);
    u.searchParams.delete("from");
    return u.toString();
  } catch {
    return url;
  }
};

const createSongFromUpload = async ({ file, title, artist, mood, user }) => {
  if (!user?._id) {
    return { error: { status: 401, message: "Login required" } };
  }

  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) {
    return { error: { status: 400, message: "title is required" } };
  }
  const cleanArtist = String(artist || "").trim() || "Unknown";

  const audioHash = createAudioHash(file.buffer);
  const conflict = await findSongConflict({
    title: cleanTitle,
    audioHash,
    artist: cleanArtist,
  });
  if (conflict) {
    return {
      error: {
        status: 409,
        message: "Song already exists in the central database",
        song: conflict,
      },
    };
  }

  const fileData = await uploadFile(file, "cohort-audio");
  const titleKey = createTitleKey(cleanTitle);
  const artistKey = createArtistKey(cleanArtist);

  let song;
  try {
    song = await songModel.create({
      title: cleanTitle,
      titleKey,
      artist: cleanArtist,
      artistKey,
      audio: fileData.url,
      audioHash,
      mood: normalizeMood(mood),
      ownerUserId: user._id,
      ownerUsername: user.username,
    });
  } catch (error) {
    // Handle concurrent insert race when another upload created the same central song first.
    if (error?.code !== 11000) throw error;

    const existingSong =
      (await songModel.findOne({ audioHash })) ||
      (await songModel.findOne({ titleKey, artistKey }));

    return {
      error: {
        status: 409,
        message: "Song already exists in the central database",
        song: existingSong || null,
      },
    };
  }

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

const createExternalSongRecord = async ({ title, artist, audio, mood, user }) => {
  if (!user?._id) {
    return { error: { status: 401, message: "Login required" } };
  }

  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) {
    return { error: { status: 400, message: "title is required" } };
  }
  const cleanArtist = String(artist || "").trim() || "Unknown";

  // Normalize URL so the same Jamendo track always gets one DB record
  const normalizedAudio = normalizeExternalUrl(audio);
  const audioHash = createAudioHash(Buffer.from(normalizedAudio)); 
  const titleKey = createTitleKey(cleanTitle);
  const artistKey = createArtistKey(cleanArtist);

  let song = await songModel.findOne({ audioHash });
  if (song) {
    return { song }; // If someone already saved this external song, reuse it
  }

  try {
    song = await songModel.create({
      title: cleanTitle,
      titleKey,
      artist: cleanArtist,
      artistKey,
      audio: normalizedAudio, // store normalized external URL
      audioHash,
      mood: normalizeMood(mood || "explore"),
      ownerUserId: user._id,
      ownerUsername: user.username,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    song = await songModel.findOne({ audioHash });
  }

  return { song };
};

const toggleSongLike = async (songId, username) => {
  if (!username) {
    return { error: { status: 401, message: "Login required" } };
  }

  const song = await songModel.findById(songId);
  if (!song) {
    return { error: { status: 404, message: "Song not found" } };
  }

  const targetUsername = String(username).trim().toLowerCase();
  const likedIndex = song.likedBy.indexOf(targetUsername);

  let isLiked = false;
  if (likedIndex > -1) {
    song.likedBy.splice(likedIndex, 1);
    song.likesCount = Math.max(0, song.likedBy.length);
  } else {
    song.likedBy.push(targetUsername);
    song.likesCount = song.likedBy.length;
    isLiked = true;
  }

  await song.save();
  return { isLiked, song };
};

const getTopLikedSongs = async (limit = 20) => {
  const songs = await songModel
    .find({ likesCount: { $gt: 0 } })
    .sort({ likesCount: -1, createdAt: -1 })
    .limit(limit);

  return { songs };
};

const getMyLikedSongs = async (username) => {
  if (!username) return { songs: [] };
  const targetUsername = String(username).trim().toLowerCase();
  
  const songs = await songModel
    .find({ likedBy: targetUsername })
    .sort({ createdAt: -1 });
    
  return { songs };
};

module.exports = {
  createSongFromUpload,
  listSongs,
  listMySongs,
  deleteSongEverywhere,
  createExternalSongRecord,
  toggleSongLike,
  getTopLikedSongs,
  getMyLikedSongs,
};
