import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { dummyDiscoverPlaylists } from "../data/discoverDummyData";
import "./PlaylistsPage.css";
import "./FeaturedHubPage.css";

const API = "http://localhost:3000";

const FeaturedHubPage = ({
  activeUser,
  activeDisplayName,
}) => {
  const navigate = useNavigate();
  const [featuredPlaylists, setFeaturedPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [friends, setFriends] = useState([]);

  const loadFeaturedPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/featured/playlists`);
      const apiPlaylists = response.data.playlists || [];
      const merged = [...dummyDiscoverPlaylists, ...apiPlaylists.filter((playlist) => !playlist._id?.startsWith("dummy-"))];
      setFeaturedPlaylists(merged);
    } catch (error) {
      console.error("Failed to load featured playlists:", error);
      setFeaturedPlaylists(dummyDiscoverPlaylists);
    } finally {
      setLoading(false);
    }
  }, []);

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
    loadFeaturedPlaylists();
  }, [loadFeaturedPlaylists]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const followedUsernames = useMemo(
    () => new Set(friends.map((friend) => friend.username)),
    [friends]
  );

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

  const handleFollowToggle = async (event, playlistOwnerUsername) => {
    event.stopPropagation();
    if (!activeUser || activeUser === "guest") {
      alert("Please log in to follow users.");
      return;
    }

    const isFollowing = followedUsernames.has(playlistOwnerUsername);

    try {
      if (isFollowing) {
        await axios.post(`${API}/social/unfollow/${playlistOwnerUsername}`, {
          username: activeUser,
        });
      } else {
        await axios.post(`${API}/social/follow/${playlistOwnerUsername}`, {
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
                const isFollowing = followedUsernames.has(playlist.ownerUsername);

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
                        {!isOwnPlaylist ? (
                          <button
                            type="button"
                            className="discover-add-button"
                            onClick={(event) => handleFollowToggle(event, playlist.ownerUsername)}
                            aria-label={isFollowing ? "Added to library" : "Add to library"}
                            title={isFollowing ? "Added to library" : "Add to library"}
                          >
                            <i className={isFollowing ? "ri-check-line" : "ri-add-line"}></i>
                          </button>
                        ) : (
                          <span className="discover-own-chip">In your library</span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            : null}
        </div>
      </div>
    </div>
  );
};

export default FeaturedHubPage;
