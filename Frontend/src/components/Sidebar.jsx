import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { NavLink, useLocation } from "react-router-dom";
import "./Sidebar.css";

const API = "http://localhost:3000";

const profileColor = (seed = "U") => {
  const palette = ["#d9dde5", "#bfc6d2", "#f0f2f6", "#9ea7b5", "#cfd5de", "#7f8794"];
  const index = seed.charCodeAt(0) % palette.length;
  return palette[index];
};

function Sidebar({ user, onUserChange, onLogout, mobileOpen = false, onCloseMobile }) {
  const location = useLocation();
  const [openProfile, setOpenProfile] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(user.username || "guest");
  const [displayDraft, setDisplayDraft] = useState(user.displayName || "Guest");
  const [photoFile, setPhotoFile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [socialStats, setSocialStats] = useState({ followersCount: 0, followingCount: 0 });

  const initialLetter = useMemo(
    () => (user.displayName?.trim()?.charAt(0) || user.username?.charAt(0) || "U").toUpperCase(),
    [user.displayName, user.username]
  );
  const isLoggedIn = Boolean(user.username && user.username !== "guest");
  const authToken = localStorage.getItem("moody-auth-token") || "";

  const loadFriends = useCallback(async () => {
    if (!isLoggedIn || !authToken) {
      setFriends([]);
      return;
    }

    try {
      const response = await axios.get(`${API}/social/friends`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      setFriends(response.data.friends || []);
    } catch {
      setFriends([]);
    }
  }, [authToken, isLoggedIn]);

  const openProfileModal = async () => {
    setUsernameDraft(user.username || "guest");
    setDisplayDraft(user.displayName || "Guest");
    setPhotoFile(null);
    setOpenProfile(true);
    if (user.username) {
      await loadFriends();
    }
  };

  const loadSocialStats = useCallback(async () => {
    if (!isLoggedIn || !authToken) {
      setSocialStats({ followersCount: 0, followingCount: 0 });
      return;
    }

    try {
      const response = await axios.get(`${API}/social/stats/${user.username}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      setSocialStats({
        followersCount: response.data.followersCount || 0,
        followingCount: response.data.followingCount || 0,
      });
    } catch {
      setSocialStats({ followersCount: 0, followingCount: friends.length || 0 });
    }
  }, [authToken, friends.length, isLoggedIn, user.username]);

  useEffect(() => {
    if (!isLoggedIn || !authToken) {
      setFriends([]);
      setSocialStats({ followersCount: 0, followingCount: 0 });
      return;
    }

    loadFriends();
    loadSocialStats();
  }, [authToken, isLoggedIn, loadFriends, loadSocialStats, user.username, location.pathname]);

  const handleCloseMobile = () => {
    if (typeof onCloseMobile === "function") {
      onCloseMobile();
    }
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    if (!usernameDraft.trim()) return;

    try {
      const formData = new FormData();
      formData.append("currentUsername", user.username || "guest");
      formData.append("username", usernameDraft.trim().toLowerCase());
      formData.append("displayName", displayDraft.trim());
      if (photoFile) {
        formData.append("profilePhoto", photoFile);
      }

      const response = await axios.put(`${API}/auth/profile`, formData);
      onUserChange(response.data.user);
      setPhotoFile(null);
      setOpenProfile(false);
    } catch (error) {
      alert(error?.response?.data?.message || "Failed to update profile");
    }
  };

  const handleUnfollow = async (targetUsername) => {
    try {
      await axios.post(
        `${API}/social/unfollow/${targetUsername}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      await loadFriends();
      await loadSocialStats();
    } catch {
      alert("Failed to unfollow user");
    }
  };

  return (
    <>
      <div
        className={`sidebar-mobile-backdrop ${mobileOpen ? "is-open" : ""}`}
        onClick={handleCloseMobile}
      />
      <aside className={`left-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-mobile-header">
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={handleCloseMobile}
            aria-label="Close navigation menu"
          >
            <span></span>
            <span></span>
          </button>
        </div>
      <div className="brand-block">
        <h2>Moody</h2>
        <p>Your Music Space</p>
      </div>

      <button type="button" className="profile-entry" onClick={openProfileModal}>
        {user.profilePhoto ? (
          <img src={user.profilePhoto} alt={user.displayName || user.username} className="avatar-photo" />
        ) : (
          <span className="avatar-fallback" style={{ backgroundColor: profileColor(initialLetter) }}>
            {initialLetter}
          </span>
        )}
        <span>
          <strong>{user.displayName || "Guest"}</strong>
          <small>@{user.username || "guest"}</small>
        </span>
      </button>

      <nav className="sidebar-nav">
        <NavLink to="/" onClick={handleCloseMobile}>
          Mood
        </NavLink>
        <NavLink to="/playlists" onClick={handleCloseMobile}>
          Playlists
        </NavLink>
        <NavLink to="/discover" onClick={handleCloseMobile}>
          Discover
        </NavLink>
      </nav>

      <div className="sidebar-bottom">
        {isLoggedIn ? (
          <div className="sidebar-social-summary">
            <div className="sidebar-social-row">
              <span>Followers</span>
              <strong>{socialStats.followersCount}</strong>
            </div>
            <div className="sidebar-social-row">
              <span>Following</span>
              <strong>{socialStats.followingCount}</strong>
            </div>
          </div>
        ) : null}

        <div className="auth-links">
          {!isLoggedIn && (
            <>
              <NavLink to="/login" className="ghost-btn" onClick={handleCloseMobile}>
                Log In
              </NavLink>
              <NavLink to="/signup" className="fill-btn" onClick={handleCloseMobile}>
                Sign Up
              </NavLink>
            </>
          )}
          {isLoggedIn && (
            <button
              type="button"
              className="logout-btn"
              onClick={() => {
                handleCloseMobile();
                onLogout();
              }}
            >
              Log Out
            </button>
          )}
        </div>
      </div>

      {openProfile && (
        <div className="profile-modal-backdrop" onClick={() => setOpenProfile(false)}>
          <div className="profile-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Edit Profile</h3>
            <form className="profile-form" onSubmit={handleSaveProfile}>
              <label>
                Username
                <input
                  type="text"
                  value={usernameDraft}
                  onChange={(event) => setUsernameDraft(event.target.value)}
                  required
                />
              </label>
              <label>
                Name
                <input
                  type="text"
                  value={displayDraft}
                  onChange={(event) => setDisplayDraft(event.target.value)}
                />
              </label>
              <label>
                Profile Photo
                <input type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0])} />
              </label>

              <div className="following-section">
                <h4>Following</h4>
                {friends.length === 0 && <p>No following yet.</p>}
                {friends.map((friend) => (
                  <div className="friend-row" key={friend.username}>
                    <span>
                      {friend.displayName} <small>@{friend.username}</small>
                    </span>
                    <button type="button" onClick={() => handleUnfollow(friend.username)}>
                      Unfollow
                    </button>
                  </div>
                ))}
              </div>

              <div className="profile-actions">
                <button type="button" onClick={() => setOpenProfile(false)}>
                  Cancel
                </button>
                <button type="submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
      </aside>
    </>
  );
}

export default Sidebar;
