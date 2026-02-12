import { useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import "./App.css";
import MoodPage from "./components/MoodPage";
import PlaylistsPage from "./components/PlaylistsPage";
import PlayerFooter from "./components/PlayerFooter";

function App() {
  const [moodSongs, setMoodSongs] = useState([]);
  const [queue, setQueue] = useState([]);
  const [queueSource, setQueueSource] = useState({ type: "mood", playlistId: null });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopCurrentSong, setLoopCurrentSong] = useState(false);

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

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🎵 Moody Player</h1>
        <p>AI-Powered Music Based on Your Mood</p>
        <nav className="app-nav">
          <NavLink to="/">Mood</NavLink>
          <NavLink to="/playlists">Playlists</NavLink>
        </nav>
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
            />
          }
        />
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
  );
}

export default App;
