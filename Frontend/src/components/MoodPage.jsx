import React from "react";
import FacialExpression from "./FaceExpression";
import SongMoodDetector from "./SongMoodDetector";
import QueueList from "./QueueList";
import "./MoodSongs.css";

const MoodPage = ({
  moodSongs,
  onSongAdded,
  onMoodDetected,
  onPlayFromMood,
  onRemoveFromMood,
  onDeleteFromMood,
  currentIndex,
  isPlaying,
  queue,
  queueSource,
  onPlayPause,
  onNext,
  onPrevious,
  onStop,
  loopCurrentSong,
  onToggleLoop,
}) => {
  const isMoodQueue = queueSource?.type === "mood";
  const currentSong = isMoodQueue && queue[currentIndex];

  return (
    <div className="app-content">
      <div className="controls-section">
        <div className="upload-section">
          <h3>Upload & Analyze Song</h3>
          <SongMoodDetector onSongAdded={onSongAdded} />
        </div>

        <div className="mood-detection-section">
          <h3>Detect Your Mood</h3>
          <FacialExpression onMoodDetected={onMoodDetected} />
        </div>
      </div>

      <div className="player-section">
        <div className="mood-songs">
          <h2>Mood Queue</h2>

          {/* Currently Playing Section */}
          <div className="currently-playing-section">
            <h3>Currently Playing</h3>
            {currentSong ? (
              <>
                <div className="now-playing-card">
                  <div className="album-art">
                    <i className="ri-music-2-fill music-icon"></i>
                  </div>
                  <div className="track-info">
                    <h3>{currentSong.title}</h3>
                    <p>{currentSong.artist}</p>
                    {currentSong.mood && (
                      <span className="mood-badge">{currentSong.mood}</span>
                    )}
                  </div>
                </div>
                <div className="playback-controls">
                  <button
                    type="button"
                    className="control-btn"
                    onClick={onPrevious}
                    disabled={!isMoodQueue || queue.length === 0}
                  >
                    <i className="ri-skip-back-fill"></i>
                  </button>
                  <button
                    type="button"
                    className="control-btn play-btn"
                    onClick={onPlayPause}
                    disabled={!isMoodQueue || queue.length === 0}
                  >
                    {isPlaying ? (
                      <i className="ri-pause-fill"></i>
                    ) : (
                      <i className="ri-play-fill"></i>
                    )}
                  </button>
                  <button
                    type="button"
                    className="control-btn"
                    onClick={onNext}
                    disabled={!isMoodQueue || queue.length === 0}
                  >
                    <i className="ri-skip-forward-fill"></i>
                  </button>
                  <button
                    type="button"
                    className="control-btn stop-btn"
                    onClick={onStop}
                    disabled={!isMoodQueue || queue.length === 0}
                  >
                    <i className="ri-stop-fill"></i>
                  </button>
                  <button
                    type="button"
                    className={`control-btn ${loopCurrentSong ? 'active-loop' : ''}`}
                    onClick={onToggleLoop}
                    disabled={!isMoodQueue || queue.length === 0}
                    title={loopCurrentSong ? "Loop: On" : "Loop: Off"}
                  >
                    <i className="ri-repeat-one-line"></i>
                  </button>
                </div>
              </>
            ) : (
              <p className="empty-state">
                {moodSongs.length === 0
                  ? "No songs detected yet. Upload a song or detect your mood to get started."
                  : "Click on a song to start playing."}
              </p>
            )}
          </div>

          <div className="queue-section">
            <QueueList
              title="Queue"
              songs={moodSongs}
              currentIndex={currentIndex}
              isPlaying={isPlaying}
              onPlayFromQueue={onPlayFromMood}
              onRemove={onRemoveFromMood}
              onDelete={onDeleteFromMood}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoodPage;
