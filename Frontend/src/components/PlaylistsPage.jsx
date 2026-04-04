import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./PlaylistsPage.css";

const API = "http://localhost:3000";

const PlaylistsPage = ({ activeUser, activeDisplayName, authToken }) => {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState(null);
  const [creating, setCreating] = useState(false);

  const authConfig = authToken
    ? {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    : null;

  const loadPlaylists = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/playlists`, {
        params: { username: activeUser, scope: "personal" },
      });
      setPlaylists(response.data.playlists || []);
    } catch (error) {
      console.error("Failed to load playlists:", error);
    }
  }, [activeUser]);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const handleCreatePlaylist = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    if (!authConfig) {
      alert("Please log in again to create playlists.");
      return;
    }

    setCreating(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("ownerDisplayName", activeDisplayName);
      formData.append("isFeatured", "false");
      if (description.trim()) {
        formData.append("description", description.trim());
      }
      if (coverImage) {
        formData.append("cover", coverImage);
      }

      const response = await axios.post(`${API}/playlists`, formData, authConfig);

      setPlaylists((prev) => [response.data.playlist, ...prev]);
      setName("");
      setDescription("");
      setCoverImage(null);
      setShowModal(false);
    } catch (error) {
      console.error("Create playlist error:", error);
      alert(error?.response?.data?.message || "Failed to create playlist");
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePlaylist = async (event, playlistId) => {
    event.stopPropagation();
    if (!authConfig) {
      alert("Please log in again to delete playlists.");
      return;
    }

    const confirmed = window.confirm("Delete this playlist?");
    if (!confirmed) return;

    try {
      await axios.delete(`${API}/playlists/${playlistId}`, authConfig);
      setPlaylists((prev) => prev.filter((playlist) => playlist._id !== playlistId));
    } catch (error) {
      console.error("Delete playlist error:", error);
      alert(error?.response?.data?.message || "Failed to delete playlist");
    }
  };

  return (
    <div className="page-shell">
      <div className="playlists-page">
        <div className="playlists-header">
          <div>
            <h2>My Playlists</h2>
            <p>Open any playlist in its own page to manage songs, playback, and local copying.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            Create Playlist
          </button>
        </div>

        <div className="playlist-grid playlist-grid-listing">
          {playlists.map((playlist) => (
            <div
              className="playlist-card"
              key={playlist._id}
              onClick={() => navigate(`/playlists/${playlist._id}`)}
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
                  <div className="playlist-title">{playlist.name}</div>
                  <p>{playlist.description || "No description"}</p>
                  <span>{playlist.songs?.length || 0} songs</span>
                </div>
                <div className="playlist-actions" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    className="btn-secondary compact-btn"
                    onClick={() => navigate(`/playlists/${playlist._id}`)}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="queue-action delete"
                    onClick={(event) => handleDeletePlaylist(event, playlist._id)}
                    aria-label="Delete playlist"
                    title="Delete playlist"
                  >
                    <i className="ri-delete-bin-6-line"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
          {playlists.length === 0 ? (
            <div className="empty-panel">No personal playlists yet. Create one to start.</div>
          ) : null}
        </div>

        {showModal ? (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <h3>Create Playlist</h3>
              <form onSubmit={handleCreatePlaylist} className="modal-form">
                <label>
                  Name (required)
                  <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
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
                    onChange={(event) => setCoverImage(event.target.files?.[0] || null)}
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
        ) : null}
      </div>
    </div>
  );
};

export default PlaylistsPage;
