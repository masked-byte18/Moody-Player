import React, { useRef, useEffect } from "react";
import * as faceapi from "face-api.js";
import "./FacialExpression.css"
import axios from 'axios';

export default function FacialExpression({setSongs}) {
  const videoRef = useRef();

      const loadModels = async () => {
      const MODEL_URL = "/models";

      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    };

    // 🎥 Start Webcam
    const startVideo = () => {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          videoRef.current.srcObject = stream;
        })
        .catch((err) => console.error("Error accessing webcam : ", err));
    };

   async function detectMood(){
        const detections = await faceapi
          .detectAllFaces(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions(),
          )
          .withFaceExpressions();

        if (!detections || detections.length == 0) {
          console.log("No face detected");
          return;
        }

        const expressions = detections[0].expressions;
        
        // Map face-api expressions to 5 moods: angry, sad, happy, surprised, neutral
        const moodScores = {
          angry: expressions.angry || 0,
          sad: expressions.sad || 0,
          happy: expressions.happy || 0,
          surprised: expressions.surprised || 0,
          neutral: (expressions.neutral || 0) + (expressions.disgusted || 0) + (expressions.fearful || 0)
        };

        let detectedMood = "neutral";
        let maxScore = 0;
        for (const [mood, score] of Object.entries(moodScores)) {
          if (score > maxScore) {
            maxScore = score;
            detectedMood = mood;
          }
        }
        
        console.log("Detected mood:", detectedMood, moodScores);
        
        // get http://localhost:3000/songs?mood=happy
        axios.get(`http://localhost:3000/songs?mood=${detectedMood}`).then(response=>{
          console.log(response.data);
          setSongs(response.data.songs);
        })
    }

  // 🎯 Load AI models
  useEffect(() => {

    loadModels().then(startVideo);

  }, []);

  return (
    <div className="mood-element">
      <video
        ref={videoRef}
        autoPlay
        muted
        className="user-video-feed"
      />
      <button onClick={detectMood}>
        Detect Mood
      </button>
    </div>
  );
}
