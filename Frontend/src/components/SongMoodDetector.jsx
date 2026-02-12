import React, { useState } from "react";
import axios from "axios";
import { analyzeAudioMood, deriveTitleFromFile } from "../utils/audioMood";
import "./SongMoodDetector.css";

export default function SongMoodDetector({ onSongAdded }) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setUploading(true);

    const mood = await analyzeAudioMood(file);

    // 📡 Send to backend to store
    const formData = new FormData();
    const resolvedTitle = title.trim() || deriveTitleFromFile(file);
    const resolvedArtist = artist.trim() || "Unknown";
    formData.append("audio", file);
    formData.append("title", resolvedTitle);
    formData.append("artist", resolvedArtist);
    formData.append("mood", mood);

    await axios.post("http://localhost:3000/songs", formData).then(response => {
      if (onSongAdded && response.data.song) {
        onSongAdded(response.data.song);
      }
    });

    setUploading(false);
    alert(`Song analyzed and saved! Mood: ${mood}`);
    setFileName("");
    setTitle("");
    setArtist("");
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
