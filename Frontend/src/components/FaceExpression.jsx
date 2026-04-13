import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import axios from "axios";
import "./FacialExpression.css";

const normalizeMood = (value = "") => String(value).trim().toLowerCase();

export default function FacialExpression({
  onMoodDetected,
  authToken,
  moodSongs = [],
  moodLibrary = [],
  activeUser,
}) {
  const videoRef = useRef();
  const streamRef = useRef(null);
  const mountedRef = useRef(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const loadModels = async () => {
    const MODEL_URL = "/models";
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    if (mountedRef.current) {
      setModelsReady(true);
    }
  };

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
    }
  };

  const detectMood = async () => {
    if (!modelsReady || detecting || !videoRef.current) {
      return;
    }

    try {
      setDetecting(true);

      const detection = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5,
          })
        )
        .withFaceExpressions();

      if (!detection) {
        alert("No face detected. Please face the camera and try again.");
        return;
      }

      const expressions = detection.expressions;
      const moodScores = {
        angry: expressions.angry || 0,
        sad: expressions.sad || 0,
        happy: expressions.happy || 0,
        surprised: expressions.surprised || 0,
        neutral: (expressions.neutral || 0) + (expressions.disgusted || 0) + (expressions.fearful || 0),
      };

      let detectedMood = "neutral";
      let maxScore = 0;

      for (const [mood, score] of Object.entries(moodScores)) {
        if (score > maxScore) {
          maxScore = score;
          detectedMood = mood;
        }
      }
      console.log("[Mood Detection] Detected mood:", detectedMood, moodScores);

      const sourceSongs = moodLibrary.length ? moodLibrary : moodSongs;
      const localFilteredSongs = (sourceSongs || []).filter(
        (song) => normalizeMood(song.mood) === detectedMood
      );

      try {
        const requestConfig =
          authToken && activeUser && activeUser !== "guest"
            ? { headers: { Authorization: `Bearer ${authToken}` } }
            : {};
        const response = await axios.get(`http://localhost:3000/songs?mood=${detectedMood}`, requestConfig);
        if (onMoodDetected) {
          onMoodDetected(response.data.songs || []);
        }
      } catch (apiError) {
        console.error("Mood fetch failed, using local fallback:", apiError);
        if (onMoodDetected) {
          onMoodDetected(localFilteredSongs);
        }
      }
    } catch (error) {
      console.error("Mood detection failed:", error);
      if (onMoodDetected) {
        onMoodDetected([]);
      }
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    loadModels().then(startVideo);

    return () => {
      mountedRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  return (
    <div className="mood-element">
      <video ref={videoRef} autoPlay muted className="user-video-feed" />
      <button onClick={detectMood} disabled={!modelsReady || detecting}>
        {detecting ? "Detecting..." : "Detect Mood"}
      </button>
    </div>
  );
}
