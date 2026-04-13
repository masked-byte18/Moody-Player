import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  dummyDiscoverProfiles,
  getDummyPlaylistsByUsername,
} from "../data/discoverDummyData";
import "./FeaturedHubPage.css";
import "./PlaylistsPage.css";

const API = "http://localhost:3000";

const DiscoverProfilePage = ({ activeUser, activeDisplayName }) => {
  const navigate = useNavigate();
  const { username } = useParams();
  const [publicPlaylists, setPublicPlaylists] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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
    } catch (error) {
      console.error("Failed to load public playlists:", error);
      setPublicPlaylists(getDummyPlaylistsByUsername(username));
    } finally {
      setLoading(false);
    }
  }, [username]);

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

  useEffect(() => {
    loadPublicPlaylists();
  }, [loadPublicPlaylists]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const ownerDisplayName =
    publicPlaylists[0]?.ownerDisplayName ||
    dummyDiscoverProfiles[(username || "").toLowerCase()]?.displayName ||
    username ||
    "User";
  const preset = dummyDiscoverProfiles[(username || "").toLowerCase()] || {
    tagline: `${ownerDisplayName} shares public mood-based playlists in Discover.`,
    favoriteMoods: ["happy", "neutral", "sad"],
  };
  const followerCount = preset.followerCount ?? (publicPlaylists.length * 12 + 8);
  const followingCount = preset.followingCount ?? (publicPlaylists.length * 4 + 3);

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
    if (!activeUser || activeUser === "guest") {
      alert("Please log in to follow users.");
      return;
    }

    try {
      if (isFollowing) {
        await axios.post(`${API}/social/unfollow/${username}`, {
          username: activeUser,
        });
      } else {
        await axios.post(`${API}/social/follow/${username}`, {
          username: activeUser,
          displayName: activeDisplayName,
        });
      }

      await loadFriends();
    } catch (error) {
      console.error("Follow toggle error:", error);
      alert("Failed to update follow status");
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
                <span>{followerCount} followers</span>
                <span>{followingCount} following</span>
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
              ? filteredPlaylists.map((playlist) => (
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
                        <span className="discover-own-chip">Public</span>
                      </div>
                    </div>
                  </article>
                ))
              : null}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DiscoverProfilePage;
