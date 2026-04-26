import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { analyzeAudioMood, deriveTitleFromFile } from "../utils/audioMood";
import "./PlaylistPage.css";
import "./PlaylistsPage.css";

import API from "../config/api";

const normalizeMood = (mood) => (mood || "unknown").toLowerCase();
const normalizeUsername = (value) => (value || "").trim().toLowerCase();
const isDatabaseObjectId = (value) => /^[0-9a-fA-F]{24}$/.test(String(value || ""));

const createRandomOrder = (songs) => {
  const nextSongs = [...songs];
  for (let index = nextSongs.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextSongs[index], nextSongs[swapIndex]] = [nextSongs[swapIndex], nextSongs[index]];
  }
  return nextSongs;
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
  activeDisplayName,
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
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [contributeMessage, setContributeMessage] = useState("");
  const [pendingRequest, setPendingRequest] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("");
  const [pendingDeleteSongId, setPendingDeleteSongId] = useState(null);
  const [showLeaveCollabConfirm, setShowLeaveCollabConfirm] = useState(false);

  const authConfig = useMemo(() => (authToken
    ? {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    : null), [authToken]);

  const loadPlaylist = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const response = await axios.get(`${API}/playlists/${id}`);
      const apiPlaylist = response.data.playlist;
      setPlaylist(apiPlaylist);
      setLocalSongs(apiPlaylist?.songs || []);
    } catch (error) {
      console.error("Failed to load playlist:", error);
      setPlaylist((prevPlaylist) => {
        if (prevPlaylist) {
          return prevPlaylist; // keep current state on background error
        }
        setLocalSongs([]);
        return null;
      });
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [id]);

  const loadUserPlaylists = useCallback(async () => {
    if (!activeUser || activeUser === "guest") {
      setUserPlaylists([]);
      return;
    }

    try {
      const response = await axios.get(`${API}/playlists`, {
        params: { username: activeUser, scope: "owned" },
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
    if (!playlist || String(id).startsWith("local-")) return;

    const intervalId = window.setInterval(() => {
      loadPlaylist(true);
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [id, loadPlaylist, playlist]);

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

  useEffect(() => {
    if (!playlist || !activeUser || activeUser === "guest" || !authConfig) {
      setPendingRequest(false);
      return;
    }

    const checkPending = async () => {
      try {
        const response = await axios.get(`${API}/collab/requests/outgoing`, authConfig);
        const outgoing = response.data?.requests || [];
        const hasPending = outgoing.some(
          (r) => (r.playlist === playlist._id || r.playlist?._id === playlist._id) && r.status === "pending"
        );
        setPendingRequest(hasPending);
      } catch {
        setPendingRequest(false);
      }
    };
    checkPending();
  }, [activeUser, playlist, authConfig]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => { setToastMessage(""); setToastType(""); }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const handleCollaborationUpdate = async () => {
      await loadPlaylist();
    };

    window.addEventListener("moody-collaboration-updated", handleCollaborationUpdate);
    return () => window.removeEventListener("moody-collaboration-updated", handleCollaborationUpdate);
  }, [loadPlaylist]);

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

  const recordContribution = async (type, text) => {
    if (!playlist || !activeUser || activeUser === "guest" || isOwner || !isCollaborator) return;
    try {
      await axios.post(`${API}/playlists/${playlist._id}/activity`, {
        actorUsername: activeUser,
        actorDisplayName: activeDisplayName || activeUser,
        playlistId: playlist._id,
        playlistName: playlist.name,
        type,
        text,
      }, authConfig);
    } catch (err) {
      console.error("Failed to log activity", err);
    }
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

  const openContributionAnalytics = () => {
    navigate(`/playlists/${playlist?._id}/activity`, {
      state: {
        playlistName: playlist?.name,
      },
    });
  };

  const handleShufflePlay = () => {
    if (!localSongs.length) return;
    playSongs(createRandomOrder(localSongs), 0);
  };

  const handleTemporaryRemove = async (index) => {
    if (!playlist) return;

    const removedSong = localSongs[index];

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
    if (removedSong) {
      setToastMessage(`Temporarily removed "${removedSong.title}". Refresh the page to restore it.`);
      setToastType("success");
      recordContribution("remove_song", `removed "${removedSong.title}" from the active playlist view.`);
    }
  };

  const handleReorder = async (nextSongs, nextIndex) => {
    if (!playlist) return;

    syncPlaylistSongs(nextSongs, nextIndex);
    const canPersistCollaborativeEdit = Boolean(authConfig && isDatabaseObjectId(playlist._id));
    if (!canPersistCollaborativeEdit) {
      recordContribution("reorder", "reordered the songs inside this playlist.");
      return;
    }

    try {
      await axios.put(
        `${API}/playlists/${playlist._id}/songs/reorder`,
        {
          songIds: nextSongs.map((song) => song?._id).filter(Boolean),
        },
        authConfig
      );
      // Note: We deliberately skip a second syncPlaylistSongs here to prevent screen flickering. 
      // The optimistic update above already correctly positioned the songs.
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

  const handleDeleteSong = (songId) => {
    if (!playlist || !songId) return;
    setPendingDeleteSongId(songId);
  };

  const confirmDeleteSong = async () => {
    const songId = pendingDeleteSongId;
    setPendingDeleteSongId(null);
    if (!playlist || !songId) return;

    const canPersistCollaborativeEdit = Boolean(authConfig && isDatabaseObjectId(playlist._id));
    if (!canPersistCollaborativeEdit) {
      const songToDelete = localSongs.find((song) => song._id === songId);
      const nextSongs = localSongs.filter((song) => song._id !== songId);
      syncPlaylistSongs(nextSongs, currentIndex >= nextSongs.length ? 0 : currentIndex);
      if (songToDelete) {
        recordContribution("delete_song", `deleted "${songToDelete.title}" from the playlist.`);
      }
      return;
    }

    try {
      await axios.delete(`${API}/playlists/${playlist._id}/songs/${songId}?delete=true`, authConfig);
      const nextSongs = localSongs.filter((song) => song._id !== songId);
      let nextIndex = currentIndex;
      if (!nextSongs.length) nextIndex = 0;
      syncPlaylistSongs(nextSongs, nextIndex);
      setToastMessage("Song deleted successfully.");
      setToastType("success");
      await loadPlaylist();
    } catch (error) {
      console.error("Delete song error:", error);
      setToastMessage(error?.response?.data?.message || "Failed to delete song");
      setToastType("error");
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

    try {
      const canPersistCollaborativeEdit = Boolean(authConfig && isDatabaseObjectId(playlist._id));
      if (!canPersistCollaborativeEdit) {
        const existingName = localSongs.some(
          (song) => (song.title || "").trim().toLowerCase() === resolvedTitle.trim().toLowerCase()
        );
        const existingFile = localSongs.some(
          (song) =>
            song.fileName &&
            song.fileName.trim().toLowerCase() === (songFile.name || "").trim().toLowerCase()
        );

        if (existingName || existingFile) {
          setToastMessage("Same song name or same file already exists in this collaborative playlist.");
          setToastType("error");
          return;
        }

        const nextSong = {
          _id: `local-song-${Date.now()}`,
          title: resolvedTitle,
          artist: resolvedArtist,
          mood: resolvedMood,
          fileName: songFile.name || "",
          addedByUsername: activeUser,
          addedByDisplayName: activeDisplayName || activeUser,
        };
        syncPlaylistSongs([...localSongs, nextSong], currentIndex);
        recordContribution("add_song", `added "${resolvedTitle}".`);
      } else {
        const formData = new FormData();
        formData.append("audio", songFile);
        formData.append("title", resolvedTitle);
        formData.append("artist", resolvedArtist);
        formData.append("mood", resolvedMood);

        const response = await axios.post(`${API}/playlists/${playlist._id}/songs/upload`, formData, authConfig);
        syncPlaylistSongs(response.data.playlist?.songs || [], currentIndex);
      }

      setShowAddModal(false);
      resetAddSongForm();
    } catch (error) {
      console.error("Add song error:", error);
      const message = error?.response?.data?.message || "Failed to add song";
      if (error?.response?.status === 409) {
        setToastMessage(`${message}. Same song name or same audio file already exists in the database.`);
      } else {
        setToastMessage(message);
      }
      setToastType("error");
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
      setToastMessage("Please log in again to copy songs.");
      setToastType("error");
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
        setToastMessage("That song is already in the selected playlist.");
        setToastType("error");
      } else {
        setToastMessage("Song copied to the selected playlist.");
        setToastType("success");
      }

      setShowCopyModal(false);
      setCopyTargetSong(null);
      await loadUserPlaylists();
    } catch (error) {
      console.error("Copy song error:", error);
      setToastMessage(error?.response?.data?.message || "Failed to copy song");
      setToastType("error");
    } finally {
      setCopyingSong(false);
    }
  };

  const handleSubmitContributionRequest = async () => {
    if (!playlist) return;
    if (!activeUser || activeUser === "guest" || !authConfig) {
      setToastMessage("Please log in to send a contribution request.");
      setToastType("error");
      return;
    }

    if (isOwner || isCollaborator) {
      setShowContributeModal(false);
      return;
    }

    if (pendingRequest) {
      setToastMessage("You already sent a collaboration request for this playlist.");
      setToastType("error");
      return;
    }

    try {
      await axios.post(
        `${API}/playlists/${playlist._id}/collab/request`,
        { message: contributeMessage },
        authConfig
      );
      setPendingRequest(true);
      setShowContributeModal(false);
      setContributeMessage("");
      setToastMessage("Contribution request sent to the playlist owner.");
      setToastType("success");
    } catch (error) {
      console.error("Contribution request error:", error);
      setToastMessage(error?.response?.data?.message || "Failed to send request.");
      setToastType("error");
    }
  };

  const handleContributeButtonClick = () => {
    if (!playlist || isOwner) return;

    if (isCollaborator) {
      setShowLeaveCollabConfirm(true);
      return;
    }

    if (pendingRequest) {
      return;
    }

    setShowContributeModal(true);
  };

  const confirmLeaveCollab = async () => {
    setShowLeaveCollabConfirm(false);
    try {
      await axios.delete(`${API}/playlists/${playlist._id}/contributors/${activeUser}`, authConfig);
      setPendingRequest(false);
      setToastMessage("You stopped collaborating on this playlist.");
      setToastType("success");
    } catch (error) {
      console.error("Failed to leave collaboration:", error);
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
  const normalizedActiveUser = normalizeUsername(activeUser);
  const isOwner = normalizeUsername(playlistOwnerUsername) === normalizedActiveUser;
  const collaboratorUsernames = (playlist?.contributors || []).map((username) => normalizeUsername(username));
  const isCollaborator = collaboratorUsernames.includes(normalizedActiveUser);
  const contributorCount = Array.isArray(playlist?.contributors) ? playlist.contributors.length : 0;
  const isManagedPlaylist = isOwner && contributorCount > 0;
  const canContribute = isOwner || isCollaborator;

  // DEBUG - remove after testing
  console.log("[PlaylistPage Debug]", {
    activeUser: normalizedActiveUser,
    playlistOwnerUsername,
    contributors: playlist?.contributors,
    collaboratorUsernames,
    isOwner,
    isCollaborator,
    canContribute,
    authToken: authToken ? "present" : "missing",
    playlistId: playlist?._id,
  });
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
            {isManagedPlaylist ? (
              <button
                type="button"
                className="playlist-icon-button"
                onClick={openContributionAnalytics}
                title="Contribution notifications"
              >
                <i className="ri-notification-3-line"></i>
              </button>
            ) : null}
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
            {!isOwner && location.state?.source === "discover" ? (
              <button
                type="button"
                className="playlist-contribute-button"
                onClick={handleContributeButtonClick}
                disabled={pendingRequest}
                title={
                  isCollaborator
                    ? "Stop collaborating"
                    : pendingRequest
                      ? "Request already sent"
                      : "Request to contribute"
                }
              >
                <i className={isCollaborator ? "ri-group-line" : "ri-edit-2-line"}></i>
                <span>
                  {isCollaborator ? "Collaborating" : pendingRequest ? "Requested" : "Contribute"}
                </span>
              </button>
            ) : null}
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

        {canContribute ? (
          <button type="button" className="playlist-add-row" onClick={() => setShowAddModal(true)}>
            <span className="playlist-add-icon">
              <i className="ri-add-line"></i>
            </span>
            <span className="playlist-add-copy">
              <strong>Add to this playlist</strong>
              <span>
                {isOwner ? `Upload a fresh song into ${playlist.name}` : `Contribute a new song to ${playlist.name}`}
              </span>
            </span>
          </button>
        ) : null}

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
                    draggable={canContribute}
                    onDragStart={(event) => canContribute && handleSongDragStart(index, event)}
                    onDragOver={(event) => canContribute && handleSongDragOver(index, event)}
                    onDrop={(event) => canContribute && handleSongDrop(index, event)}
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
                      {song.addedByUsername ? (
                        <button
                          type="button"
                          className="playlist-song-contributor"
                          onClick={() => navigate(`/discover/users/${song.addedByUsername}`)}
                        >
                          @{song.addedByUsername}
                        </button>
                      ) : null}
                      <span className={`playlist-song-mood mood-${normalizeMood(song.mood)}`}>
                        {(song.mood || "unknown").toUpperCase()}
                      </span>

                      {canContribute ? (
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
                      ) : null}
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

        {showContributeModal ? (
          <div className="modal-overlay" onClick={() => setShowContributeModal(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <h3>Request To Contribute</h3>
              <p className="copy-song-description">
                Send a collaboration request to edit <strong>{playlist.name}</strong> together.
              </p>
              <label className="copy-target-label">
                Message (optional)
                <textarea
                  className="playlist-contribute-textarea"
                  value={contributeMessage}
                  onChange={(event) => setContributeMessage(event.target.value)}
                  placeholder="Why do you want to help edit this playlist?"
                  rows={4}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowContributeModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={handleSubmitContributionRequest}>
                  Send Request
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pendingDeleteSongId ? (
          <div className="modal-overlay" onClick={() => setPendingDeleteSongId(null)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <h3>Delete Song</h3>
              <p className="copy-song-description">
                Are you sure you want to permanently delete this song from the playlist?
              </p>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setPendingDeleteSongId(null)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" style={{ backgroundColor: "#e74c3c" }} onClick={confirmDeleteSong}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showLeaveCollabConfirm ? (
          <div className="modal-overlay" onClick={() => setShowLeaveCollabConfirm(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <h3>Stop Collaborating</h3>
              <p className="copy-song-description">
                Are you sure you want to stop collaborating on this playlist?
              </p>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowLeaveCollabConfirm(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" style={{ backgroundColor: "#e74c3c" }} onClick={confirmLeaveCollab}>
                  Leave
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {toastMessage ? (
          <div className={`inline-toast ${toastType === "error" ? "inline-toast-error" : "inline-toast-success"}`}>
            {toastMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PlaylistPage;
