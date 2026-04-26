import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./PlaylistsPage.css";
import "./FeaturedHubPage.css";
import "./PlaylistPage.css";

const API = "http://localhost:3000";

const FeaturedHubPage = ({
  activeUser,
  authToken,
}) => {
  const navigate = useNavigate();
  const [featuredPlaylists, setFeaturedPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [likeState, setLikeState] = useState({});
  const [clonedSet, setClonedSet] = useState(new Set());
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("");

  const loadFeaturedPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/featured/playlists`);
      const apiPlaylists = response.data.playlists || [];
      
      const uniquePlaylists = [];
      const seenNames = new Set();
      
      apiPlaylists.forEach((p) => {
        const normalizedName = (p.name || "").toLowerCase().trim();
        if (!seenNames.has(normalizedName)) {
          seenNames.add(normalizedName);
          uniquePlaylists.push(p);
        }
      });

      setFeaturedPlaylists(uniquePlaylists);

      const initialLikes = {};
      uniquePlaylists.forEach((p) => {
        initialLikes[p._id] = {
          count: p.likesCount || 0,
          liked: (p.likedBy || []).includes((activeUser || "").toLowerCase()),
        };
      });
      setLikeState(initialLikes);
    } catch (error) {
      console.error("Failed to load featured playlists:", error);
      setFeaturedPlaylists([]);
    } finally {
      setLoading(false);
    }
  }, [activeUser]);

  const authConfig = useMemo(
    () =>
      authToken && activeUser && activeUser !== "guest"
        ? {
            headers: {
              authorization: `Bearer ${authToken}`,
            },
          }
        : null,
    [activeUser, authToken]
  );

  const loadClonedStatus = useCallback(async () => {
    if (!authConfig) {
      setClonedSet(new Set());
      return;
    }
    try {
      const response = await axios.get(`${API}/playlists`, {
        ...authConfig,
        params: { username: activeUser, scope: "owned" },
      });
      const owned = response.data?.playlists || [];
      const clonedIds = new Set(owned.filter((p) => p.clonedFrom).map((p) => p.clonedFrom));
      setClonedSet(clonedIds);
    } catch {
      setClonedSet(new Set());
    }
  }, [authConfig, activeUser]);

  useEffect(() => {
    loadFeaturedPlaylists();
  }, [loadFeaturedPlaylists]);

  useEffect(() => {
    loadClonedStatus();
  }, [loadClonedStatus]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => { setToastMessage(""); setToastType(""); }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const filteredPlaylists = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return featuredPlaylists;

    return featuredPlaylists.filter((playlist) => {
      const name = playlist.name?.toLowerCase() || "";
      const description = playlist.description?.toLowerCase() || "";
      const owner = playlist.ownerUsername?.toLowerCase() || "";
      const ownerDisplay = playlist.ownerDisplayName?.toLowerCase() || "";
      const songMatch = (playlist.songs || []).some((song) => {
        const title = song?.title?.toLowerCase() || "";
        const artist = song?.artist?.toLowerCase() || "";
        const mood = song?.mood?.toLowerCase() || "";
        return title.includes(query) || artist.includes(query) || mood.includes(query);
      });

      return (
        name.includes(query) ||
        description.includes(query) ||
        owner.includes(query) ||
        ownerDisplay.includes(query) ||
        songMatch
      );
    });
  }, [featuredPlaylists, searchTerm]);

  const handleClonePlaylist = async (event, playlistId) => {
    event.stopPropagation();
    if (!authConfig) {
      setToastMessage("Please log in to save this playlist to your library.");
      setToastType("error");
      return;
    }

    if (clonedSet.has(playlistId)) {
      setToastMessage("This playlist already exists in your library.");
      setToastType("error");
      return;
    }

    try {
      await axios.post(`${API}/playlists/${playlistId}/clone`, {}, authConfig);
      setClonedSet((prev) => new Set([...prev, playlistId]));
      setToastMessage("Saved to your library!");
      setToastType("success");
    } catch (error) {
      console.error("Clone error:", error);
      setToastMessage(error?.response?.data?.message || "Failed to add playlist to library");
      setToastType("error");
    }
  };

  const handleLikeToggle = async (event, playlistId) => {
    event.stopPropagation();
    if (!authConfig) {
      setToastMessage("Please log in to like playlists.");
      setToastType("error");
      return;
    }

    try {
      const response = await axios.post(`${API}/playlists/${playlistId}/like`, {}, authConfig);
      setLikeState((prev) => ({
        ...prev,
        [playlistId]: {
          count: response.data.likesCount,
          liked: response.data.liked,
        },
      }));
    } catch (error) {
      console.error("Like error:", error);
    }
  };

  const openPlaylist = (playlist) => {
    navigate(`/playlists/${playlist._id}`, {
      state: {
        source: "discover",
        ownerUsername: playlist.ownerUsername,
        ownerDisplayName: playlist.ownerDisplayName,
        playlistData: playlist,
      },
    });
  };

  return (
    <div className="page-shell">
      <div className="discover-page">
        <div className="playlists-header discover-header">
          <div>
            <h2>Discover</h2>
            <p>Scroll through public playlists, search songs or playlists, and open any collection instantly.</p>
          </div>
        </div>

        <div className="discover-search-shell">
          <i className="ri-search-line"></i>
          <input
            type="text"
            placeholder="Search songs or playlists"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="discover-results-meta">
          <span>{filteredPlaylists.length} playlist(s) visible</span>
          {searchTerm.trim() ? <span>Showing results for "{searchTerm.trim()}"</span> : <span>Explore all public uploads</span>}
        </div>

        <div className="discover-playlist-grid">
          {loading ? <div className="empty-panel">Loading discover playlists...</div> : null}

          {!loading && filteredPlaylists.length === 0 ? (
            <div className="empty-panel">No playlists match your search yet.</div>
          ) : null}

          {!loading
            ? filteredPlaylists.map((playlist) => {
                const isOwnPlaylist = playlist.ownerUsername === activeUser;
                const like = likeState[playlist._id] || { count: 0, liked: false };
                const isCloned = clonedSet.has(playlist._id);

                return (
                  <article
                    key={playlist._id}
                    className="discover-playlist-card"
                    onClick={() => openPlaylist(playlist)}
                  >
                    <div className="discover-playlist-cover">
                      {playlist.coverImage ? (
                        <img src={playlist.coverImage} alt={playlist.name} />
                      ) : (
                        <div className="cover-placeholder">No Cover</div>
                      )}
                    </div>

                    <div className="discover-playlist-copy">
                      <div className="discover-playlist-text">
                        <h3>{playlist.name}</h3>
                        <p>{playlist.description || "No description yet."}</p>
                        <button
                          type="button"
                          className="discover-owner-link"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/discover/users/${playlist.ownerUsername}`);
                          }}
                        >
                          @{playlist.ownerUsername}
                        </button>
                      </div>

                      <div className="discover-card-actions">
                        <span className="discover-song-count">{playlist.songs?.length || 0} songs</span>

                        <button
                          type="button"
                          className={`discover-like-button${like.liked ? " is-liked" : ""}`}
                          onClick={(event) => handleLikeToggle(event, playlist._id)}
                          title={like.liked ? "Unlike" : "Like"}
                        >
                          <i className={like.liked ? "ri-heart-fill" : "ri-heart-line"}></i>
                          {like.count > 0 ? <span className="discover-like-count">{like.count}</span> : null}
                        </button>

                        {!isOwnPlaylist ? (
                          <button
                            type="button"
                            className="discover-add-button"
                            onClick={(event) => handleClonePlaylist(event, playlist._id)}
                            aria-label="Add to library"
                            title={isCloned ? "Already in your library" : "Save a copy to your library"}
                          >
                            <i className={isCloned ? "ri-check-line" : "ri-add-line"}></i>
                          </button>
                        ) : (
                          <span className="discover-own-chip">Yours</span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            : null}
        </div>

        {toastMessage ? (
          <div className={`inline-toast ${toastType === "error" ? "inline-toast-error" : "inline-toast-success"}`}>
            {toastMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default FeaturedHubPage;
