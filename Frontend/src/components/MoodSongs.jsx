import React, { useState, useRef, useEffect } from "react";
import "./MoodSongs.css";

const MoodSongs = ({ Songs, songsVersion }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const audioRef = useRef(null);

  // Reset when new songs loaded (songsVersion changes)
  useEffect(() => {
    if (Songs.length > 0) {
      setQueue(Songs);
      setCurrentIndex(0);
      setIsPlaying(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songsVersion]);

  // Auto-play when currentIndex changes
  useEffect(() => {
    if (isPlaying && audioRef.current && queue.length > 0) {
      audioRef.current.play();
    }
  }, [currentIndex, isPlaying, queue]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleNext = () => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Loop back to first song
      setCurrentIndex(0);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      // Loop to last song
      setCurrentIndex(queue.length - 1);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const handleSongEnd = () => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Loop back to first song
      setCurrentIndex(0);
    }
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newQueue = [...queue];
    const draggedSong = newQueue[draggedIndex];
    newQueue.splice(draggedIndex, 1);
    newQueue.splice(index, 0, draggedSong);

    // Adjust currentIndex if needed
    if (draggedIndex === currentIndex) {
      setCurrentIndex(index);
    } else if (draggedIndex < currentIndex && index >= currentIndex) {
      setCurrentIndex(currentIndex - 1);
    } else if (draggedIndex > currentIndex && index <= currentIndex) {
      setCurrentIndex(currentIndex + 1);
    }

    setQueue(newQueue);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handlePlayFromQueue = (index) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  if (queue.length === 0) {
    return (
      <div className="mood-songs">
        <h2>🎵 Mood Player</h2>
        <p className="empty-state">Detect your mood to get song recommendations!</p>
      </div>
    );
  }

  return (
    <div className="mood-songs">
      {/* Currently Playing Section */}
      <div className="currently-playing-section">
        <h2>🎵 Currently Playing</h2>
        <div className="now-playing-card">
          <div className="album-art">
            <div className="music-icon">🎵</div>
          </div>
          <div className="track-info">
            <h3>{queue[currentIndex]?.title}</h3>
            <p>{queue[currentIndex]?.artist}</p>
            <span className="mood-badge">{queue[currentIndex]?.mood}</span>
          </div>
          <audio
            ref={audioRef}
            src={queue[currentIndex]?.audio}
            onEnded={handleSongEnd}
          />
        </div>

        {/* Playback Controls */}
        <div className="playback-controls">
          <button onClick={handlePrevious} className="control-btn">
            <i className="ri-skip-back-fill"></i>
          </button>
          <button onClick={handlePlayPause} className="control-btn play-btn">
            {isPlaying ? (
              <i className="ri-pause-fill"></i>
            ) : (
              <i className="ri-play-fill"></i>
            )}
          </button>
          <button onClick={handleNext} className="control-btn">
            <i className="ri-skip-forward-fill"></i>
          </button>
          <button onClick={handleStop} className="control-btn stop-btn">
            <i className="ri-stop-fill"></i>
          </button>
        </div>
      </div>

      {/* Queue Section */}
      <div className="queue-section">
        <h2>📋 Queue</h2>
        <p className="queue-subtitle">Drag to rearrange • Click to play</p>
        <div className="queue-list">
          {queue.map((song, index) => (
            <div
              key={index}
              className={`queue-item ${index === currentIndex ? "active" : ""} ${
                draggedIndex === index ? "dragging" : ""
              }`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => handlePlayFromQueue(index)}
            >
              <div className="queue-item-left">
                <span className="queue-number">{index + 1}</span>
                <div className="queue-item-info">
                  <h4>{song.title}</h4>
                  <p>{song.artist}</p>
                </div>
              </div>
              <div className="queue-item-right">
                <span className="mood-tag">{song.mood}</span>
                {index === currentIndex && isPlaying && (
                  <i className="ri-music-2-fill playing-indicator"></i>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MoodSongs;
