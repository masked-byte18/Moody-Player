import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import QueueList from "./QueueList";
import { analyzeAudioMood, deriveTitleFromFile } from "../utils/audioMood";
import "./PlaylistPage.css";
import "./PlaylistsPage.css";

const API = "http://localhost:3000";

const PlaylistPage = ({
  activePlaylistId,
  queue,
  queueSource,
  isPlaying,
  currentIndex,
  onPlayPlaylist,
  onPlayPause,
  onNext,
  onPrevious,
  onStop,
  onUpdateActivePlaylist,
  loopCurrentSong = false,
  onToggleLoop,
  activeUser,
  authToken,
}) => {
  const { id } = useParams();
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
      const response = await axios.get(`${API}/playlists/${id}`);
      setPlaylist(response.data.playlist);
      setLocalSongs(response.data.playlist?.songs || []);
    } catch (error) {
      console.error("Failed to load playlist:", error);
      setPlaylist(null);
      setLocalSongs([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

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

  const displayedSongs = useMemo(() => {
    if (!playlist) return [];
    if (activePlaylistId === playlist._id && queueSource?.type === "playlist" && queueSource?.playlistId === playlist._id) {
      return queue;
    }
    return localSongs;
  }, [activePlaylistId, localSongs, playlist, queue, queueSource]);

  const handlePlayCurrentPlaylist = (index = 0) => {
    if (playlist) {
      const playablePlaylist = { ...playlist, songs: localSongs };
      onPlayPlaylist(playablePlaylist, index);
    }
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

  const handleRemoveFromPlaylist = async ({ queue: nextQueue, currentIndex: nextIndex }) => {
    syncPlaylistSongs(nextQueue, nextIndex);
  };

  const handleDeleteSong = async ({ songId }) => {
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

  const handleReorder = async (nextQueue, nextIndex) => {
    if (!playlist || !authConfig) return;

    const songIds = nextQueue.map((song) => song?._id).filter(Boolean);
    syncPlaylistSongs(nextQueue, nextIndex);

    try {
      await axios.put(`${API}/playlists/${playlist._id}/songs/reorder`, { songIds }, authConfig);
    } catch (error) {
      console.error("Reorder error:", error);
      await loadPlaylist();
    }
  };

  const resetAddSongForm = () => {
    setSongTitle("");
    setSongArtist("");
    setSongFile(null);
    setMoodOverride("auto");
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

  const handleMenuDelete = ({ song }) => {
    handleDeleteSong({ songId: song?._id });
  };

  const handleMenuRemove = ({ queue: nextQueue, currentIndex: nextIndex, song }) => {
    handleRemoveFromPlaylist({ queue: nextQueue, currentIndex: nextIndex, song });
  };

  const songMenuActions = [
    {
      id: "copy",
      label: "Upload To Another Playlist",
      meta: () => "Copy this song into one of your playlists",
      onSelect: ({ song }) => openCopyModal(song),
    },
    {
      id: "mood",
      label: "Song Mood",
      meta: (song) => (song?.mood || "unknown").toUpperCase(),
      onSelect: ({ song }) => alert(`Mood: ${(song?.mood || "unknown").toUpperCase()}`),
    },
    {
      id: "remove",
      label: "Temporary Remove",
      variant: "warning",
      meta: () => "Hide it from this page until refresh",
      onSelect: ({ index }) => {
        const nextQueue = localSongs.filter((_, songIndex) => songIndex !== index);
        let nextIndex = currentIndex;

        if (!nextQueue.length) {
          nextIndex = 0;
        } else if (index === currentIndex) {
          nextIndex = index >= nextQueue.length ? 0 : index;
        } else if (index < currentIndex) {
          nextIndex = Math.max(currentIndex - 1, 0);
        }

        handleMenuRemove({ queue: nextQueue, currentIndex: nextIndex, song: localSongs[index] });
      },
    },
    {
      id: "delete",
      label: "Delete Song",
      variant: "danger",
      meta: () => "Remove it from this playlist and database if unused",
      onSelect: ({ song }) => handleMenuDelete({ song }),
    },
  ];

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

  const isActivePlaylist =
    queueSource?.type === "playlist" && queueSource?.playlistId === playlist._id;
  const displayIndex = isActivePlaylist ? currentIndex : -1;
  const displayPlaying = isActivePlaylist ? isPlaying : false;
  const activeQueue = isActivePlaylist ? queue : [];
  const currentSong = isActivePlaylist && activeQueue.length > 0 ? activeQueue[currentIndex] : null;
  const copyTargets = userPlaylists.filter((item) => item._id !== playlist._id);

  return (
    <div className="page-shell">
      <div className="playlist-page-shell">
        <div className="playlist-page-header">
          <div>
            <Link to="/playlists" className="playlist-back-crumb">
              <i className="ri-arrow-left-line"></i>
              Back to playlists
            </Link>
            <h2>{playlist.name}</h2>
            <p>{playlist.description || "No description"} . @{playlist.ownerUsername}</p>
          </div>
          <div className="playlist-page-actions">
            <button className="btn-primary" onClick={() => handlePlayCurrentPlaylist(0)}>
              Play Playlist
            </button>
            <button className="btn-secondary" onClick={() => setShowAddModal(true)}>
              Add Song
            </button>
          </div>
        </div>

        <div className="playlist-hero-card">
          <div className="playlist-cover-art">
            {playlist.coverImage ? (
              <img src={playlist.coverImage} alt={playlist.name} />
            ) : (
              <div className="cover-placeholder">No Cover</div>
            )}
          </div>
          <div className="playlist-hero-copy">
            <span className="playlist-kicker">Playlist Detail</span>
            <h3>{playlist.name}</h3>
            <p>{playlist.description || "This playlist has no description yet."}</p>
            <div className="playlist-hero-meta">
              <span>{localSongs.length} song(s)</span>
              <span>Owner: @{playlist.ownerUsername}</span>
            </div>
          </div>
        </div>

        <div className="currently-playing-section">
          <h3>Currently Playing</h3>
          {currentSong ? (
            <>
              <div className="now-playing-card">
                <div className="album-art">
                  <div className="music-icon">♪</div>
                </div>
                <div className="track-info">
                  <h4>{currentSong.title}</h4>
                  <p>{currentSong.artist}</p>
                  <span className="mood-badge">{currentSong.mood || "unknown"}</span>
                </div>
              </div>
              <div className="playback-controls">
                <button
                  type="button"
                  className="control-btn"
                  onClick={onPrevious}
                  disabled={!isActivePlaylist || activeQueue.length === 0}
                >
                  <i className="ri-skip-back-fill"></i>
                </button>
                <button
                  type="button"
                  className="control-btn play-btn"
                  onClick={onPlayPause}
                  disabled={!isActivePlaylist || activeQueue.length === 0}
                >
                  {displayPlaying ? <i className="ri-pause-fill"></i> : <i className="ri-play-fill"></i>}
                </button>
                <button
                  type="button"
                  className="control-btn"
                  onClick={onNext}
                  disabled={!isActivePlaylist || activeQueue.length === 0}
                >
                  <i className="ri-skip-forward-fill"></i>
                </button>
                <button
                  type="button"
                  className="control-btn stop-btn"
                  onClick={onStop}
                  disabled={!isActivePlaylist || activeQueue.length === 0}
                >
                  <i className="ri-stop-fill"></i>
                </button>
                <button
                  type="button"
                  className={`control-btn ${loopCurrentSong ? "active-loop" : ""}`}
                  onClick={onToggleLoop}
                  disabled={!isActivePlaylist || activeQueue.length === 0}
                  title={loopCurrentSong ? "Loop: On" : "Loop: Off"}
                >
                  <i className="ri-repeat-one-line"></i>
                </button>
              </div>
            </>
          ) : (
            <p className="empty-state">Play this playlist to start listening.</p>
          )}
        </div>

        <QueueList
          title="Playlist Queue"
          songs={displayedSongs}
          currentIndex={displayIndex}
          isPlaying={displayPlaying}
          onPlayFromQueue={handlePlayCurrentPlaylist}
          onRemove={handleRemoveFromPlaylist}
          onDelete={handleDeleteSong}
          onReorder={handleReorder}
          songMenuActions={songMenuActions}
        />

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
