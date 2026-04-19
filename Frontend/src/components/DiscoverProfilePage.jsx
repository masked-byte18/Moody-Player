import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  dummyDiscoverProfiles,
  getDummyPlaylistsByUsername,
} from "../data/discoverDummyData";
import "./FeaturedHubPage.css";
import "./PlaylistsPage.css";
import "./PlaylistPage.css";

const API = "http://localhost:3000";

const DiscoverProfilePage = ({ activeUser, activeDisplayName, authToken }) => {
  const navigate = useNavigate();
  const { username } = useParams();
  const [publicPlaylists, setPublicPlaylists] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [likeState, setLikeState] = useState({});
  const [clonedSet, setClonedSet] = useState(new Set());
  const [socialStats, setSocialStats] = useState({ followersCount: 0, followingCount: 0 });
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("");

  const loadPublicPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/featured/playlists`);
      const apiPlaylists = response.data.playlists || [];
      const dummyPlaylists = getDummyPlaylistsByUsername(username);
      const playlists = [...dummyPlaylists, ...apiPlaylists].filter(
        (playlist) => playlist.ownerUsername?.toLowerCase() === username?.toLowerCase()
      );
      setPublicPlaylists(playlists);

      const initialLikes = {};
      playlists.forEach((p) => {
        initialLikes[p._id] = {
          count: p.likesCount || 0,
          liked: (p.likedBy || []).includes((activeUser || "").toLowerCase()),
        };
      });
      setLikeState(initialLikes);
    } catch (error) {
      console.error("Failed to load public playlists:", error);
      setPublicPlaylists(getDummyPlaylistsByUsername(username));
    } finally {
      setLoading(false);
    }
  }, [username, activeUser]);

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

  const loadFriends = useCallback(async () => {
    if (!activeUser || activeUser === "guest") {
      setFriends([]);
      return;
    }

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

  const loadSocialStats = useCallback(async () => {
    if (!username) return;
    try {
      const response = await axios.get(`${API}/social/stats/${username}`, authConfig || undefined);
      setSocialStats({
        followersCount: response.data.followersCount || 0,
        followingCount: response.data.followingCount || 0,
      });
    } catch {
      setSocialStats({ followersCount: 0, followingCount: 0 });
    }
  }, [username, authConfig]);

  const loadClonedStatus = useCallback(async () => {
    if (!authConfig) return;
    try {
      const response = await axios.get(`${API}/playlists`, authConfig);
      const owned = response.data?.playlists || [];
      const clonedIds = new Set(owned.filter((p) => p.clonedFrom).map((p) => p.clonedFrom));
      setClonedSet(clonedIds);
    } catch {
      // ignore
    }
  }, [authConfig]);

  useEffect(() => { loadPublicPlaylists(); }, [loadPublicPlaylists]);
  useEffect(() => { loadFriends(); }, [loadFriends]);
  useEffect(() => { loadSocialStats(); }, [loadSocialStats]);
  useEffect(() => { loadClonedStatus(); }, [loadClonedStatus]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => { setToastMessage(""); setToastType(""); }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

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

  const ownerDisplayName =
    publicPlaylists[0]?.ownerDisplayName ||
    dummyDiscoverProfiles[(username || "").toLowerCase()]?.displayName ||
    username ||
    "User";
  const preset = dummyDiscoverProfiles[(username || "").toLowerCase()] || {
    tagline: `${ownerDisplayName} shares public mood-based playlists in Discover.`,
    favoriteMoods: ["happy", "neutral", "sad"],
  };

  const isFollowing = useMemo(
    () => friends.some((friend) => friend.username?.toLowerCase() === username?.toLowerCase()),
    [friends, username]
  );

  const filteredPlaylists = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return publicPlaylists;

    return publicPlaylists.filter((playlist) => {
      const name = playlist.name?.toLowerCase() || "";
      const description = playlist.description?.toLowerCase() || "";
      const songMatch = (playlist.songs || []).some((song) => {
        const title = song?.title?.toLowerCase() || "";
        return title.includes(query);
      });

      return name.includes(query) || description.includes(query) || songMatch;
    });
  }, [publicPlaylists, searchTerm]);

  const handleFollowToggle = async () => {
    if (!authConfig) {
      setToastMessage("Please log in to follow users.");
      setToastType("error");
      return;
    }

    try {
      if (isFollowing) {
        await axios.post(`${API}/social/unfollow/${username}`, {}, authConfig);
      } else {
        await axios.post(`${API}/social/follow/${username}`, {}, authConfig);
      }
      await loadFriends();
      await loadSocialStats();
    } catch (error) {
      console.error("Follow toggle error:", error);
      setToastMessage("Failed to update follow status");
      setToastType("error");
    }
  };

  return (
    <div className="page-shell">
      <div className="discover-profile-page">
        <section className="discover-profile-hero">
          <div className="discover-profile-top">
            <div className="discover-profile-avatar">
              {(ownerDisplayName || "U").charAt(0).toUpperCase()}
            </div>

            <div className="discover-profile-copy">
              <h2 className="discover-profile-name">{ownerDisplayName}</h2>
              <p className="discover-profile-description">{preset.tagline}</p>
            </div>

            <div className="discover-profile-side">
              {activeUser?.toLowerCase() !== username?.toLowerCase() ? (
                <button type="button" className="btn-primary" onClick={handleFollowToggle}>
                  {isFollowing ? "Unfollow" : "Follow"}
                </button>
              ) : null}
              <div className="discover-profile-social-counts">
                <span>{socialStats.followersCount} followers</span>
                <span>{socialStats.followingCount} following</span>
              </div>
            </div>
          </div>

          <div className="discover-profile-bottom">
            <div className="discover-profile-stats">
              <span>Public Playlist: {publicPlaylists.length}</span>
            </div>

            <div className="discover-profile-moods">
              {preset.favoriteMoods.map((mood) => (
                <span key={mood} className="playlist-mood-chip">
                  {mood}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="discover-profile-section">
          <div className="discover-search-shell">
            <i className="ri-search-line"></i>
            <input
              type="text"
              placeholder="Search this user's playlists or songs"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="discover-playlist-grid">
            {loading ? <div className="empty-panel">Loading public playlists...</div> : null}
            {!loading && publicPlaylists.length === 0 ? (
              <div className="empty-panel">No playlists.</div>
            ) : null}
            {!loading && publicPlaylists.length > 0 && filteredPlaylists.length === 0 ? (
              <div className="empty-panel">No playlists match this search.</div>
            ) : null}

            {!loading
              ? filteredPlaylists.map((playlist) => {
                  const like = likeState[playlist._id] || { count: 0, liked: false };
                  const isCloned = clonedSet.has(playlist._id);

                  return (
                    <article
                      key={playlist._id}
                      className="discover-playlist-card"
                      onClick={() =>
                        navigate(`/playlists/${playlist._id}`, {
                          state: {
                            source: "discover",
                            ownerUsername: playlist.ownerUsername,
                            ownerDisplayName: playlist.ownerDisplayName,
                            playlistData: playlist,
                          },
                        })
                      }
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

                          {playlist.ownerUsername !== activeUser ? (
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
                            <span className="discover-own-chip">Public</span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              : null}
          </div>
        </section>

        {toastMessage ? (
          <div className={`inline-toast ${toastType === "error" ? "inline-toast-error" : "inline-toast-success"}`}>
            {toastMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default DiscoverProfilePage;
