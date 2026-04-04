import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import QueueList from "./QueueList";
import "./PlaylistsPage.css";
import "./FeaturedHubPage.css";

const API = "http://localhost:3000";

const FeaturedHubPage = ({
  queue,
  queueSource,
  isPlaying,
  currentIndex,
  onPlayPlaylist,
  onPlayPause,
  onNext,
  onPrevious,
  onStop,
  loopCurrentSong = false,
  onToggleLoop,
  activeUser,
  activeDisplayName,
}) => {
  const [tab, setTab] = useState("featured");
  const [featuredPlaylists, setFeaturedPlaylists] = useState([]);
  const [allFeaturedPlaylists, setAllFeaturedPlaylists] = useState([]);
  const [savedFeatured, setSavedFeatured] = useState([]);
  const [friends, setFriends] = useState([]);

  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [selectedSource, setSelectedSource] = useState("featured");
  const [selectedLocalName, setSelectedLocalName] = useState("");

  const [globalSearch, setGlobalSearch] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [songResults, setSongResults] = useState([]);


  const [renameDrafts, setRenameDrafts] = useState({});

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishName, setPublishName] = useState("");
  const [publishDescription, setPublishDescription] = useState("");
  const [publishCover, setPublishCover] = useState(null);
  const [publishing, setPublishing] = useState(false);

  const savedPlaylistIds = useMemo(
    () => new Set(savedFeatured.map((item) => item.playlist?._id).filter(Boolean)),
    [savedFeatured]
  );

  const loadFeaturedPlaylists = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/featured/playlists`);
      const list = response.data.playlists || [];
      setAllFeaturedPlaylists(list);
      setFeaturedPlaylists(list);
    } catch (error) {
      console.error("Failed to load featured playlists:", error);
      setAllFeaturedPlaylists([]);
      setFeaturedPlaylists([]);
    }
  }, []);

  const loadSavedFeatured = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/featured/saved`, {
        params: { username: activeUser },
      });
      setSavedFeatured(response.data.saved || []);
    } catch (error) {
      console.error("Failed to load saved featured playlists:", error);
      setSavedFeatured([]);
    }
  }, [activeUser]);

  const loadFriends = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/social/friends`, {
        params: { username: activeUser },
      });
      setFriends(response.data.friends || []);
    } catch (error) {
      console.error("Failed to load friends:", error);
      setFriends([]);
    }
  }, [activeUser]);

  const loadSelectedPlaylist = useCallback(async (playlistId, source = "featured", localName = "") => {
    if (!playlistId) return;
    try {
      const response = await axios.get(`${API}/playlists/${playlistId}`);
      setSelectedPlaylist(response.data.playlist);
      setSelectedSource(source);
      setSelectedLocalName(localName || "");
    } catch (error) {
      console.error("Failed to load selected playlist:", error);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadFeaturedPlaylists(), loadSavedFeatured(), loadFriends()]);
  }, [loadFeaturedPlaylists, loadSavedFeatured, loadFriends]);

  const handlePublishFeaturedPlaylist = async (event) => {
    event.preventDefault();
    if (!publishName.trim()) return;

    setPublishing(true);
    try {
      const formData = new FormData();
      formData.append("name", publishName.trim());
      formData.append("description", publishDescription.trim());
      formData.append("ownerUsername", activeUser);
      formData.append("ownerDisplayName", activeDisplayName);
      formData.append("isFeatured", "true");
      if (publishCover) {
        formData.append("cover", publishCover);
      }

      await axios.post(`${API}/playlists`, formData);
      await loadFeaturedPlaylists();

      setPublishName("");
      setPublishDescription("");
      setPublishCover(null);
      setShowPublishModal(false);
    } catch (error) {
      console.error("Publish featured playlist error:", error);
      alert("Failed to publish featured playlist");
    } finally {
      setPublishing(false);
    }
  };

  const handleGlobalSearch = async () => {
    const query = globalSearch.trim();
    if (!query) {
      setFeaturedPlaylists(allFeaturedPlaylists);
      setUserResults([]);
      setSongResults([]);
      return;
    }

    const queryText = query.toLowerCase();
    const matchedPlaylists = allFeaturedPlaylists.filter((playlist) => {
      const name = playlist.name?.toLowerCase() || "";
      const description = playlist.description?.toLowerCase() || "";
      const owner = playlist.ownerUsername?.toLowerCase() || "";
      const ownerDisplay = playlist.ownerDisplayName?.toLowerCase() || "";
      const songMatch = (playlist.songs || []).some((song) => {
        const title = song?.title?.toLowerCase() || "";
        const artist = song?.artist?.toLowerCase() || "";
        const mood = song?.mood?.toLowerCase() || "";
        return title.includes(queryText) || artist.includes(queryText) || mood.includes(queryText);
      });

      return (
        name.includes(queryText) ||
        description.includes(queryText) ||
        owner.includes(queryText) ||
        ownerDisplay.includes(queryText) ||
        songMatch
      );
    });

    const songs = [];
    matchedPlaylists.forEach((playlist) => {
      (playlist.songs || []).forEach((song) => {
        if (!song?._id) return;
        const title = song.title?.toLowerCase() || "";
        const artist = song.artist?.toLowerCase() || "";
        const mood = song.mood?.toLowerCase() || "";
        if (title.includes(queryText) || artist.includes(queryText) || mood.includes(queryText)) {
          songs.push({
            ...song,
            playlistId: playlist._id,
            playlistName: playlist.name,
          });
        }
      });
    });

    const uniqueSongs = Array.from(new Map(songs.map((song) => [song._id, song])).values()).slice(0, 12);
    setSongResults(uniqueSongs);
    setFeaturedPlaylists(matchedPlaylists);

    try {
      const response = await axios.get(`${API}/social/users/search`, {
        params: { query, viewer: activeUser },
      });
      setUserResults((response.data.users || []).filter((user) => user.username !== activeUser));
    } catch (error) {
      console.error("Failed to search users:", error);
      setUserResults([]);
    }
  };

  const handleFollowUser = async (username) => {
    try {
      await axios.post(`${API}/social/follow/${username}`, {
        username: activeUser,
        displayName: activeDisplayName,
      });
      await loadFriends();
      await handleGlobalSearch();
    } catch (error) {
      console.error("Follow error:", error);
      alert("Failed to follow user");
    }
  };

  const handleUnfollowUser = async (username) => {
    try {
      await axios.post(`${API}/social/unfollow/${username}`, {
        username: activeUser,
      });
      await loadFriends();
      await handleGlobalSearch();
    } catch (error) {
      console.error("Unfollow error:", error);
      alert("Failed to unfollow user");
    }
  };

  const handleSaveFeaturedPlaylist = async (playlist) => {
    try {
      await axios.post(`${API}/featured/playlists/${playlist._id}/save`, {
        username: activeUser,
        displayName: activeDisplayName,
        localName: playlist.name,
      });
      await loadSavedFeatured();
    } catch (error) {
      console.error("Save featured playlist error:", error);
      alert("Failed to save featured playlist");
    }
  };

  const handleRenameSavedPlaylist = async (playlistId) => {
    const localName = (renameDrafts[playlistId] || "").trim();
    if (!localName) return;

    try {
      await axios.put(`${API}/featured/saved/${playlistId}/rename`, {
        username: activeUser,
        localName,
      });
      setRenameDrafts((prev) => ({ ...prev, [playlistId]: "" }));
      await loadSavedFeatured();
      if (selectedPlaylist?._id === playlistId && selectedSource === "saved") {
        setSelectedLocalName(localName);
      }
    } catch (error) {
      console.error("Rename saved playlist error:", error);
      alert("Failed to rename saved playlist");
    }
  };

  const handleUnsavePlaylist = async (playlistId) => {
    try {
      await axios.delete(`${API}/featured/saved/${playlistId}`, {
        params: { username: activeUser },
      });
      if (selectedPlaylist?._id === playlistId && selectedSource === "saved") {
        setSelectedPlaylist(null);
      }
      await loadSavedFeatured();
    } catch (error) {
      console.error("Unsave playlist error:", error);
      alert("Failed to remove saved playlist");
    }
  };

  const visiblePlaylists =
    tab === "featured"
      ? featuredPlaylists
      : savedFeatured.map((entry) => ({ ...entry.playlist, localName: entry.localName }));

  const isActivePlaylist =
    queueSource?.type === "playlist" && queueSource?.playlistId === selectedPlaylist?._id;
  const displayIndex = isActivePlaylist ? currentIndex : -1;
  const displayPlaying = isActivePlaylist ? isPlaying : false;
  const activeQueue = isActivePlaylist ? queue : [];
  const currentSong = isActivePlaylist && activeQueue.length > 0 ? activeQueue[currentIndex] : null;

  return (
    <div className="page-shell">
      <div className="playlists-split-page">
        <div className="playlists-left-half featured-left-pane">
          <div className="playlists-header">
            <div>
              <h2>Discover</h2>
              <p>Featured playlists, user search, and your saved featured collection.</p>
            </div>
            <button className="btn-primary" onClick={() => setShowPublishModal(true)}>
              Publish Featured Playlist
            </button>
          </div>

          <div className="playlist-tabs">
            <button type="button" className={tab === "featured" ? "active" : ""} onClick={() => setTab("featured")}>
              Featured Collection
            </button>
            <button type="button" className={tab === "saved" ? "active" : ""} onClick={() => setTab("saved")}>
              Saved In Personal Space
            </button>
          </div>

          {tab === "featured" && (
            <div className="featured-search-bar">
              <input
                type="text"
                placeholder="Search songs, playlists, or users"
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
              />
              <button type="button" className="btn-secondary" onClick={handleGlobalSearch}>
                Search
              </button>
            </div>
          )}

          {tab === "featured" && songResults.length > 0 && (
            <div className="song-search-panel">
              <h4>Song Matches</h4>
              <div className="song-search-grid">
                {songResults.map((song) => (
                  <div key={song._id} className="song-search-card">
                    <strong>{song.title}</strong>
                    <p>{song.artist}</p>
                    <small>In {song.playlistName}</small>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="playlist-grid">
            {visiblePlaylists.map((playlist) => (
              <div
                className={`playlist-card ${selectedPlaylist?._id === playlist._id ? "selected" : ""}`}
                key={playlist._id}
                onClick={() =>
                  loadSelectedPlaylist(
                    playlist._id,
                    tab,
                    tab === "saved" ? playlist.localName || playlist.name : ""
                  )
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
                    <div className="playlist-title">
                      {tab === "saved" ? playlist.localName || playlist.name : playlist.name}
                    </div>
                    <p>{playlist.description || "No description"}</p>
                    <span>{playlist.songs?.length || 0} songs</span>
                    <div className="playlist-meta-line">
                      <small>By @{playlist.ownerUsername}</small>
                      <small className="featured-chip">Featured</small>
                    </div>
                  </div>
                  <div className="playlist-actions" onClick={(event) => event.stopPropagation()}>
                    {tab === "featured" ? (
                      <button
                        type="button"
                        className="btn-secondary compact-btn"
                        onClick={() => handleSaveFeaturedPlaylist(playlist)}
                        disabled={savedPlaylistIds.has(playlist._id)}
                      >
                        {savedPlaylistIds.has(playlist._id) ? "Saved" : "Save"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary compact-btn"
                        onClick={() => handleUnsavePlaylist(playlist._id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {visiblePlaylists.length === 0 && (
              <div className="empty-panel">No playlists found in this section yet.</div>
            )}
          </div>

          <div className="social-panel">
            <h3>User Search</h3>
            <p>Use the single search bar above for users, songs, and playlists.</p>

            <div className="social-results">
              {userResults.map((user) => (
                <div key={user.username} className="social-card">
                  <div>
                    <strong>{user.displayName}</strong>
                    <p>@{user.username}</p>
                    <small>{user.featuredCount} featured playlist(s)</small>
                  </div>
                  {user.isFollowing ? (
                    <button type="button" className="btn-secondary compact-btn" onClick={() => handleUnfollowUser(user.username)}>
                      Unfollow
                    </button>
                  ) : (
                    <button type="button" className="btn-primary compact-btn" onClick={() => handleFollowUser(user.username)}>
                      Follow
                    </button>
                  )}
                </div>
              ))}
              {userResults.length === 0 && <div className="social-empty">No user results yet.</div>}
            </div>

            <div className="friends-strip">
              <h4>Following</h4>
              {friends.length === 0 ? (
                <p className="social-empty">You are not following anyone yet.</p>
              ) : (
                friends.map((friend) => (
                  <div key={friend.username} className="friend-pill">
                    <span>{friend.displayName}</span>
                    <small>@{friend.username}</small>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="playlists-right-half">
          {selectedPlaylist ? (
            <>
              <div className="playlists-header">
                <div>
                  <h2>{selectedSource === "saved" ? selectedLocalName || selectedPlaylist.name : selectedPlaylist.name}</h2>
                  <p>
                    {selectedPlaylist.description || "No description"} · By @{selectedPlaylist.ownerUsername}
                  </p>
                </div>
                <div className="playlist-viewer-actions">
                  <button className="btn-primary" onClick={() => onPlayPlaylist(selectedPlaylist, 0)}>
                    Play Playlist
                  </button>
                </div>
              </div>

              {selectedSource === "saved" && (
                <div className="rename-row">
                  <input
                    type="text"
                    value={renameDrafts[selectedPlaylist._id] ?? (selectedLocalName || selectedPlaylist.name)}
                    onChange={(event) =>
                      setRenameDrafts((prev) => ({ ...prev, [selectedPlaylist._id]: event.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleRenameSavedPlaylist(selectedPlaylist._id)}
                  >
                    Rename In Personal Space
                  </button>
                </div>
              )}

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
                title="Featured Playlist Queue"
                songs={selectedPlaylist.songs || []}
                currentIndex={displayIndex}
                isPlaying={displayPlaying}
                onPlayFromQueue={(index) => onPlayPlaylist(selectedPlaylist, index)}
                editable={false}
              />
            </>
          ) : (
            <div className="no-playlist-selected">
              <div className="music-icon-large">🌟</div>
              <h3>No Featured Playlist Selected</h3>
              <p>Select a featured playlist to preview and save.</p>
            </div>
          )}
        </div>

        {showPublishModal && (
          <div className="modal-overlay" onClick={() => setShowPublishModal(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <h3>Publish Featured Playlist</h3>
              <form onSubmit={handlePublishFeaturedPlaylist} className="modal-form">
                <label>
                  Name (required)
                  <input
                    type="text"
                    value={publishName}
                    onChange={(event) => setPublishName(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Description
                  <textarea
                    rows="3"
                    value={publishDescription}
                    onChange={(event) => setPublishDescription(event.target.value)}
                  />
                </label>
                <label>
                  Cover Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setPublishCover(event.target.files[0])}
                  />
                </label>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowPublishModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={publishing}>
                    {publishing ? "Publishing..." : "Publish"}
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

export default FeaturedHubPage;
