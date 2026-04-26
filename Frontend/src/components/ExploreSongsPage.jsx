import React, { useState, useEffect } from "react";
import axios from "axios";
import "./ExploreSongsPage.css";

const JAMENDO_API_KEY = import.meta.env.VITE_JAMENDO_CLIENT_ID;
const LOCAL_API = "http://localhost:3000";

// Strip session-specific params so Jamendo track URLs always match the DB record
const normalizeAudioUrl = (url) => {
  try {
    const u = new URL(url);
    u.searchParams.delete("from");
    return u.toString();
  } catch {
    return url;
  }
};

export default function ExploreSongsPage({ activeUser, authToken, startQueue }) {
  const [jamendoTracks, setJamendoTracks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingJamendo, setLoadingJamendo] = useState(true);
  const [error, setError] = useState(null);
  
  // Playlist Modal State
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [userPlaylists, setUserPlaylists] = useState([]);
  
  // Dynamic Likes — single state object, same pattern as Discover page
  const [likeState, setLikeState] = useState({});

  useEffect(() => {
    fetchGlobalLikesMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, activeUser]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchJamendoTracks(searchQuery);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchGlobalLikesMap = async () => {
    try {
      const res = await axios.get(`${LOCAL_API}/songs/top-liked?limit=1000`);
      if (res.data?.songs) {
        const initial = {};
        res.data.songs.forEach((song) => {
          const key = normalizeAudioUrl(song.audio);
          // Keep only the first (highest-liked) record per normalized URL
          if (!initial[key]) {
            initial[key] = {
              count: song.likesCount || 0,
              liked: (song.likedBy || []).includes((activeUser || "").toLowerCase()),
              dbId: song._id,
            };
          }
        });
        setLikeState(initial);
      }
    } catch (err) {
      console.error("Failed to fetch global likes map", err);
    }
  };

  const fetchJamendoTracks = async (query) => {
    if (!JAMENDO_API_KEY) {
      setError("Jamendo API Key is missing. Please add VITE_JAMENDO_CLIENT_ID to .env");
      setLoadingJamendo(false);
      return;
    }
    try {
      setLoadingJamendo(true);
      const searchParam = query ? `&search=${encodeURIComponent(query)}` : "&boost=popularity_month";
      const res = await axios.get(
        `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_API_KEY}&format=jsonpretty&limit=30&hasimage=true&audioformat=mp32${searchParam}`
      );
      
      if (res.data && res.data.results) {
        setJamendoTracks(res.data.results);
      } else {
        setError("Failed to fetch tracks");
      }
    } catch (err) {
      console.error(err);
      setError("Error fetching from Jamendo API.");
    } finally {
      setLoadingJamendo(false);
    }
  };

  const fetchUserPlaylists = async () => {
    if (!activeUser || activeUser === "guest" || !authToken) return;
    try {
      const config = { headers: { Authorization: `Bearer ${authToken}` } };
      const [ownedRes, collabRes, managedRes] = await Promise.all([
        axios.get(`${LOCAL_API}/playlists/mine`, config),
        axios.get(`${LOCAL_API}/playlists/collab`, config),
        axios.get(`${LOCAL_API}/playlists/managed`, config),
      ]);

      const merged = [
        ...(ownedRes.data?.playlists || []),
        ...(collabRes.data?.playlists || []),
        ...(managedRes.data?.playlists || []),
      ];

      // Remove duplicates by _id
      const uniquePlaylists = Array.from(new Map(merged.map((p) => [p._id, p])).values());
      setUserPlaylists(uniquePlaylists);
    } catch (err) {
      console.error("Failed to load user playlists", err);
    }
  };

  const handleMagicShuffle = () => {
    if (!jamendoTracks || jamendoTracks.length === 0) return;
    
    // Copy and shuffle tracks using Fisher-Yates algorithm
    const shuffled = [...jamendoTracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    if (typeof startQueue === "function") {
      const queueTracks = shuffled.map((t) => ({
        _id: t.id,
        title: t.name,
        artist: t.artist_name,
        audio: t.audio,
        mood: "explore",
        image: t.image
      }));
      startQueue(queueTracks, { type: "explore_shuffle", playlistId: null }, 0);
    }
  };

  // Convert track objects into a unified format for rendering
  const unifyJamendoTrack = (t) => ({
    isJamendo: true,
    id: t.id,
    name: t.name,
    artist_name: t.artist_name,
    audio: t.audio,
    image: t.image,
  });

  const handleLike = async (track) => {
    if (!authToken || activeUser === "guest") {
      alert("Please log in to like songs.");
      return;
    }

    try {
      // Ensure external song exists in DB first
      const normalizedUrl = normalizeAudioUrl(track.audio);
      let songId = likeState[normalizedUrl]?.dbId;

      if (!songId && track.isJamendo) {
        const songRes = await axios.post(
          `${LOCAL_API}/songs/external`,
          {
            title: track.name,
            artist: track.artist_name,
            audio: track.audio,
            mood: "explore",
          },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        songId = songRes.data?.song?._id;
      }

      const response = await axios.post(
        `${LOCAL_API}/songs/${songId}/like`,
        {},
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      // Update state from server response — exactly like Discover page
      setLikeState((prev) => ({
        ...prev,
        [normalizedUrl]: {
          count: response.data.song?.likesCount ?? 0,
          liked: response.data.isLiked,
          dbId: songId,
        },
      }));
    } catch (err) {
      console.error("Like failed", err);
    }
  };

  const openPlaylistModal = (track) => {
    if (!activeUser || activeUser === "guest") {
      alert("Please log in to add songs to your playlists.");
      return;
    }
    setSelectedTrack(track);
    fetchUserPlaylists();
    setShowPlaylistModal(true);
  };

  const closePlaylistModal = () => {
    setShowPlaylistModal(false);
    setSelectedTrack(null);
  };

  const handleAddToPlaylist = async (playlistId) => {
    if (!selectedTrack || !authToken) return;

    try {
      let songId = selectedTrack.id;

      if (selectedTrack.isJamendo) {
        const songRes = await axios.post(
          `${LOCAL_API}/songs/external`,
          {
            title: selectedTrack.name,
            artist: selectedTrack.artist_name,
            audio: selectedTrack.audio,
            mood: "explore",
          },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        songId = songRes.data?.song?._id;
      }

      await axios.post(
        `${LOCAL_API}/playlists/${playlistId}/songs/transfer`,
        { songId },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      alert(`Added "${selectedTrack.name}" to playlist!`);
      closePlaylistModal();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to add song to playlist.");
    }
  };

  const handlePlayExternal = (trackList, track, index) => {
    if (typeof startQueue === "function") {
      const queueTracks = trackList.map((t) => ({
        _id: t.id,
        title: t.name,
        artist: t.artist_name,
        audio: t.audio,
        mood: "explore",
        image: t.image
      }));
      startQueue(queueTracks, { type: "explore", playlistId: null }, index);
    } else {
      window.open(track.audio, "_blank");
    }
  };

  const renderTrackCard = (track, listForQueue, index) => {
    const like = likeState[normalizeAudioUrl(track.audio)] || { count: 0, liked: false };
    return (
      <div className="explore-track-card" key={`${track.id}-${index}`}>
        <div className="explore-track-cover" onClick={() => handlePlayExternal(listForQueue, track, index)}>
          {track.image ? (
            <img src={track.image} alt={track.name} />
          ) : (
            <i className="ri-music-2-fill cover-placeholder"></i>
          )}
        </div>
        
        <div className="explore-track-info" onClick={() => handlePlayExternal(listForQueue, track, index)}>
          <h3 title={track.name}>{track.name}</h3>
          <p title={track.artist_name}>{track.artist_name}</p>
        </div>

        <div className="explore-actions">
          <button 
            className={`explore-action-btn ${like.liked ? "liked" : ""}`}
            onClick={() => handleLike(track)}
            title={like.liked ? "Unlike" : "Like"}
          >
            <i className={like.liked ? "ri-heart-fill" : "ri-heart-line"}></i>
            {like.count > 0 ? <span className="explore-like-count">{like.count}</span> : null}
          </button>
          <button 
            className="explore-action-btn"
            onClick={() => openPlaylistModal(track)}
            title="Add to Playlist"
          >
            <i className="ri-play-list-add-line"></i>
          </button>
        </div>
      </div>
    );
  };

  const unifiedJamendo = jamendoTracks.map(unifyJamendoTrack).sort((a, b) => {
    const likesA = (likeState[normalizeAudioUrl(a.audio)] || {}).count || 0;
    const likesB = (likeState[normalizeAudioUrl(b.audio)] || {}).count || 0;
    if (likesB !== likesA) return likesB - likesA;
    return (a.name || "").localeCompare(b.name || "");
  });

  return (
    <div className="page-shell">
      <div className="explore-page">
        <div className="explore-header">
          <h2>Explore Songs</h2>
          <p>Discover fresh, royalty-free music from independent artists. Like your favorites or add them directly to your playlists.</p>
        </div>

        <div className="explore-search-shell" style={{ display: "flex", gap: "10px", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1 }}>
            <i className="ri-search-line"></i>
            <input 
              type="text" 
              placeholder="Search Jamendo tracks by name or artist..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", border: "none", background: "transparent", color: "var(--text-primary)" }}
            />
          </div>
          <button 
            className="explore-action-btn"
            onClick={handleMagicShuffle}
            title="Magic Shuffle"
            style={{ width: "auto", padding: "0 15px", whiteSpace: "nowrap" }}
          >
            <i className="ri-shuffle-line" style={{ marginRight: "5px" }}></i> Shuffle
          </button>
        </div>

        <div className="explore-section">
          <h3 className="explore-section-header">
            {searchQuery ? "Search Results" : "Trending from Jamendo"}
          </h3>
          {loadingJamendo ? (
            <div className="empty-panel">Loading Jamendo tracks...</div>
          ) : error ? (
            <div className="empty-panel">{error}</div>
          ) : (
            <div className="explore-grid">
              {unifiedJamendo.map((track, idx) => renderTrackCard(track, unifiedJamendo, idx))}
            </div>
          )}
        </div>

      </div>

      {showPlaylistModal && (
        <div className="playlist-modal-overlay" onClick={closePlaylistModal}>
          <div className="playlist-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="playlist-modal-header">
              <h3>Add to Playlist</h3>
              <button className="playlist-modal-close" onClick={closePlaylistModal}>
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="playlist-modal-body">
              {userPlaylists.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  You don't have any playlists yet.
                </div>
              ) : (
                userPlaylists.map((playlist) => (
                  <button
                    key={playlist._id}
                    className="playlist-option"
                    onClick={() => handleAddToPlaylist(playlist._id)}
                  >
                    <span>{playlist.name}</span>
                    <i className="ri-add-line"></i>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
