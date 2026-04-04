import { useMemo, useState } from "react";
import axios from "axios";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

const API = "http://localhost:3000";

const profileColor = (seed = "U") => {
  const palette = ["#4f46e5", "#db2777", "#0ea5e9", "#16a34a", "#ca8a04", "#7c3aed"];
  const index = seed.charCodeAt(0) % palette.length;
  return palette[index];
};

function Sidebar({ user, onUserChange, onLogout }) {
  const [openProfile, setOpenProfile] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(user.username || "guest");
  const [displayDraft, setDisplayDraft] = useState(user.displayName || "Guest");
  const [photoFile, setPhotoFile] = useState(null);
  const [friends, setFriends] = useState([]);

  const initialLetter = useMemo(
    () => (user.displayName?.trim()?.charAt(0) || user.username?.charAt(0) || "U").toUpperCase(),
    [user.displayName, user.username]
  );
  const isLoggedIn = Boolean(user.username && user.username !== "guest");

  const loadFriends = async () => {
    try {
      const response = await axios.get(`${API}/social/friends`, {
        params: { username: user.username },
      });
      setFriends(response.data.friends || []);
    } catch {
      setFriends([]);
    }
  };

  const openProfileModal = async () => {
    setUsernameDraft(user.username || "guest");
    setDisplayDraft(user.displayName || "Guest");
    setPhotoFile(null);
    setOpenProfile(true);
    if (user.username) {
      await loadFriends();
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
      await axios.post(`${API}/social/unfollow/${targetUsername}`, {
        username: user.username,
      });
      await loadFriends();
    } catch {
      alert("Failed to unfollow user");
    }
  };

  return (
    <aside className="left-sidebar">
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
        <NavLink to="/">Mood</NavLink>
        <NavLink to="/playlists">Playlists</NavLink>
        <NavLink to="/discover">Discover</NavLink>
      </nav>

      <div className="auth-links">
        {!isLoggedIn && (
          <>
            <NavLink to="/login" className="ghost-btn">
              Log In
            </NavLink>
            <NavLink to="/signup" className="fill-btn">
              Sign Up
            </NavLink>
          </>
        )}
        {isLoggedIn && (
          <button type="button" className="logout-btn" onClick={onLogout}>
            Log Out
          </button>
        )}
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
  );
}

export default Sidebar;
