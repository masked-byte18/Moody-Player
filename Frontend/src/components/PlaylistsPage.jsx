import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ensureDummyCollaborationRequests,
  getCollaborationAccessMap,
  getOutgoingRequestsForUser,
  getCollaborationRequests,
  getPlaylistDraftsMap,
  removeOutgoingCollaborationRequest,
  removePlaylistCollaborator,
  savePlaylistDraft,
} from "../utils/collaborationInbox";
import { getDummyPlaylistById } from "../data/discoverDummyData";
import "./PlaylistsPage.css";

const API = "http://localhost:3000";

const PlaylistsPage = ({ activeUser, activeDisplayName, authToken }) => {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState(null);
  const [creating, setCreating] = useState(false);
  const [activeView, setActiveView] = useState("owned");
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const authConfig = authToken
    ? {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    : null;

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      ensureDummyCollaborationRequests(activeUser);
      const response = await axios.get(`${API}/playlists`, {
        params: { username: activeUser, scope: "owned" },
      });
      setPlaylists(response.data.playlists || []);
    } catch (error) {
      console.error("Failed to load playlists:", error);
      setPlaylists([]);
      setLoadError("We couldn't load your playlists right now.");
    } finally {
      setLoading(false);
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

  const handlePublishPlaylist = async (event, playlist) => {
    event.stopPropagation();
    if (!authConfig) {
      alert("Please log in again to publish playlists.");
      return;
    }

    try {
      const response = await axios.put(
        `${API}/playlists/${playlist._id}/publish`,
        { isFeatured: !playlist.isFeatured },
        authConfig
      );
      setPlaylists((current) =>
        current.map((item) => (item._id === playlist._id ? response.data.playlist : item))
      );
    } catch (error) {
      console.error("Publish playlist error:", error);
      alert(error?.response?.data?.message || "Failed to update publish status");
    }
  };

  const openRenameModal = (event, playlist) => {
    event.stopPropagation();
    setRenameTarget(playlist);
    setRenameValue(playlist.name || "");
  };

  const handleRenamePlaylist = async (event) => {
    event.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;

    const nextName = renameValue.trim();
    if (activeView === "collab" || renameTarget.isCollabView) {
      savePlaylistDraft(renameTarget._id, { name: nextName });
      setRenameTarget(null);
      setRenameValue("");
      return;
    }

    setPlaylists((current) =>
      current.map((playlist) => (playlist._id === renameTarget._id ? { ...playlist, name: nextName } : playlist))
    );
    savePlaylistDraft(renameTarget._id, { name: nextName });
    setRenameTarget(null);
    setRenameValue("");
  };

  const handleQuitCollab = (event, playlist) => {
    event.stopPropagation();
    removePlaylistCollaborator(playlist._id, activeUser);
  };

  const handleRemovePendingCollab = (event, playlist) => {
    event.stopPropagation();
    removeOutgoingCollaborationRequest(playlist._id, activeUser);
  };

  const accessMap = getCollaborationAccessMap();
  const requests = getCollaborationRequests();
  const outgoingRequests = getOutgoingRequestsForUser(activeUser);
  const drafts = getPlaylistDraftsMap();

  const demoOwnedDrafts = Object.values(drafts).filter(
    (draft) => draft.ownerUsername === activeUser && !playlists.some((playlist) => playlist._id === draft._id)
  );
  const ownedPlaylists = [...demoOwnedDrafts, ...playlists];
  const managedPlaylists = ownedPlaylists.filter((playlist) => (accessMap[playlist._id] || []).length > 0);
  const acceptedCollabPlaylists = Object.entries(accessMap)
    .filter(([, usernames]) => usernames.includes(activeUser))
    .map(([playlistId]) => {
      const ownedMatch = ownedPlaylists.find((playlist) => playlist._id === playlistId);
      if (ownedMatch && ownedMatch.ownerUsername !== activeUser) return ownedMatch;
      if (ownedMatch && ownedMatch.ownerUsername === activeUser) return null;

      const requestMatch = requests.find((request) => request.playlistId === playlistId && request.status === "accepted");
      const dummyMatch = getDummyPlaylistById(playlistId);
      const draft = drafts[playlistId] || {};
      const source = dummyMatch || requestMatch || {};
      if (!source || (source.ownerUsername || "") === activeUser) return null;

      return {
        _id: playlistId,
        name: draft.name || source.name || source.playlistName || "Shared Playlist",
        description: draft.description || source.description || "Playlist you're contributing to.",
        coverImage: draft.coverImage || source.coverImage || "",
        ownerUsername: source.ownerUsername || "",
        ownerDisplayName: source.ownerDisplayName || source.ownerUsername || "",
        isFeatured: Boolean(source.isFeatured),
        songs: draft.songs || source.songs || [],
        isCollabView: true,
      };
    })
    .filter(Boolean);
  const pendingCollabPlaylists = outgoingRequests
    .filter((request) => request.status === "pending")
    .map((request) => {
      const dummyMatch = getDummyPlaylistById(request.playlistId);
      const draft = drafts[request.playlistId] || {};
      return {
        _id: request.playlistId,
        name: draft.name || request.playlistName || dummyMatch?.name || "Requested Playlist",
        description: draft.description || dummyMatch?.description || "Waiting for the owner to accept your contribution request.",
        coverImage: draft.coverImage || dummyMatch?.coverImage || "",
        ownerUsername: request.ownerUsername || dummyMatch?.ownerUsername || "",
        ownerDisplayName: request.ownerDisplayName || dummyMatch?.ownerDisplayName || "",
        isFeatured: Boolean(dummyMatch?.isFeatured),
        songs: draft.songs || dummyMatch?.songs || [],
        isCollabView: true,
        collabStatus: "pending",
      };
    });
  const collabPlaylists = [...acceptedCollabPlaylists, ...pendingCollabPlaylists].filter(
    (playlist, index, array) => array.findIndex((item) => item._id === playlist._id) === index
  );

  const visiblePlaylists =
    activeView === "collab" ? collabPlaylists : activeView === "managed" ? managedPlaylists : ownedPlaylists;

  return (
    <div className="page-shell">
      <div className="playlists-page">
        <div className="playlists-header">
          <div>
            <h2>My Library</h2>
            <p>Switch between your own library, collab work, and playlists you manage with contributors.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            Create Playlist
          </button>
        </div>

        <div className="library-filter-row">
          <button
            type="button"
            className={activeView === "owned" ? "active" : ""}
            onClick={() => setActiveView("owned")}
          >
            Playlists
          </button>
          <button
            type="button"
            className={activeView === "collab" ? "active" : ""}
            onClick={() => setActiveView("collab")}
          >
            Collabs
          </button>
          <button
            type="button"
            className={activeView === "managed" ? "active" : ""}
            onClick={() => setActiveView("managed")}
          >
            Managed
          </button>
        </div>

        <div className="playlist-grid playlist-grid-listing">
          {loading ? <div className="empty-panel">Loading your playlists...</div> : null}
          {!loading && loadError ? <div className="empty-panel">{loadError}</div> : null}
          {!loading && !loadError && activeUser === "guest" ? (
            <div className="empty-panel">
              Log in to create personal playlists and manage your songs here.
            </div>
          ) : null}
          {visiblePlaylists.map((playlist) => (
            <div
              className="playlist-card"
              key={playlist._id}
              onClick={() =>
                navigate(`/playlists/${playlist._id}`, {
                  state: playlist.isCollabView
                    ? {
                        source: "discover",
                        ownerUsername: playlist.ownerUsername,
                        ownerDisplayName: playlist.ownerDisplayName,
                        playlistData: playlist,
                      }
                    : undefined,
                })
              }
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
                  <div className="playlist-meta-line">
                    <span>{playlist.songs?.length || 0} songs</span>
                    {activeView === "collab" ? (
                      <span className="featured-chip">@{playlist.ownerUsername}</span>
                    ) : null}
                    {playlist.collabStatus === "pending" ? <span className="featured-chip">Requested</span> : null}
                    {playlist.isFeatured ? <span className="featured-chip">Published</span> : null}
                    {activeView === "managed" ? (
                      <span className="featured-chip">{(accessMap[playlist._id] || []).length} contributors</span>
                    ) : null}
                  </div>
                </div>
                <div className="playlist-actions" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    className="queue-action"
                    onClick={() =>
                      navigate(`/playlists/${playlist._id}`, {
                        state: playlist.isCollabView
                          ? {
                              source: "discover",
                              ownerUsername: playlist.ownerUsername,
                              ownerDisplayName: playlist.ownerDisplayName,
                              playlistData: playlist,
                            }
                          : undefined,
                      })
                    }
                    aria-label="Open playlist"
                    title="Open playlist"
                  >
                    <i className="ri-arrow-right-up-line"></i>
                  </button>
                  {activeView !== "collab" ? (
                    <button
                      type="button"
                      className="queue-action"
                      onClick={(event) => openRenameModal(event, playlist)}
                      aria-label="Rename playlist"
                      title="Rename playlist"
                    >
                      <i className="ri-pencil-line"></i>
                    </button>
                  ) : null}
                  {activeView !== "collab" ? (
                    <button
                      type="button"
                      className={`queue-action ${playlist.isFeatured ? "is-published" : ""}`}
                      onClick={(event) => handlePublishPlaylist(event, playlist)}
                      aria-label={playlist.isFeatured ? "Unpublish playlist" : "Publish playlist"}
                      title={playlist.isFeatured ? "Unpublish playlist" : "Publish playlist"}
                    >
                      <i
                        className={
                          activeView === "managed"
                            ? playlist.isFeatured
                              ? "ri-eye-off-line"
                              : "ri-compass-discover-line"
                            : playlist.isFeatured
                              ? "ri-eye-off-line"
                              : "ri-broadcast-line"
                        }
                      ></i>
                    </button>
                  ) : null}
                  {activeView === "managed" && playlist.isFeatured ? (
                    <button
                      type="button"
                      className="queue-action delete"
                      onClick={(event) => handlePublishPlaylist(event, playlist)}
                      aria-label="Remove from discover"
                      title="Remove from discover"
                    >
                      <i className="ri-close-circle-line"></i>
                    </button>
                  ) : null}
                  {activeView !== "collab" ? (
                    <button
                      type="button"
                      className="queue-action delete"
                      onClick={(event) => handleDeletePlaylist(event, playlist._id)}
                      aria-label="Delete playlist"
                      title="Delete playlist"
                    >
                      <i className="ri-delete-bin-6-line"></i>
                    </button>
                  ) : null}
                  {activeView === "collab" ? (
                    <>
                      <button
                        type="button"
                        className="queue-action"
                        onClick={(event) => openRenameModal(event, playlist)}
                        aria-label="Rename locally"
                        title="Rename locally"
                      >
                        <i className="ri-pencil-line"></i>
                      </button>
                      {playlist.collabStatus === "pending" ? (
                        <button
                          type="button"
                          className="queue-action delete"
                          onClick={(event) => handleRemovePendingCollab(event, playlist)}
                          aria-label="Remove request"
                          title="Remove request"
                        >
                          <i className="ri-close-circle-line"></i>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="queue-action delete"
                          onClick={(event) => handleQuitCollab(event, playlist)}
                          aria-label="Quit contribution"
                          title="Quit contribution"
                        >
                          <i className="ri-logout-circle-r-line"></i>
                        </button>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {!loading && !loadError && visiblePlaylists.length === 0 && activeUser !== "guest" ? (
            <div className="empty-panel">
              {activeView === "collab"
                ? "No collab playlists yet."
                : activeView === "managed"
                  ? "No contributor-managed playlists yet."
                  : "No personal playlists yet. Create one to start."}
            </div>
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

        {renameTarget ? (
          <div className="modal-overlay" onClick={() => setRenameTarget(null)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <h3>{activeView === "collab" ? "Rename Playlist Locally" : "Rename Playlist"}</h3>
              <form onSubmit={handleRenamePlaylist} className="modal-form">
                <label>
                  Playlist Name
                  <input type="text" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} required />
                </label>
                {activeView === "collab" ? (
                  <p className="copy-song-description">This rename only affects your local collab library view.</p>
                ) : null}
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setRenameTarget(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Save
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
