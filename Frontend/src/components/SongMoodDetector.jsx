import React, { useState } from "react";
import axios from "axios";
import { analyzeAudioMood, deriveTitleFromFile } from "../utils/audioMood";
import "./SongMoodDetector.css";

export default function SongMoodDetector({ onSongAdded, activeUser, authToken }) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [manualMood, setManualMood] = useState("");

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setUploading(true);

    try {
      const detectedMood = await analyzeAudioMood(file);
      const moodToUse = manualMood || detectedMood;
      
      const formData = new FormData();
      const resolvedTitle = title.trim() || deriveTitleFromFile(file);
      const resolvedArtist = artist.trim() || "Unknown";
      const isGuest = !activeUser || activeUser === "guest" || !authToken;

      if (isGuest) {
        const localTempSong = {
          _id: "",
          title: resolvedTitle,
          artist: resolvedArtist,
          mood: moodToUse,
          audio: URL.createObjectURL(file),
          isLocalTemp: true,
        };
        if (onSongAdded) {
          onSongAdded(localTempSong);
        }
        alert(`Guest mode: added temporary song. Mood: ${moodToUse} ${manualMood ? "(Manual)" : "(Detected)"}`);
        return;
      }

      formData.append("audio", file);
      formData.append("title", resolvedTitle);
      formData.append("artist", resolvedArtist);
      formData.append("mood", moodToUse);

      const response = await axios.post("http://localhost:3000/songs", formData, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (onSongAdded && response.data.song) {
        onSongAdded(response.data.song);
      }

      alert(`Song saved! Mood: ${moodToUse} ${manualMood ? "(Manual)" : "(Detected)"}`);
    } catch (error) {
      if (error?.response?.status === 409) {
        const existingSong = error?.response?.data?.song;
        if (onSongAdded && existingSong) {
          onSongAdded(existingSong);
        }
        alert("This song already exists. Added existing song to your mood queue.");
      } else {
        alert(error?.response?.data?.message || "Failed to upload song.");
      }
    } finally {
      setUploading(false);
      setFileName("");
      setTitle("");
      setArtist("");
      setManualMood("");
      e.target.value = "";
    }
  };

  return (
    <div className="song-mood-detector">
      <div className="upload-area">
        <div className="song-metadata">
          <input
            type="text"
            placeholder="Song title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={uploading}
          />
          <input
            type="text"
            placeholder="Artist (optional)"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            disabled={uploading}
          />
          <select 
            value={manualMood} 
            onChange={(e) => setManualMood(e.target.value)}
            disabled={uploading}
            className="manual-mood-select"
          >
            <option value="">Auto-Detect Mood</option>
            <option value="happy">Happy</option>
            <option value="sad">Sad</option>
            <option value="energetic">Energetic</option>
            <option value="calm">Calm</option>
            <option value="romantic">Romantic</option>
            <option value="angry">Angry</option>
            <option value="chill">Chill</option>
          </select>
        </div>
        <input
          type="file"
          id="audio-upload"
          accept="audio/*,audio/mpeg,video/mpeg,.mp3,.mpeg"
          onChange={handleFileUpload}
          disabled={uploading}
          style={{ display: "none" }}
        />
        <label htmlFor="audio-upload" className={`upload-label ${uploading ? "uploading" : ""}`}>
          {uploading ? (
            <>
              <i className="ri-loader-4-line spinning"></i>
              <span>Analyzing {fileName}...</span>
            </>
          ) : fileName ? (
            <>
              <i className="ri-music-2-fill"></i>
              <span>{fileName}</span>
              <small>Click to upload another</small>
            </>
          ) : (
            <>
              <i className="ri-upload-cloud-2-line"></i>
              <span>Click to upload audio file</span>
              <small>MP3, MPEG, WAV supported</small>
            </>
          )}
        </label>
      </div>
    </div>
  );
}
