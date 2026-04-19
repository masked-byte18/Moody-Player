import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  getPlaylistDraftsMap,
  savePlaylistDraft,
} from "../utils/collaborationInbox";
import "./PlaylistsPage.css";

const API = "http://localhost:3000";

const getRequestPlaylistId = (request) => {
  if (typeof request?.playlist === "string") return request.playlist;
  if (request?.playlist?._id) return String(request.playlist._id);
  if (request?.playlistId) return String(request.playlistId);
  return "";
};

const PlaylistsPage = ({ activeUser, activeDisplayName, authToken }) => {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState([]);
  const [managedPlaylists, setManagedPlaylists] = useState([]);
  const [acceptedCollabPlaylists, setAcceptedCollabPlaylists] = useState([]);
  const [pendingCollabPlaylists, setPendingCollabPlaylists] = useState([]);
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

  const authConfig = useMemo(
    () =>
      authToken
        ? {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        : null,
    [authToken]
  );

  const loadPlaylists = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setLoadError("");
    try {
      if (!authConfig || !activeUser || activeUser === "guest") {
        setPlaylists([]);
        setManagedPlaylists([]);
        setAcceptedCollabPlaylists([]);
        setPendingCollabPlaylists([]);
        return;
      }

      const [ownedResponse, managedResponse, collabResponse, outgoingResponse] = await Promise.all([
        axios.get(`${API}/playlists`, {
          params: { username: activeUser, scope: "owned" },
          ...authConfig,
        }),
        axios.get(`${API}/playlists/managed`, authConfig),
        axios.get(`${API}/playlists/collab`, authConfig),
        axios.get(`${API}/collab/requests/outgoing`, authConfig),
      ]);

      const owned = ownedResponse.data.playlists || [];
      const managed = managedResponse.data.playlists || [];
      const accepted = collabResponse.data.playlists || [];
      const outgoingRequests = outgoingResponse.data.requests || [];

      const acceptedIds = new Set(accepted.map((playlist) => String(playlist._id)));
      const pendingRequests = outgoingRequests.filter(
        (request) => request.status === "pending" && !acceptedIds.has(getRequestPlaylistId(request))
      );

      const pendingPlaylists = await Promise.all(
        pendingRequests.map(async (request) => {
          const playlistId = getRequestPlaylistId(request);
          let playlistData = null;

          if (playlistId) {
            try {
              const playlistResponse = await axios.get(`${API}/playlists/${playlistId}`, authConfig);
              playlistData = playlistResponse.data?.playlist || null;
            } catch {
              playlistData = null;
            }
          }

          return {
            _id: playlistId || request._id,
            requestId: request._id || request.id,
            name: playlistData?.name || request.playlistName || "Requested Playlist",
            description:
              playlistData?.description ||
              "Waiting for the owner to accept your contribution request.",
            coverImage: playlistData?.coverImage || "",
            ownerUsername: playlistData?.ownerUsername || request.ownerUsername || "",
            ownerDisplayName: playlistData?.ownerDisplayName || request.ownerDisplayName || "",
            isFeatured: Boolean(playlistData?.isFeatured),
            songs: playlistData?.songs || [],
            isCollabView: true,
            collabStatus: "pending",
          };
        })
      );

      setPlaylists(owned);
      setManagedPlaylists(managed);
      setAcceptedCollabPlaylists(accepted.map((playlist) => ({ ...playlist, isCollabView: true })));
      setPendingCollabPlaylists(pendingPlaylists);
    } catch (error) {
      console.error("Failed to load playlists:", error);
      setPlaylists([]);
      setManagedPlaylists([]);
      setAcceptedCollabPlaylists([]);
      setPendingCollabPlaylists([]);
      setLoadError("We couldn't load your playlists right now.");
    } finally {
      setLoading(false);
    }
  }, [activeUser, authConfig]);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  useEffect(() => {
    if (!authConfig || !activeUser || activeUser === "guest") return undefined;

    const intervalId = window.setInterval(() => {
      loadPlaylists(true);
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [activeUser, authConfig, loadPlaylists]);

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
      setManagedPlaylists((prev) => prev.filter((playlist) => playlist._id !== playlistId));
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
      await loadPlaylists();
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

  const handleQuitCollab = (event) => {
    event.stopPropagation();
    alert("Quit collaboration from UI is currently owner-managed. Ask owner to remove contributor.");
  };

  const handleRemovePendingCollab = async (event, playlist) => {
    event.stopPropagation();
    if (!authConfig || !playlist?.requestId) return;

    const confirmed = window.confirm("Withdraw this pending contribution request?");
    if (!confirmed) return;

    try {
      await axios.delete(`${API}/collab/requests/${playlist.requestId}/cancel`, authConfig);
      await loadPlaylists();
    } catch (error) {
      console.error("Pending request withdraw error:", error);
      alert(error?.response?.data?.message || "Failed to withdraw request.");
    }
  };

  const drafts = getPlaylistDraftsMap();

  const demoOwnedDrafts = Object.values(drafts).filter(
    (draft) => draft.ownerUsername === activeUser && !playlists.some((playlist) => playlist._id === draft._id)
  );
  const ownedPlaylists = [...demoOwnedDrafts, ...playlists];
  const collabPlaylists = [...acceptedCollabPlaylists, ...pendingCollabPlaylists].filter(
    (playlist, index, array) => array.findIndex((item) => item._id === playlist._id) === index
  );

  const managedWithDrafts = managedPlaylists.map((playlist) => {
    const draft = drafts[playlist._id] || {};
    return {
      ...playlist,
      ...draft,
      songs: draft.songs || playlist.songs || [],
    };
  });

  const collabWithDrafts = collabPlaylists.map((playlist) => {
    const draft = drafts[playlist._id] || {};
    return {
      ...playlist,
      ...draft,
      songs: draft.songs || playlist.songs || [],
    };
  });

  const visiblePlaylists =
    activeView === "collab" ? collabWithDrafts : activeView === "managed" ? managedWithDrafts : ownedPlaylists;

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
          {loading && playlists.length === 0 && managedPlaylists.length === 0 && acceptedCollabPlaylists.length === 0 ? <div className="empty-panel">Loading your playlists...</div> : null}
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
              onClick={() => {
                if (playlist.collabStatus === "pending") return;
                navigate(`/playlists/${playlist._id}`, {
                  state: playlist.isCollabView
                    ? {
                        source: "discover",
                        ownerUsername: playlist.ownerUsername,
                        ownerDisplayName: playlist.ownerDisplayName,
                        playlistData: playlist,
                      }
                    : undefined,
                });
              }}
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
                    {playlist.collabStatus === "pending" ? (
                      <button
                        type="button"
                        className="featured-chip featured-chip-pending-button"
                        onClick={(event) => handleRemovePendingCollab(event, playlist)}
                        title="Click to withdraw this pending request"
                      >
                        Pending
                      </button>
                    ) : null}
                    {playlist.isFeatured ? <span className="featured-chip">Published</span> : null}
                    {activeView === "managed" ? (
                      <span className="featured-chip">{(playlist.contributors || []).length} contributors</span>
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
                        <span className="queue-action" title="Pending request is shown in badge">
                          <i className="ri-time-line"></i>
                        </span>
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
