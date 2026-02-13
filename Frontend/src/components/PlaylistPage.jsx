import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import QueueList from "./QueueList";
import { analyzeAudioMood, deriveTitleFromFile } from "../utils/audioMood";
import "./PlaylistPage.css";

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

  const loadPlaylist = useCallback(async () => {
    try {
      const response = await axios.get(`http://localhost:3000/playlists/${id}`);
      setPlaylist(response.data.playlist);
    } catch (error) {
      console.error("Failed to load playlist:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  const handlePlayPlaylist = (index = 0) => {
    if (playlist) {
      onPlayPlaylist(playlist, index);
    }
  };

  const handleRemoveFromPlaylist = async ({ queue, currentIndex: nextIndex, song }) => {
    if (!playlist || !song?._id) return;

    // Temporary removal - UI only, doesn't persist to database
    // Will come back on page reload
    const updatedPlaylist = { ...playlist, songs: queue };
    setPlaylist(updatedPlaylist);
    if (activePlaylistId === playlist._id) {
      onUpdateActivePlaylist(updatedPlaylist, nextIndex);
    }
  };

  const handleDeleteSong = async ({ songId }) => {
    if (!playlist || !songId) return;
    const confirmed = window.confirm("Permanently delete this song from this playlist?");
    if (!confirmed) return;

    try {
      // Delete from this playlist only (don't delete the song document)
      await axios.delete(
        `http://localhost:3000/playlists/${playlist._id}/songs/${songId}`
      );

      // Reload from server to ensure correct state
      const response = await axios.get(`http://localhost:3000/playlists/${playlist._id}`);
      const updatedPlaylist = response.data.playlist;
      
      setPlaylist(updatedPlaylist);
      if (activePlaylistId === playlist._id) {
        onUpdateActivePlaylist(updatedPlaylist);
      }
    } catch (error) {
      console.error("Delete song error:", error);
      alert("Failed to delete song");
    }
  };

  const handleReorder = async (nextQueue, nextIndex) => {
    if (!playlist) return;
    
    // Validate that all songs have valid IDs
    const songIds = nextQueue
      .map((song) => song?._id)
      .filter(id => id && typeof id === 'string');

    // Don't proceed if no valid IDs
    if (songIds.length === 0) {
      console.warn("No valid song IDs found for reorder");
      return;
    }

    setPlaylist({ ...playlist, songs: nextQueue });
    if (activePlaylistId === playlist._id) {
      onUpdateActivePlaylist({ ...playlist, songs: nextQueue }, nextIndex);
    }

    try {
      await axios.put(
        `http://localhost:3000/playlists/${playlist._id}/songs/reorder`,
        { songIds }
      );
    } catch (error) {
      console.error("Reorder error:", error);
      // Reload playlist to get correct state from server
      await loadPlaylist();
    }
  };

  const handleAddSong = async (event) => {
    event.preventDefault();
    if (!songFile || !playlist) return;

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
      const response = await axios.post(
        `http://localhost:3000/playlists/${playlist._id}/songs/upload`,
        formData
      );

      const updatedPlaylist = response.data.playlist;
      setPlaylist(updatedPlaylist);
      if (activePlaylistId === playlist._id) {
        onUpdateActivePlaylist(updatedPlaylist);
      }

      setShowAddModal(false);
      setSongTitle("");
      setSongArtist("");
      setSongFile(null);
      setMoodOverride("auto");
    } catch (error) {
      console.error("Add song error:", error);
      alert("Failed to add song");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className="playlist-page">Loading...</div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="page-shell">
        <div className="playlist-page">
          <p>Playlist not found.</p>
          <button className="btn-secondary" onClick={() => navigate("/playlists")}>
            Back to Playlists
          </button>
        </div>
      </div>
    );
  }

  const isActivePlaylist =
    queueSource?.type === "playlist" && queueSource?.playlistId === playlist._id;
  const displayIndex = isActivePlaylist ? currentIndex : -1;
  const displayPlaying = isActivePlaylist ? isPlaying : false;
  const activeQueue = isActivePlaylist ? queue : [];
  const currentSong = isActivePlaylist ? activeQueue[currentIndex] : null;

  return (
    <div className="page-shell">
      <div className="playlist-page">
        <div className="playlist-layout">
          <div className="playlist-left">
            <div className="playlist-hero">
              <div className="playlist-cover">
                {playlist.coverImage ? (
                  <img src={playlist.coverImage} alt={playlist.name} />
                ) : (
                  <div className="cover-placeholder">No Cover</div>
                )}
              </div>
              <div className="playlist-details">
                <h2>{playlist.name}</h2>
                <p>{playlist.description || "No description"}</p>
                <div className="playlist-actions">
                  <button className="btn-primary" onClick={() => handlePlayPlaylist(0)}>
                    Play Playlist
                  </button>
                  <button className="btn-secondary" onClick={() => setShowAddModal(true)}>
                    Add Songs
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="playlist-right">
            <div className="currently-playing-section">
              <h2>Currently Playing</h2>
              {currentSong ? (
                <>
                  <div className="now-playing-card">
                    <div className="album-art">
                      <div className="music-icon">🎵</div>
                    </div>
                    <div className="track-info">
                      <h3>{currentSong.title}</h3>
                      <p>{currentSong.artist}</p>
                      <span className="mood-badge">{currentSong.mood}</span>
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
                      {displayPlaying ? (
                        <i className="ri-pause-fill"></i>
                      ) : (
                        <i className="ri-play-fill"></i>
                      )}
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
                  </div>
                </>
              ) : (
                <p className="empty-state">Play this playlist to start listening.</p>
              )}
            </div>

            <QueueList
              title="Playlist Queue"
              songs={playlist.songs || []}
              currentIndex={displayIndex}
              isPlaying={displayPlaying}
              onPlayFromQueue={handlePlayPlaylist}
              onRemove={handleRemoveFromPlaylist}
              onDelete={handleDeleteSong}
              onReorder={handleReorder}
            />
          </div>
        </div>

        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <h3>Add Song to Playlist</h3>
              <form className="modal-form" onSubmit={handleAddSong}>
                <label>
                  Song Title
                  <input
                    type="text"
                    value={songTitle}
                    onChange={(event) => setSongTitle(event.target.value)}
                  />
                </label>
                <label>
                  Artist
                  <input
                    type="text"
                    value={songArtist}
                    onChange={(event) => setSongArtist(event.target.value)}
                  />
                </label>
                <label>
                  Mood
                  <select
                    value={moodOverride}
                    onChange={(event) => setMoodOverride(event.target.value)}
                  >
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
                    onChange={(event) => setSongFile(event.target.files[0])}
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
        )}
      </div>
    </div>
  );
};

export default PlaylistPage;
