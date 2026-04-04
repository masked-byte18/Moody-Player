export const dummyDiscoverProfiles = {
  djarya: {
    username: "djarya",
    displayName: "DJ Arya",
    tagline: "Curates warm late-night sets and glossy electronic moods.",
    favoriteMoods: ["energetic", "happy", "dance pop"],
  },
  moonframes: {
    username: "moonframes",
    displayName: "Moon Frames",
    tagline: "Collects dreamy pop, chill beats, and cinematic mood blends.",
    favoriteMoods: ["neutral", "sad", "hip hop"],
  },
};

export const dummyDiscoverPlaylists = [
  {
    _id: "dummy-djarya-night-drive",
    name: "Night Drive Pulse",
    description: "Electric late-night motion with glossy pop and neon drums.",
    ownerUsername: "djarya",
    ownerDisplayName: "DJ Arya",
    coverImage: "",
    isFeatured: true,
    songs: [
      { _id: "dummy-song-1", title: "Midnight Lane", artist: "Nova Echo", mood: "happy" },
      { _id: "dummy-song-2", title: "City Sparks", artist: "Velar", mood: "energetic" },
      { _id: "dummy-song-3", title: "Chrome Sunset", artist: "Astra V", mood: "happy" },
    ],
  },
  {
    _id: "dummy-moonframes-cloud-radio",
    name: "Cloud Radio",
    description: "Floating indie textures, soft beats, and introspective hooks.",
    ownerUsername: "moonframes",
    ownerDisplayName: "Moon Frames",
    coverImage: "",
    isFeatured: true,
    songs: [
      { _id: "dummy-song-4", title: "Soft Horizon", artist: "Blue Static", mood: "neutral" },
      { _id: "dummy-song-5", title: "Paper Skies", artist: "Luma", mood: "sad" },
      { _id: "dummy-song-6", title: "Velvet Weather", artist: "North Vale", mood: "neutral" },
    ],
  },
];

export const getDummyPlaylistById = (id) =>
  dummyDiscoverPlaylists.find((playlist) => playlist._id === id) || null;

export const getDummyPlaylistsByUsername = (username) =>
  dummyDiscoverPlaylists.filter(
    (playlist) => playlist.ownerUsername?.toLowerCase() === username?.toLowerCase()
  );
