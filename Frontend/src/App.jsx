import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import "./App.css";
import MoodPage from "./components/MoodPage";
import PlaylistPage from "./components/PlaylistPage";
import PlaylistsPage from "./components/PlaylistsPage";
import FeaturedHubPage from "./components/FeaturedHubPage";
import PlayerFooter from "./components/PlayerFooter";
import Sidebar from "./components/Sidebar";
import ThemeSwitcher from "./components/ThemeSwitcher";
import LoginPage from "./components/LoginPage";
import SignupPage from "./components/SignupPage";

function App() {
  const [userState, setUserState] = useState(() => ({
    username: localStorage.getItem("moody-active-user") || "guest",
    displayName: localStorage.getItem("moody-display-name") || "Guest",
    profilePhoto: localStorage.getItem("moody-profile-photo") || "",
    token: localStorage.getItem("moody-auth-token") || "",
  }));
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("moody-theme");
    return stored === "charcoal" || stored === "deepblue" ? stored : "charcoal";
  });
  const [moodSongs, setMoodSongs] = useState([]);
  const [queue, setQueue] = useState([]);
  const [queueSource, setQueueSource] = useState({ type: "mood", playlistId: null });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopCurrentSong, setLoopCurrentSong] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const startQueue = (songs, source, index = 0) => {
    setQueue(songs);
    setQueueSource(source);
    setCurrentIndex(index);
    setIsPlaying(songs.length > 0);
  };

  const handleMoodDetected = (songs) => {
    setMoodSongs(songs);
    startQueue(songs, { type: "mood", playlistId: null }, 0);
  };

  const handleSongAdded = (song) => {
    const nextSongs = [...moodSongs, song];
    setMoodSongs(nextSongs);
    startQueue(nextSongs, { type: "mood", playlistId: null }, nextSongs.length - 1);
  };

  const handlePlayFromMood = (index) => {
    startQueue(moodSongs, { type: "mood", playlistId: null }, index);
  };

  const handleRemoveFromMood = ({ queue: nextQueue, currentIndex: nextIndex }) => {
    setMoodSongs(nextQueue);
    if (queueSource.type === "mood") {
      setQueue(nextQueue);
      setCurrentIndex(nextIndex);
      setIsPlaying(nextQueue.length > 0 && isPlaying);
    }
  };

  const handleDeleteFromMood = async ({ songId, index }) => {
    if (!songId) return;
    const confirmed = window.confirm("Delete this song permanently?");
    if (!confirmed) return;

    try {
      const response = await fetch(`http://localhost:3000/songs/${songId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Delete failed");
      }

      const nextQueue = moodSongs.filter((_, i) => i !== index);
      let nextIndex = currentIndex;
      if (!nextQueue.length) {
        nextIndex = 0;
      } else if (index === currentIndex) {
        nextIndex = index >= nextQueue.length ? 0 : index;
      } else if (index < currentIndex) {
        nextIndex = Math.max(currentIndex - 1, 0);
      }
      handleRemoveFromMood({ queue: nextQueue, currentIndex: nextIndex });
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete song.");
    }
  };

  const handlePlayPlaylist = (playlist, index = 0) => {
    startQueue(playlist.songs || [], { type: "playlist", playlistId: playlist._id }, index);
  };

  const handleUpdateActivePlaylist = (playlist, nextIndex = currentIndex) => {
    if (queueSource.type !== "playlist" || queueSource.playlistId !== playlist._id) return;
    setQueue(playlist.songs || []);
    setCurrentIndex(Math.max(0, Math.min(nextIndex, (playlist.songs || []).length - 1)));
    setIsPlaying((playlist.songs || []).length > 0 && isPlaying);
  };

  const handlePlayPause = () => {
    if (!queue.length) return;
    setIsPlaying((prev) => !prev);
  };

  const handleNext = () => {
    if (!queue.length) return;
    const nextIndex = (currentIndex + 1) % queue.length;
    setCurrentIndex(nextIndex);
    setIsPlaying(true);
  };

  const handlePrevious = () => {
    if (!queue.length) return;
    setCurrentIndex((prev) => (prev - 1 + queue.length) % queue.length);
    setIsPlaying(true);
  };

  const handleStop = () => {
    setIsPlaying(false);
  };

  const handleToggleLoop = () => {
    setLoopCurrentSong((prev) => !prev);
  };

  const handleUserStateChange = (nextUser) => {
    const normalized = (nextUser?.username || "guest").trim().toLowerCase() || "guest";
    const nextDisplayName = (nextUser?.displayName || normalized).trim() || normalized;
    const nextProfilePhoto = nextUser?.profilePhoto || "";
    const nextToken = nextUser?.token || "";

    const merged = {
      username: normalized,
      displayName: nextDisplayName,
      profilePhoto: nextProfilePhoto,
      token: nextToken,
    };

    setUserState(merged);
    localStorage.setItem("moody-active-user", merged.username);
    localStorage.setItem("moody-display-name", merged.displayName);
    localStorage.setItem("moody-profile-photo", merged.profilePhoto);
    if (merged.token) {
      localStorage.setItem("moody-auth-token", merged.token);
    } else {
      localStorage.removeItem("moody-auth-token");
    }
  };

  const handleLogout = () => {
    const guest = {
      username: "guest",
      displayName: "Guest",
      profilePhoto: "",
      token: "",
    };
    setUserState(guest);
    localStorage.setItem("moody-active-user", guest.username);
    localStorage.setItem("moody-display-name", guest.displayName);
    localStorage.setItem("moody-profile-photo", "");
    localStorage.removeItem("moody-auth-token");
    setMobileSidebarOpen(false);
  };

  const handleThemeToggle = () => {
    const options = ["charcoal", "deepblue"];
    const index = options.indexOf(theme);
    const next = options[(Math.max(index, 0) + 1) % options.length];
    setTheme(next);
    localStorage.setItem("moody-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  if (document.documentElement.getAttribute("data-theme") !== theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  return (
    <div className="app-layout">
      <Sidebar
        user={userState}
        onUserChange={handleUserStateChange}
        onLogout={handleLogout}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="app-main">
        <header className="app-topbar">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div>
            <h1>Moody Player</h1>
            <p>Emotion-aware music with social discovery</p>
          </div>
          <ThemeSwitcher theme={theme} onToggleTheme={handleThemeToggle} />
        </header>

        <Routes>
        <Route
          path="/"
          element={
            <MoodPage
              moodSongs={moodSongs}
              onSongAdded={handleSongAdded}
              onMoodDetected={handleMoodDetected}
              onPlayFromMood={handlePlayFromMood}
              onRemoveFromMood={handleRemoveFromMood}
              onDeleteFromMood={handleDeleteFromMood}
              currentIndex={queueSource.type === "mood" ? currentIndex : -1}
              isPlaying={queueSource.type === "mood" ? isPlaying : false}
              queue={queue}
              queueSource={queueSource}
              onPlayPause={handlePlayPause}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onStop={handleStop}
              loopCurrentSong={loopCurrentSong}
              onToggleLoop={handleToggleLoop}
            />
          }
        />
        <Route
          path="/playlists"
          element={
            <PlaylistsPage
              activePlaylistId={queueSource.playlistId}
              queue={queue}
              queueSource={queueSource}
              isPlaying={isPlaying}
              currentIndex={currentIndex}
              onPlayPlaylist={handlePlayPlaylist}
              onPlayPause={handlePlayPause}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onStop={handleStop}
              onUpdateActivePlaylist={handleUpdateActivePlaylist}
              loopCurrentSong={loopCurrentSong}
              onToggleLoop={handleToggleLoop}
              activeUser={userState.username}
              activeDisplayName={userState.displayName}
              authToken={userState.token}
            />
          }
        />
        <Route
          path="/playlists/:id"
          element={
            <PlaylistPage
              activePlaylistId={queueSource.playlistId}
              queue={queue}
              queueSource={queueSource}
              isPlaying={isPlaying}
              currentIndex={currentIndex}
              onPlayPlaylist={handlePlayPlaylist}
              onPlayPause={handlePlayPause}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onStop={handleStop}
              onUpdateActivePlaylist={handleUpdateActivePlaylist}
              loopCurrentSong={loopCurrentSong}
              onToggleLoop={handleToggleLoop}
              activeUser={userState.username}
              authToken={userState.token}
            />
          }
        />
        <Route
          path="/discover"
          element={
            <FeaturedHubPage
              queue={queue}
              queueSource={queueSource}
              isPlaying={isPlaying}
              currentIndex={currentIndex}
              onPlayPlaylist={handlePlayPlaylist}
              onPlayPause={handlePlayPause}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onStop={handleStop}
              loopCurrentSong={loopCurrentSong}
              onToggleLoop={handleToggleLoop}
              activeUser={userState.username}
              activeDisplayName={userState.displayName}
              authToken={userState.token}
            />
          }
        />
        <Route path="/login" element={<LoginPage onAuthSuccess={handleUserStateChange} />} />
        <Route path="/signup" element={<SignupPage onAuthSuccess={handleUserStateChange} />} />
        </Routes>

        <PlayerFooter
          queue={queue}
          currentIndex={currentIndex}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onStop={handleStop}
          loopCurrentSong={loopCurrentSong}
          onToggleLoop={handleToggleLoop}
        />
      </div>
    </div>
  );
}

export default App;
