import React, { useEffect, useRef, useState } from "react";
import "./PlayerFooter.css";

const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying && queue.length > 0) {
      // Small timeout to handle promise interruption errors smoothly
      setTimeout(() => {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((e) => {
            console.log("Audio play prevented:", e);
          });
        }
      }, 50);
    } else {
      audio.pause();
    }
  }, [isPlaying, queue, currentIndex]);

  const handleTimeUpdate = () => {
    if (!isDragging && audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeekChange = (e) => {
    setCurrentTime(Number(e.target.value));
  };

  const handleSeekEnd = (e) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Number(e.target.value);
    }
    setIsDragging(false);
  };

  const handleSeekStart = () => {
    setIsDragging(true);
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
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
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="player-footer">
      <div className="player-timeline-container">
        <span className="player-time current">{formatTime(currentTime)}</span>
        <div className="player-timeline-wrapper">
          <input
            type="range"
            className="player-timeline-slider"
            min="0"
            max={duration || 0}
            value={currentTime}
            onMouseDown={handleSeekStart}
            onTouchStart={handleSeekStart}
            onChange={handleSeekChange}
            onMouseUp={handleSeekEnd}
            onTouchEnd={handleSeekEnd}
            style={{
              background: `linear-gradient(to right, var(--primary) ${progressPercent}%, var(--surface-3) ${progressPercent}%)`
            }}
          />
        </div>
        <span className="player-time duration">{formatTime(duration)}</span>
      </div>

      <div className="player-main-content">
        <div className="player-track-info">
          <span className="player-title">{currentSong.title}</span>
          <span className="player-artist">{currentSong.artist}</span>
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
        
        {/* Empty div for flexbox balancing on desktop */}
        <div className="player-spacer"></div>
      </div>

      <audio
        ref={audioRef}
        src={currentSong.audio}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
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
