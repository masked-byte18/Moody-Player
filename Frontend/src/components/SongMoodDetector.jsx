import React, { useState } from "react";
import axios from "axios";
import EssentiaExtractor from "essentia.js/dist/essentia.js-extractor.es.js";
import EssentiaWASM from "essentia.js/dist/essentia-wasm.web.js";
import essentiaWasmUrl from "essentia.js/dist/essentia-wasm.web.wasm?url";
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

    let mood = "unknown";

    try {
      // 🎧 Load audio file for analysis
      const audioContext = new AudioContext();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // 🧠 Initialize Essentia
      const essentiaWasm =
        typeof EssentiaWASM === "function"
          ? await EssentiaWASM({ locateFile: () => essentiaWasmUrl })
          : EssentiaWASM;
      const essentia = new EssentiaExtractor(essentiaWasm);

      // Convert to mono channel data
      const audioData = essentia.audioBufferToMonoSignal(audioBuffer);
      const audioVector = essentia.arrayToVector(audioData);

      // 🎵 Extract features
      let sumSquares = 0;
      let zeroCrossings = 0;
      for (let i = 0; i < audioData.length; i += 1) {
        const value = audioData[i];
        sumSquares += value * value;
        if (i > 0) {
          const prev = audioData[i - 1];
          if ((prev >= 0 && value < 0) || (prev < 0 && value >= 0)) {
            zeroCrossings += 1;
          }
        }
      }
      const rms = Math.sqrt(sumSquares / audioData.length);
      const zcr = zeroCrossings / Math.max(1, audioData.length - 1);
      const spectralCentroid = essentia.SpectralCentroidTime(
        audioVector,
        audioBuffer.sampleRate
      ).centroid;
      const beatData = essentia.BeatTrackerDegara(audioVector);
      const ticksRaw = beatData?.ticks;
      const ticks = Array.isArray(ticksRaw)
        ? ticksRaw
        : ticksRaw instanceof Float32Array
        ? Array.from(ticksRaw)
        : ticksRaw
        ? Array.from(essentia.vectorToArray(ticksRaw))
        : [];
      const bpm = (() => {
        if (!ticks || ticks.length < 2) return null;
        const diffs = ticks
          .slice(1)
          .map((tick, index) => tick - ticks[index])
          .filter((value) => value > 0.2 && value < 2.0);
        if (!diffs.length) return null;
        const sorted = diffs.slice().sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        return Math.round(60 / median);
      })();

      console.log("RMS:", rms);
      console.log("ZCR:", zcr);
      console.log("Spectral Centroid:", spectralCentroid);
      console.log("BPM:", bpm);

      // 🎯 Mood Mapping Logic: happy = sad = neutral > surprised > angry
      const scores = {
        angry: 0,
        sad: 0,
        happy: 0,
        surprised: 0,
        neutral: 0,
      };

      // BPM scoring (prioritize happy, sad, neutral)
      if (bpm !== null) {
        if (bpm >= 160) scores.angry += 1;
        if (bpm >= 130 && bpm < 160) scores.surprised += 2;
        if (bpm >= 100 && bpm < 130) scores.happy += 3;
        if (bpm >= 75 && bpm < 100) scores.neutral += 3;
        if (bpm < 75) scores.sad += 3;
      }

      // RMS (loudness) scoring (prioritize happy, sad, neutral)
      if (rms >= 0.18) scores.angry += 1;
      if (rms >= 0.13 && rms < 0.18) scores.surprised += 2;
      if (rms >= 0.09 && rms < 0.13) scores.happy += 3;
      if (rms >= 0.06 && rms < 0.09) scores.neutral += 3;
      if (rms < 0.06) scores.sad += 3;

      // Spectral Centroid (brightness) scoring (prioritize happy, sad, neutral)
      if (spectralCentroid >= 2700) scores.angry += 1;
      if (spectralCentroid >= 2100 && spectralCentroid < 2700)
        scores.surprised += 2;
      if (spectralCentroid >= 1600 && spectralCentroid < 2100) scores.happy += 3;
      if (spectralCentroid >= 1200 && spectralCentroid < 1600)
        scores.neutral += 3;
      if (spectralCentroid < 1200) scores.sad += 3;

      // Zero-crossing rate (roughness)
      if (zcr >= 0.13) scores.angry += 1;
      if (zcr >= 0.09 && zcr < 0.13) {
        scores.surprised += 1;
        scores.happy += 1;
      }
      if (zcr >= 0.06 && zcr < 0.09) scores.neutral += 1;
      if (zcr < 0.06) scores.sad += 1;

      // Determine mood: if sad+angry combined > highest individual, prioritize sad
      const sadAngryTotal = scores.sad + scores.angry;
      const maxIndividualScore = Math.max(...Object.values(scores));
      
      if (sadAngryTotal > maxIndividualScore) {
        mood = 'sad';
      } else {
        let candidates = Object.entries(scores).filter(([, score]) => score === maxIndividualScore);
        
        if (candidates.length > 1) {
          const moodNames = candidates.map(([moodName]) => moodName);
          if (moodNames.includes('sad') && moodNames.includes('angry')) {
            mood = 'sad';
          } else {
            mood = candidates[0][0];
          }
        } else {
          mood = candidates[0][0];
        }
      }

      console.log("Detected Mood:", mood, scores);
    } catch (error) {
      console.warn("Audio decode failed, uploading without analysis:", error);
    }

    // 📡 Send to backend to store
    const formData = new FormData();
    const resolvedTitle = title.trim() || file.name;
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
