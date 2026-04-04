import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { analyzeAudioMood, deriveTitleFromFile } from "../utils/audioMood";
import { getDummyPlaylistById } from "../data/discoverDummyData";
import "./PlaylistPage.css";
import "./PlaylistsPage.css";

const API = "http://localhost:3000";

const normalizeMood = (mood) => (mood || "unknown").toLowerCase();

const createRandomOrder = (songs) => {
  const nextSongs = [...songs];
  for (let index = nextSongs.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextSongs[index], nextSongs[swapIndex]] = [nextSongs[swapIndex], nextSongs[index]];
  }
  return nextSongs;
};

const createMagicShuffle = (songs) => {
  const buckets = songs.reduce((accumulator, song) => {
    const mood = normalizeMood(song.mood);
    if (!accumulator[mood]) accumulator[mood] = [];
    accumulator[mood].push(song);
    return accumulator;
  }, {});

  const moodPriority = Object.keys(buckets).sort((left, right) => buckets[right].length - buckets[left].length);
  const orderedBuckets = moodPriority.map((mood) => createRandomOrder(buckets[mood]));
  const shuffled = [];

  while (orderedBuckets.some((bucket) => bucket.length > 0)) {
    orderedBuckets.forEach((bucket) => {
      if (bucket.length > 0) {
        shuffled.push(bucket.shift());
      }
    });
  }

  return shuffled;
};

const PlaylistPage = ({
  activePlaylistId,
  queue,
  queueSource,
  isPlaying,
  currentIndex,
  onPlayPlaylist,
  onPlayPause,
  onUpdateActivePlaylist,
  activeUser,
  authToken,
}) => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songFile, setSongFile] = useState(null);
  const [moodOverride, setMoodOverride] = useState("auto");
  const [uploading, setUploading] = useState(false);
  const [localSongs, setLocalSongs] = useState([]);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyTargetSong, setCopyTargetSong] = useState(null);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [selectedTargetPlaylistId, setSelectedTargetPlaylistId] = useState("");
  const [copyingSong, setCopyingSong] = useState(false);
  const [openSongMenu, setOpenSongMenu] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const authConfig = authToken
    ? {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    : null;

  const loadPlaylist = useCallback(async () => {
    setLoading(true);
    try {
      const dummyFromState = location.state?.playlistData;
      if (dummyFromState?._id === id) {
        setPlaylist(dummyFromState);
        setLocalSongs(dummyFromState?.songs || []);
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API}/playlists/${id}`);
      setPlaylist(response.data.playlist);
      setLocalSongs(response.data.playlist?.songs || []);
    } catch (error) {
      console.error("Failed to load playlist:", error);
      const dummyPlaylist = getDummyPlaylistById(id);
      if (dummyPlaylist) {
        setPlaylist(dummyPlaylist);
        setLocalSongs(dummyPlaylist.songs || []);
      } else {
        setPlaylist(null);
        setLocalSongs([]);
      }
    } finally {
      setLoading(false);
    }
  }, [id, location.state]);

  const loadUserPlaylists = useCallback(async () => {
    if (!activeUser || activeUser === "guest") {
      setUserPlaylists([]);
      return;
    }

    try {
      const response = await axios.get(`${API}/playlists`, {
        params: { username: activeUser, scope: "personal" },
      });
      setUserPlaylists(response.data.playlists || []);
    } catch (error) {
      console.error("Failed to load user playlists:", error);
      setUserPlaylists([]);
    }
  }, [activeUser]);

  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  useEffect(() => {
    loadUserPlaylists();
  }, [loadUserPlaylists]);

  useEffect(() => {
    const handleWindowClick = () => setOpenSongMenu(null);
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  useEffect(() => {
    const handleViewportChange = () => setOpenSongMenu(null);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, []);

  const displayedSongs = useMemo(() => {
    if (!playlist) return [];
    if (activePlaylistId === playlist._id && queueSource?.type === "playlist" && queueSource?.playlistId === playlist._id) {
      return queue;
    }
    return localSongs;
  }, [activePlaylistId, localSongs, playlist, queue, queueSource]);

  const moodSummary = useMemo(() => {
    const counts = localSongs.reduce((accumulator, song) => {
      const mood = normalizeMood(song.mood);
      accumulator[mood] = (accumulator[mood] || 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(counts)
      .sort((left, right) => right[1] - left[1])
      .map(([mood, total]) => ({ mood, total }));
  }, [localSongs]);

  const resetAddSongForm = () => {
    setSongTitle("");
    setSongArtist("");
    setSongFile(null);
    setMoodOverride("auto");
  };

  const syncPlaylistSongs = (songs, nextIndex = currentIndex) => {
    if (!playlist) return;
    const updatedPlaylist = { ...playlist, songs };
    setPlaylist(updatedPlaylist);
    setLocalSongs(songs);

    if (activePlaylistId === playlist._id) {
      onUpdateActivePlaylist(updatedPlaylist, nextIndex);
    }
  };

  const playSongs = (songs, startIndex = 0) => {
    if (!playlist || !songs.length) return;
    const playablePlaylist = {
      ...playlist,
      songs,
    };
    onPlayPlaylist(playablePlaylist, startIndex);
  };

  const handlePlayCurrentPlaylist = (index = 0) => {
    playSongs(localSongs, index);
  };

  const handlePrimaryPlayAction = () => {
    if (!localSongs.length) return;
    if (isActivePlaylist) {
      onPlayPause();
      return;
    }
    handlePlayCurrentPlaylist(0);
  };

  const handleShufflePlay = () => {
    if (!localSongs.length) return;
    playSongs(createRandomOrder(localSongs), 0);
  };

  const handleMagicShuffle = () => {
    if (!localSongs.length) return;
    playSongs(createMagicShuffle(localSongs), 0);
  };

  const handleTemporaryRemove = (index) => {
    const nextSongs = localSongs.filter((_, songIndex) => songIndex !== index);
    let nextIndex = currentIndex;

    if (!nextSongs.length) {
      nextIndex = 0;
    } else if (index === currentIndex) {
      nextIndex = index >= nextSongs.length ? 0 : index;
    } else if (index < currentIndex) {
      nextIndex = Math.max(currentIndex - 1, 0);
    }

    syncPlaylistSongs(nextSongs, nextIndex);
  };

  const handleReorder = async (nextSongs, nextIndex) => {
    if (!playlist) return;

    syncPlaylistSongs(nextSongs, nextIndex);

    if (!authConfig) return;

    try {
      await axios.put(
        `${API}/playlists/${playlist._id}/songs/reorder`,
        {
          songIds: nextSongs.map((song) => song?._id).filter(Boolean),
        },
        authConfig
      );
    } catch (error) {
      console.error("Reorder error:", error);
      await loadPlaylist();
    }
  };

  const handleSongDragStart = (index, event) => {
    setDraggedIndex(index);
    setDragOverIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handleSongDragOver = (index, event) => {
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleSongDrop = async (index, event) => {
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const nextSongs = [...localSongs];
    const [movedSong] = nextSongs.splice(draggedIndex, 1);
    nextSongs.splice(index, 0, movedSong);

    let nextIndex = currentIndex;
    if (draggedIndex === currentIndex) {
      nextIndex = index;
    } else if (draggedIndex < currentIndex && index >= currentIndex) {
      nextIndex = currentIndex - 1;
    } else if (draggedIndex > currentIndex && index <= currentIndex) {
      nextIndex = currentIndex + 1;
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
    await handleReorder(nextSongs, nextIndex);
  };

  const handleSongDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDeleteSong = async (songId) => {
    if (!playlist || !songId) return;
    if (!authConfig) {
      alert("Please log in again to delete songs.");
      return;
    }

    const confirmed = window.confirm("Permanently delete this song from this playlist?");
    if (!confirmed) return;

    try {
      await axios.delete(`${API}/playlists/${playlist._id}/songs/${songId}?delete=true`, authConfig);
      await loadPlaylist();
    } catch (error) {
      console.error("Delete song error:", error);
      alert(error?.response?.data?.message || "Failed to delete song");
    }
  };

  const handleAddSong = async (event) => {
    event.preventDefault();
    if (!songFile || !playlist) return;
    if (!authConfig) {
      alert("Please log in again to add songs.");
      return;
    }

    setUploading(true);

    let resolvedMood = "unknown";
    if (moodOverride === "auto") {
      resolvedMood = await analyzeAudioMood(songFile);
    } else {
      resolvedMood = moodOverride;
    }

    const resolvedTitle = songTitle.trim() || deriveTitleFromFile(songFile);
    const resolvedArtist = songArtist.trim() || "Unknown";

    const formData = new FormData();
    formData.append("audio", songFile);
    formData.append("title", resolvedTitle);
    formData.append("artist", resolvedArtist);
    formData.append("mood", resolvedMood);

    try {
      const response = await axios.post(`${API}/playlists/${playlist._id}/songs/upload`, formData, authConfig);
      syncPlaylistSongs(response.data.playlist?.songs || [], currentIndex);
      setShowAddModal(false);
      resetAddSongForm();
    } catch (error) {
      console.error("Add song error:", error);
      const message = error?.response?.data?.message || "Failed to add song";
      if (error?.response?.status === 409) {
        alert(`${message}. Same song name or same audio file already exists in the database.`);
      } else {
        alert(message);
      }
    } finally {
      setUploading(false);
    }
  };

  const openCopyModal = (song) => {
    const availableTargets = userPlaylists.filter((item) => item._id !== playlist?._id);
    setCopyTargetSong(song);
    setSelectedTargetPlaylistId(availableTargets[0]?._id || "");
    setShowCopyModal(true);
  };

  const toggleSongMenu = (event, songId) => {
    event.stopPropagation();
    const buttonRect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 228;
    const menuHeight = 210;
    const nextTop = Math.max(16, buttonRect.top - menuHeight - 10);
    const nextLeft = Math.min(
      window.innerWidth - menuWidth - 16,
      Math.max(16, buttonRect.right - menuWidth)
    );

    setOpenSongMenu((current) =>
      current?.songId === songId
        ? null
        : {
            songId,
            top: nextTop,
            left: nextLeft,
          }
    );
  };

  const handleCopyToPlaylist = async () => {
    if (!copyTargetSong?._id || !selectedTargetPlaylistId) return;
    if (!authConfig) {
      alert("Please log in again to copy songs.");
      return;
    }

    setCopyingSong(true);
    try {
      const response = await axios.post(
        `${API}/playlists/${selectedTargetPlaylistId}/songs/transfer`,
        { songId: copyTargetSong._id },
        authConfig
      );

      if (response.data.duplicate) {
        alert("That song is already in the selected playlist.");
      } else {
        alert("Song copied to the selected playlist.");
      }

      setShowCopyModal(false);
      setCopyTargetSong(null);
      await loadUserPlaylists();
    } catch (error) {
      console.error("Copy song error:", error);
      alert(error?.response?.data?.message || "Failed to copy song");
    } finally {
      setCopyingSong(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className="playlist-page-shell">
          <div className="playlist-loading-card">Loading playlist...</div>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="page-shell">
        <div className="playlist-page-shell">
          <div className="playlist-empty-card">
            <h2>Playlist not found</h2>
            <p>This playlist may have been deleted or the link is invalid.</p>
            <Link to="/playlists" className="btn-secondary playlist-back-link">
              Back to Playlists
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isActivePlaylist = queueSource?.type === "playlist" && queueSource?.playlistId === playlist._id;
  const activeSong = isActivePlaylist && displayedSongs.length > 0 ? displayedSongs[currentIndex] : null;
  const copyTargets = userPlaylists.filter((item) => item._id !== playlist._id);
  const playlistOwnerUsername = location.state?.ownerUsername || playlist.ownerUsername;
  const shouldShowOwnerLink =
    Boolean(playlistOwnerUsername) &&
    playlistOwnerUsername !== activeUser &&
    location.state?.source === "discover";

  return (
    <div className="page-shell">
      <div className="playlist-page-shell">
        <div className="playlist-sticky-bar">
          <div className="playlist-sticky-copy">
            <div className="playlist-sticky-thumb">
              {playlist.coverImage ? (
                <img src={playlist.coverImage} alt={playlist.name} />
              ) : (
                <div className="playlist-sticky-thumb-placeholder">No</div>
              )}
            </div>
            <div className="playlist-sticky-text">
              <span className="playlist-sticky-label">Playlist</span>
              <strong>{playlist.name}</strong>
            </div>
          </div>
          <div className="playlist-sticky-actions">
            <button
              type="button"
              className="playlist-icon-button playlist-icon-button-primary"
              onClick={handlePrimaryPlayAction}
              disabled={!localSongs.length}
              title="Play playlist"
            >
              <i className={isActivePlaylist && isPlaying ? "ri-pause-fill" : "ri-play-fill"}></i>
            </button>
            <button
              type="button"
              className="playlist-icon-button"
              onClick={handleShufflePlay}
              disabled={!localSongs.length}
              title="Shuffle play"
            >
              <i className="ri-shuffle-line"></i>
            </button>
          </div>
        </div>

        <section className="playlist-profile-card">
          <div className="playlist-profile-content">
            <div className="playlist-mood-strip playlist-mood-strip-only">
              <div className="playlist-mood-chips">
                {moodSummary.length ? (
                  moodSummary.map(({ mood, total }) => (
                    <span key={mood} className={`playlist-mood-chip mood-${mood}`}>
                      {mood}
                      <strong>{total}</strong>
                    </span>
                  ))
                ) : (
                  <span className="playlist-mood-chip mood-unknown">No moods yet</span>
                )}
              </div>
            </div>
          </div>
        </section>

        <button type="button" className="playlist-add-row" onClick={() => setShowAddModal(true)}>
          <span className="playlist-add-icon">
            <i className="ri-add-line"></i>
          </span>
          <span className="playlist-add-copy">
            <strong>Add to this playlist</strong>
            <span>Upload a fresh song into {playlist.name}</span>
          </span>
        </button>

        <section className="playlist-song-panel">
          <div className="playlist-song-panel-header">
            <div className="playlist-song-panel-title-row">
              <div className="playlist-song-panel-title-group">
                <div className="playlist-song-panel-title">
                <h2>All Songs</h2>
                  <span className="playlist-song-count-chip">{localSongs.length} song(s)</span>
                </div>
                {shouldShowOwnerLink ? (
                  <button
                    type="button"
                    className="playlist-owner-link-button"
                    onClick={() => navigate(`/discover/users/${playlistOwnerUsername}`)}
                  >
                    @{playlistOwnerUsername}
                  </button>
                ) : null}
              </div>
              <div className="playlist-song-panel-subcopy">
                <p>{activeSong ? `Now Playing: ${activeSong.title}` : "Now Playing: Nothing yet"}</p>
              </div>
            </div>
          </div>

          <div className="playlist-song-list">
            {displayedSongs.length ? (
              displayedSongs.map((song, index) => {
                const isCurrentSong = isActivePlaylist && index === currentIndex;
                return (
                  <article
                    key={song._id || `${song.title}-${index}`}
                    className={`playlist-song-row ${isCurrentSong ? "is-active" : ""} ${
                      draggedIndex === index ? "is-dragging" : ""
                    } ${dragOverIndex === index && draggedIndex !== index ? "is-drop-target" : ""}`}
                    draggable
                    onDragStart={(event) => handleSongDragStart(index, event)}
                    onDragOver={(event) => handleSongDragOver(index, event)}
                    onDrop={(event) => handleSongDrop(index, event)}
                    onDragEnd={handleSongDragEnd}
                  >
                    <button
                      type="button"
                      className="playlist-song-main"
                      onClick={() => handlePlayCurrentPlaylist(index)}
                    >
                      <span className="playlist-song-index">
                        {isCurrentSong && isPlaying ? <i className="ri-volume-up-fill"></i> : index + 1}
                      </span>

                      <div className="playlist-song-copy">
                        <strong>{song.title}</strong>
                        <span>{song.artist || "Unknown"}</span>
                      </div>
                    </button>

                    <div className="playlist-song-side">
                      <span className={`playlist-song-mood mood-${normalizeMood(song.mood)}`}>
                        {(song.mood || "unknown").toUpperCase()}
                      </span>

                      <div className="playlist-song-menu-wrap" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          className="playlist-song-menu-button"
                          onClick={(event) => toggleSongMenu(event, song._id)}
                          title="Song options"
                        >
                          <i className="ri-more-2-fill"></i>
                        </button>

                        {openSongMenu?.songId === song._id ? (
                          <div
                            className="playlist-song-menu playlist-song-menu-floating"
                            style={{
                              top: `${openSongMenu.top}px`,
                              left: `${openSongMenu.left}px`,
                            }}
                          >
                            <button
                              type="button"
                              className="playlist-song-menu-item"
                              onClick={() => {
                                setOpenSongMenu(null);
                                openCopyModal(song);
                              }}
                            >
                              <i className="ri-upload-2-line"></i>
                              Upload to playlist
                            </button>
                            <button
                              type="button"
                              className="playlist-song-menu-item"
                              onClick={() => {
                                setOpenSongMenu(null);
                                handleTemporaryRemove(index);
                              }}
                            >
                              <i className="ri-close-circle-line"></i>
                              Temporary remove
                            </button>
                            <button
                              type="button"
                              className="playlist-song-menu-item danger"
                              onClick={() => {
                                setOpenSongMenu(null);
                                handleDeleteSong(song._id);
                              }}
                            >
                              <i className="ri-delete-bin-6-line"></i>
                              Delete song
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="playlist-empty-songs">
                <i className="ri-music-2-line"></i>
                <p>No songs in this playlist yet.</p>
              </div>
            )}
          </div>
        </section>

        {showAddModal ? (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <h3>Add Song to {playlist.name}</h3>
              <form className="modal-form" onSubmit={handleAddSong}>
                <label>
                  Song Title
                  <input type="text" value={songTitle} onChange={(event) => setSongTitle(event.target.value)} />
                </label>
                <label>
                  Artist
                  <input type="text" value={songArtist} onChange={(event) => setSongArtist(event.target.value)} />
                </label>
                <label>
                  Mood
                  <select value={moodOverride} onChange={(event) => setMoodOverride(event.target.value)}>
                    <option value="auto">Auto Detect</option>
                    <option value="happy">Happy</option>
                    <option value="sad">Sad</option>
                    <option value="neutral">Neutral</option>
                    <option value="angry">Angry</option>
                    <option value="surprised">Surprised</option>
                  </select>
                </label>
                <label>
                  Audio File
                  <input
                    type="file"
                    accept="audio/*,audio/mpeg,video/mpeg,.mp3,.mpeg"
                    required
                    onChange={(event) => setSongFile(event.target.files?.[0] || null)}
                  />
                </label>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={uploading}>
                    {uploading ? "Uploading..." : "Add Song"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {showCopyModal ? (
          <div className="modal-overlay" onClick={() => setShowCopyModal(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <h3>Upload To Another Playlist</h3>
              <p className="copy-song-description">
                {copyTargetSong ? `"${copyTargetSong.title}" by ${copyTargetSong.artist}` : "Select a song"}
              </p>
              {copyTargets.length > 0 ? (
                <>
                  <label className="copy-target-label">
                    Choose your playlist
                    <select
                      value={selectedTargetPlaylistId}
                      onChange={(event) => setSelectedTargetPlaylistId(event.target.value)}
                    >
                      {copyTargets.map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={() => setShowCopyModal(false)}>
                      Cancel
                    </button>
                    <button type="button" className="btn-primary" onClick={handleCopyToPlaylist} disabled={copyingSong}>
                      {copyingSong ? "Copying..." : "Copy Song"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="copy-song-description">Create another playlist first to copy songs into it.</p>
                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={() => setShowCopyModal(false)}>
                      Close
                    </button>
                    <button type="button" className="btn-primary" onClick={() => navigate("/playlists")}>
                      Go To Playlists
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PlaylistPage;
