import { useState } from "react";
import "./App.css";
import FacialExpression from "./components/FaceExpression";
import MoodSongs from "./components/MoodSongs";
import SongMoodDetector from "./components/SongMoodDetector";

function App() {
  const [songs, setSongs] = useState([]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🎵 Moody Player</h1>
        <p>AI-Powered Music Based on Your Mood</p>
      </header>

      <div className="app-content">
        <div className="controls-section">
          <div className="upload-section">
            <h3>📤 Upload & Analyze Song</h3>
            <SongMoodDetector />
          </div>

          <div className="mood-detection-section">
            <h3>😊 Detect Your Mood</h3>
            <FacialExpression setSongs={setSongs} />
          </div>
        </div>

        <div className="player-section">
          <MoodSongs Songs={songs} songsVersion={songs.length > 0 ? songs[0]?.title : 0} />
        </div>
      </div>
    </div>
  );
}

export default App;
