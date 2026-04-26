import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./FeaturedHubPage.css";
import "./PlaylistsPage.css";
import "./PlaylistPage.css";

const API = "http://localhost:3000";

const DiscoverProfilePage = ({ activeUser, authToken, onUserChange }) => {
  const navigate = useNavigate();
  const { username } = useParams();
  const [publicPlaylists, setPublicPlaylists] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [likeState, setLikeState] = useState({});
  const [clonedSet, setClonedSet] = useState(new Set());
  const [socialStats, setSocialStats] = useState({ followersCount: 0, followingCount: 0 });
  const [profileData, setProfileData] = useState({
    displayName: "",
    tagline: "",
    favoriteMoods: [],
  });
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("");

  // Edit profile state
  const [editMode, setEditMode] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [displayDraft, setDisplayDraft] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const isOwnProfile = useMemo(
    () => activeUser && username && activeUser.toLowerCase() === username.toLowerCase(),
    [activeUser, username]
  );

  const loadProfileData = useCallback(async () => {
    if (!username) return;
    try {
      const response = await axios.get(`${API}/users/${username}`);
      setProfileData({
        displayName: response.data.user.displayName || username,
        tagline: response.data.user.tagline || "Music enthusiast.",
        favoriteMoods: response.data.user.favoriteMoods || [],
      });
    } catch (error) {
      console.error("Failed to load profile data:", error);
      setProfileData({
        displayName: username,
        tagline: "Music enthusiast.",
        favoriteMoods: [],
      });
    }
  }, [username]);

  const loadPublicPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/playlists`, {
        params: { username, scope: "public" },
      });
      const playlists = response.data.playlists || [];
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
      console.error("Failed to load user playlists:", error);
      setPublicPlaylists([]);
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
    if (!activeUser || activeUser === "guest" || !authConfig) {
      setFriends([]);
      return;
    }

    try {
      const response = await axios.get(`${API}/social/friends`, authConfig);
      setFriends(response.data.friends || []);
    } catch (error) {
      console.error("Failed to load friends:", error);
      setFriends([]);
    }
  }, [activeUser, authConfig]);

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

  useEffect(() => { loadProfileData(); }, [loadProfileData]);
  useEffect(() => { loadPublicPlaylists(); }, [loadPublicPlaylists]);
  useEffect(() => { loadFriends(); }, [loadFriends]);
  useEffect(() => { loadSocialStats(); }, [loadSocialStats]);
  useEffect(() => { loadClonedStatus(); }, [loadClonedStatus]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => { setToastMessage(""); setToastType(""); }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Reset edit mode when navigating to a different profile
  useEffect(() => {
    setEditMode(false);
    setPhotoFile(null);
  }, [username]);

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

  const handleEditProfile = () => {
    setUsernameDraft(activeUser || "");
    setDisplayDraft(profileData.displayName || "");
    setPhotoFile(null);
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setPhotoFile(null);
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    if (!usernameDraft.trim() || !authConfig) return;
    setSaving(true);

    try {
      const formData = new FormData();
      formData.append("currentUsername", activeUser);
      formData.append("username", usernameDraft.trim().toLowerCase());
      formData.append("displayName", displayDraft.trim());
      if (photoFile) {
        formData.append("profilePhoto", photoFile);
      }

      const response = await axios.put(`${API}/auth/profile`, formData, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (typeof onUserChange === "function") {
        onUserChange({
          ...response.data.user,
          token: response.data.token || authToken,
        });
      }

      setEditMode(false);
      setPhotoFile(null);
      setToastMessage("Profile updated!");
      setToastType("success");

      // If username changed, navigate to the new profile URL
      const newUsername = response.data.user?.username || usernameDraft.trim().toLowerCase();
      if (newUsername !== username) {
        navigate(`/discover/users/${newUsername}`, { replace: true });
      } else {
        await loadProfileData();
      }
    } catch (error) {
      console.error("Profile save error:", error);
      setToastMessage(error?.response?.data?.message || "Failed to update profile");
      setToastType("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="discover-profile-page">
        <section className="discover-profile-hero">
          <div className="discover-profile-top">
            <div className="discover-profile-main">
              <div className="discover-profile-avatar">
                {(profileData.displayName || "U").charAt(0).toUpperCase()}
              </div>

              <div className="discover-profile-copy">
                <h2 className="discover-profile-name">{profileData.displayName}</h2>
                <p className="discover-profile-description">{profileData.tagline}</p>
              </div>
            </div>

            <div className="discover-profile-side">
              {isOwnProfile ? (
                !editMode ? (
                  <button type="button" className="btn-secondary" onClick={handleEditProfile}>
                    <i className="ri-pencil-line" style={{ marginRight: "0.3rem" }}></i> Edit Profile
                  </button>
                ) : null
              ) : (
                <button 
                  type="button" 
                  className={isFollowing ? "btn-secondary" : "btn-primary"} 
                  style={isFollowing ? { backgroundColor: "#1db954", color: "#000", borderColor: "#1db954" } : {}}
                  onClick={handleFollowToggle}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              )}
              <div className="discover-profile-social-counts">
                <span>{socialStats.followersCount} followers</span>
                <span>{socialStats.followingCount} following</span>
              </div>
            </div>
          </div>

          {/* Edit Profile Form (inline) */}
          {isOwnProfile && editMode ? (
            <form className="profile-form" onSubmit={handleSaveProfile} style={{ marginTop: "0.75rem", borderTop: "1px solid var(--border-default)", paddingTop: "0.75rem" }}>
              <label>
                Username
                <input
                  type="text"
                  value={usernameDraft}
                  onChange={(e) => setUsernameDraft(e.target.value)}
                  required
                />
              </label>
              <label>
                Display Name
                <input
                  type="text"
                  value={displayDraft}
                  onChange={(e) => setDisplayDraft(e.target.value)}
                />
              </label>
              <label>
                Profile Photo
                <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0])} />
              </label>
              <div className="profile-actions">
                <button type="button" className="btn-secondary" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
              </div>
            </form>
          ) : null}

          <div className="discover-profile-bottom">
            <div className="discover-profile-stats">
              <span>Public Playlist: {publicPlaylists.length}</span>
            </div>

            <div className="discover-profile-moods">
              {profileData.favoriteMoods.map((mood) => (
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
              <div className="empty-panel">No public playlists yet.</div>
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

                          {!isOwnProfile ? (
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
