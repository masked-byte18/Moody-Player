import React, { useState, useRef, useEffect } from "react";
import "./MoodSongs.css";

const MoodSongs = ({ songs = [] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const audioRef = useRef(null);

  const handleRemoveFromQueue = (event, index) => {
    event.stopPropagation();
    event.preventDefault();

    setQueue((prevQueue) => {
      if (!prevQueue.length) return prevQueue;
      const nextQueue = prevQueue.filter((_, i) => i !== index);

      if (!nextQueue.length) {
        setCurrentIndex(0);
        setIsPlaying(false);
        return nextQueue;
      }

      if (index === currentIndex) {
        const nextIndex = index >= nextQueue.length ? 0 : index;
        setCurrentIndex(nextIndex);
      } else if (index < currentIndex) {
        setCurrentIndex((prevIndex) => Math.max(prevIndex - 1, 0));
      }

      return nextQueue;
    });
  };

  const handleDeleteSong = async (event, songId, index) => {
    event.stopPropagation();
    event.preventDefault();

    if (!songId) {
      handleRemoveFromQueue(event, index);
      return;
    }

    const confirmed = window.confirm("Delete this song permanently?");
    if (!confirmed) return;

    try {
      const response = await fetch(`http://localhost:3000/songs/${songId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Delete failed");
      }

      handleRemoveFromQueue(event, index);
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete song.");
    }
  };

  // Reset when new songs loaded
  useEffect(() => {
    if (songs.length > 0) {
      setQueue(songs);
      setCurrentIndex(0);
      setIsPlaying(true);
    }
  }, [songs]);

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

  const normalizedQuery = searchTerm.trim().toLowerCase();
  const isFiltering = normalizedQuery.length > 0;
  const filteredQueue = queue
    .map((song, index) => ({ song, index }))
    .filter(({ song }) => {
      if (!isFiltering) return true;
      const title = song.title?.toLowerCase() || "";
      const artist = song.artist?.toLowerCase() || "";
      return title.includes(normalizedQuery) || artist.includes(normalizedQuery);
    });

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
        <div className="queue-search">
          <i className="ri-search-line"></i>
          <input
            type="text"
            placeholder="Search by song or artist"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="queue-list">
          {filteredQueue.map(({ song, index }) => (
            <div
              key={song._id || `${song.title}-${index}`}
              className={`queue-item ${index === currentIndex ? "active" : ""} ${
                draggedIndex === index ? "dragging" : ""
              }`}
              draggable={!isFiltering}
              onDragStart={() => !isFiltering && handleDragStart(index)}
              onDragOver={(e) => !isFiltering && handleDragOver(e, index)}
              onDragEnd={() => !isFiltering && handleDragEnd()}
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
                <button
                  type="button"
                  className="queue-action remove"
                  onClick={(event) => handleRemoveFromQueue(event, index)}
                  onMouseDown={(event) => event.stopPropagation()}
                  aria-label="Remove from queue"
                  title="Remove from queue"
                >
                  <i className="ri-close-line"></i>
                </button>
                <button
                  type="button"
                  className="queue-action delete"
                  onClick={(event) => handleDeleteSong(event, song._id, index)}
                  onMouseDown={(event) => event.stopPropagation()}
                  aria-label="Delete song"
                  title="Delete song"
                >
                  <i className="ri-delete-bin-6-line"></i>
                </button>
                {index === currentIndex && isPlaying && (
                  <i className="ri-music-2-fill playing-indicator"></i>
                )}
              </div>
            </div>
          ))}
          {filteredQueue.length === 0 && (
            <div className="queue-empty">No songs match your search.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MoodSongs;
