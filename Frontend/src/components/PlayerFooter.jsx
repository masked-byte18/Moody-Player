import React, { useEffect, useRef } from "react";
import "./PlayerFooter.css";

const PlayerFooter = ({
  queue = [],
  currentIndex = 0,
  isPlaying = false,
  onPlayPause,
  onNext,
  onPrevious,
  onStop,
  loopCurrentSong = false,
  onToggleLoop,
}) => {
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying && queue.length > 0) {
      audio.play();
    } else {
      audio.pause();
    }
  }, [isPlaying, queue, currentIndex]);

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (onStop) {
      onStop();
    }
  };

  if (!queue.length) {
    return (
      <div className="player-footer empty">
        <div className="player-track-info">
          <span className="player-title">No song playing</span>
          <span className="player-artist">Start a mood or playlist queue</span>
        </div>
      </div>
    );
  }

  const currentSong = queue[currentIndex] || {};

  return (
    <div className="player-footer">
      <div className="player-track-info">
        <span className="player-title">{currentSong.title}</span>
        <span className="player-artist">{currentSong.artist}</span>
        <span className="player-mood">{currentSong.mood}</span>
      </div>

      <div className="player-controls">
        <button onClick={onPrevious} className="control-btn">
          <i className="ri-skip-back-fill"></i>
        </button>
        <button onClick={onPlayPause} className="control-btn play-btn">
          {isPlaying ? <i className="ri-pause-fill"></i> : <i className="ri-play-fill"></i>}
        </button>
        <button onClick={onNext} className="control-btn">
          <i className="ri-skip-forward-fill"></i>
        </button>
        <button onClick={handleStop} className="control-btn stop-btn">
          <i className="ri-stop-fill"></i>
        </button>
        <button 
          onClick={onToggleLoop} 
          className={`control-btn ${loopCurrentSong ? 'active-loop' : ''}`}
          title={loopCurrentSong ? "Loop: On" : "Loop: Off"}
        >
          <i className="ri-repeat-one-line"></i>
        </button>
      </div>

      <audio
        ref={audioRef}
        src={currentSong.audio}
        onEnded={loopCurrentSong ? () => {
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
          }
        } : onNext}
      />
    </div>
  );
};

export default PlayerFooter;
