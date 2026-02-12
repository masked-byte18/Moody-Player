import React, { useEffect, useState } from "react";
import axios from "axios";
import QueueList from "./QueueList";
import { analyzeAudioMood, deriveTitleFromFile } from "../utils/audioMood";
import "./PlaylistsPage.css";

const PlaylistsPage = ({
  queue,
  queueSource,
  isPlaying,
  currentIndex,
  activePlaylistId,
  onPlayPlaylist,
  onPlayPause,
  onNext,
  onPrevious,
  onStop,
  onUpdateActivePlaylist,
  loopCurrentSong = false,
  onToggleLoop,
}) => {
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState(null);
  const [creating, setCreating] = useState(false);
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songFile, setSongFile] = useState(null);
  const [moodOverride, setMoodOverride] = useState("auto");
  const [uploadingSong, setUploadingSong] = useState(false);

  const loadPlaylists = async () => {
    try {
      const response = await axios.get("http://localhost:3000/playlists");
      setPlaylists(response.data.playlists || []);
    } catch (error) {
      console.error("Failed to load playlists:", error);
    }
  };

  const loadSelectedPlaylist = async (playlistId) => {
    try {
      const response = await axios.get(`http://localhost:3000/playlists/${playlistId}`);
      setSelectedPlaylist(response.data.playlist);
    } catch (error) {
      console.error("Failed to load playlist details:", error);
    }
  };

  useEffect(() => {
    loadPlaylists();
  }, []);

  useEffect(() => {
    if (activePlaylistId) {
      loadSelectedPlaylist(activePlaylistId);
    }
  }, [activePlaylistId]);

  const handleCreatePlaylist = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      if (description.trim()) {
        formData.append("description", description.trim());
      }
      if (coverImage) {
        formData.append("cover", coverImage);
      }

      const response = await axios.post(
        "http://localhost:3000/playlists",
        formData
      );

      setPlaylists((prev) => [...prev, response.data.playlist]);
      setName("");
      setDescription("");
      setCoverImage(null);
      setShowModal(false);
    } catch (error) {
      console.error("Create playlist error:", error);
      alert("Failed to create playlist");
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePlaylist = async (playlistId) => {
    const confirmed = window.confirm("Delete this playlist?");
    if (!confirmed) return;

    try {
      await axios.delete(`http://localhost:3000/playlists/${playlistId}`);
      setPlaylists((prev) => prev.filter((playlist) => playlist._id !== playlistId));
    } catch (error) {
      console.error("Delete playlist error:", error);
      alert("Failed to delete playlist");
    }
  };

  const openAddSongModal = () => {
    setShowAddSongModal(true);
  };

  const handleSelectPlaylist = async (playlist) => {
    setSelectedPlaylist(playlist);
    try {
      const response = await axios.get(`http://localhost:3000/playlists/${playlist._id}`);
      setSelectedPlaylist(response.data.playlist);
    } catch (error) {
      console.error("Failed to load playlist details:", error);
    }
  };

  const handlePlayPlaylist = (index = 0) => {
    if (selectedPlaylist) {
      onPlayPlaylist(selectedPlaylist, index);
    }
  };

  const handleAddSongToPlaylist = async (event) => {
    event.preventDefault();
    if (!selectedPlaylist || !songFile) return;

    setUploadingSong(true);

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
        `http://localhost:3000/playlists/${selectedPlaylist._id}/songs/upload`,
        formData
      );

      const updatedPlaylist = response.data.playlist;
      setSelectedPlaylist(updatedPlaylist);
      setPlaylists((prev) =>
        prev.map((playlist) =>
          playlist._id === selectedPlaylist._id
            ? updatedPlaylist
            : playlist
        )
      );

      if (activePlaylistId === selectedPlaylist._id) {
        onUpdateActivePlaylist(updatedPlaylist);
      }

      setShowAddSongModal(false);
      setSongTitle("");
      setSongArtist("");
      setSongFile(null);
      setMoodOverride("auto");
    } catch (error) {
      console.error("Add song error:", error);
      alert("Failed to add song");
    } finally {
      setUploadingSong(false);
    }
  };

  const closeAddSongModal = () => {
    setShowAddSongModal(false);
    setSongTitle("");
    setSongArtist("");
    setSongFile(null);
    setMoodOverride("auto");
  };

  const handleRemoveFromPlaylist = async ({ queue, currentIndex: nextIndex, song }) => {
    if (!selectedPlaylist || !song?._id) return;

    try {
      await axios.delete(
        `http://localhost:3000/playlists/${selectedPlaylist._id}/songs/${song._id}`
      );

      const updatedPlaylist = { ...selectedPlaylist, songs: queue };
      setSelectedPlaylist(updatedPlaylist);
      setPlaylists((prev) =>
        prev.map((playlist) =>
          playlist._id === selectedPlaylist._id
            ? updatedPlaylist
            : playlist
        )
      );

      if (activePlaylistId === selectedPlaylist._id) {
        onUpdateActivePlaylist(updatedPlaylist, nextIndex);
      }
    } catch (error) {
      console.error("Remove song error:", error);
      alert("Failed to remove song from playlist");
    }
  };

  const handleDeleteSong = async ({ songId }) => {
    if (!selectedPlaylist || !songId) return;
    const confirmed = window.confirm("Delete this song permanently?");
    if (!confirmed) return;

    try {
      await axios.delete(
        `http://localhost:3000/playlists/${selectedPlaylist._id}/songs/${songId}?delete=true`
      );

      const nextQueue = selectedPlaylist.songs.filter((item) => item._id !== songId);
      const updatedPlaylist = { ...selectedPlaylist, songs: nextQueue };
      setSelectedPlaylist(updatedPlaylist);
      setPlaylists((prev) =>
        prev.map((playlist) =>
          playlist._id === selectedPlaylist._id
            ? updatedPlaylist
            : playlist
        )
      );

      if (activePlaylistId === selectedPlaylist._id) {
        onUpdateActivePlaylist(updatedPlaylist);
      }
    } catch (error) {
      console.error("Delete song error:", error);
      alert("Failed to delete song");
    }
  };

  const handleReorder = async (nextQueue, nextIndex) => {
    if (!selectedPlaylist) return;
    const songIds = nextQueue.map((song) => song._id).filter(Boolean);

    const updatedPlaylist = { ...selectedPlaylist, songs: nextQueue };
    setSelectedPlaylist(updatedPlaylist);
    setPlaylists((prev) =>
      prev.map((playlist) =>
        playlist._id === selectedPlaylist._id
          ? updatedPlaylist
          : playlist
      )
    );

    if (activePlaylistId === selectedPlaylist._id) {
      onUpdateActivePlaylist(updatedPlaylist, nextIndex);
    }

    try {
      await axios.put(
        `http://localhost:3000/playlists/${selectedPlaylist._id}/songs/reorder`,
        { songIds }
      );
    } catch (error) {
      console.error("Reorder error:", error);
    }
  };

  const isActivePlaylist =
    queueSource?.type === "playlist" && queueSource?.playlistId === selectedPlaylist?._id;
  const displayIndex = isActivePlaylist ? currentIndex : -1;
  const displayPlaying = isActivePlaylist ? isPlaying : false;
  const activeQueue = isActivePlaylist ? queue : [];
  const currentSong = isActivePlaylist && activeQueue.length > 0 ? activeQueue[currentIndex] : null;

  return (
    <div className="page-shell">
      <div className="playlists-split-page">
        <div className="playlists-left-half">
          <div className="playlists-header">
            <div>
              <h2>Playlists</h2>
              <p>Build playlists and organize songs by mood.</p>
            </div>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              Create Playlist
            </button>
          </div>

          <div className="playlist-grid">
            {playlists.map((playlist) => (
              <div
                className={`playlist-card ${selectedPlaylist?._id === playlist._id ? 'selected' : ''}`}
                key={playlist._id}
                onClick={() => handleSelectPlaylist(playlist)}
              >
                <div className="playlist-cover">
                  {playlist.coverImage ? (
                    <img src={playlist.coverImage} alt={playlist.name} />
                  ) : (
                    <div className="cover-placeholder">No Cover</div>
                  )}
                </div>
                <div className="playlist-body">
                  <div className="playlist-info">
                    <div className="playlist-title">
                      {playlist.name}
                    </div>
                    <p>{playlist.description || "No description"}</p>
                    <span>{playlist.songs?.length || 0} songs</span>
                  </div>
                  <div className="playlist-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="queue-action delete"
                      onClick={() => handleDeletePlaylist(playlist._id)}
                      aria-label="Delete playlist"
                      title="Delete playlist"
                    >
                      <i className="ri-delete-bin-6-line"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {playlists.length === 0 && (
              <div className="empty-panel">No playlists yet. Create one to start.</div>
            )}
          </div>
        </div>

        <div className="playlists-right-half">
          {selectedPlaylist ? (
            <>
              <div className="playlists-header">
                <div>
                  <h2>{selectedPlaylist.name}</h2>
                  <p>{selectedPlaylist.description || "No description"}</p>
                </div>
                <div className="playlist-viewer-actions">
                  <button className="btn-primary" onClick={() => handlePlayPlaylist(0)}>
                    Play Playlist
                  </button>
                  <button className="btn-secondary" onClick={() => openAddSongModal()}>
                    Add Songs
                  </button>
                </div>
              </div>

              <div className="currently-playing-section">
                <h3>Currently Playing</h3>
                {currentSong ? (
                  <>
                    <div className="now-playing-card">
                      <div className="album-art">
                        <div className="music-icon">🎵</div>
                      </div>
                      <div className="track-info">
                        <h4>{currentSong.title}</h4>
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
                      <button
                        type="button"
                        className={`control-btn ${loopCurrentSong ? 'active-loop' : ''}`}
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
                songs={selectedPlaylist.songs || []}
                currentIndex={displayIndex}
                isPlaying={displayPlaying}
                onPlayFromQueue={handlePlayPlaylist}
                onRemove={handleRemoveFromPlaylist}
                onDelete={handleDeleteSong}
                onReorder={handleReorder}
              />
            </>
          ) : (
            <div className="no-playlist-selected">
              <div className="music-icon-large">🎵</div>
              <h3>No Playlist Selected</h3>
              <p>Select a playlist from the left to view its queue.</p>
            </div>
          )}
        </div>

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <h3>Create Playlist</h3>
              <form onSubmit={handleCreatePlaylist} className="modal-form">
                <label>
                  Name (required)
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Description
                  <textarea
                    rows="3"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
                <label>
                  Cover Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setCoverImage(event.target.files[0])}
                  />
                </label>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={creating}>
                    {creating ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showAddSongModal && selectedPlaylist && (
          <div className="modal-overlay" onClick={closeAddSongModal}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <h3>Add Song to {selectedPlaylist.name}</h3>
              <form className="modal-form" onSubmit={handleAddSongToPlaylist}>
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
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closeAddSongModal}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={uploadingSong}>
                    {uploadingSong ? "Uploading..." : "Add Song"}
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

export default PlaylistsPage;
