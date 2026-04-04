import React, { useEffect, useMemo, useRef, useState } from "react";
import "./MoodSongs.css";

const QueueList = ({
  songs = [],
  currentIndex = 0,
  isPlaying = false,
  title = "Queue",
  onPlayFromQueue,
  onRemove,
  onDelete,
  onReorder,
  onSongDragStart,
  onSongDragEnd,
  editable = true,
  songMenuActions = [],
}) => {
  const [queue, setQueue] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [localCurrentIndex, setLocalCurrentIndex] = useState(currentIndex);
  const [isDraggingExternal, setIsDraggingExternal] = useState(false);
  const [pendingReorder, setPendingReorder] = useState(null);
  const [openMenuKey, setOpenMenuKey] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    setQueue(songs);
  }, [songs]);

  useEffect(() => {
    setLocalCurrentIndex(currentIndex);
  }, [currentIndex]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuKey("");
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const resolvedMenuActions = useMemo(
    () => songMenuActions.filter((action) => typeof action?.onSelect === "function"),
    [songMenuActions]
  );

  const handleDragStart = (index, event) => {
    setDraggedIndex(index);
    setIsDraggingExternal(false);
    if (onSongDragStart) {
      onSongDragStart(queue[index]);
    }
    event.dataTransfer.effectAllowed = "copyMove";
  };

  const handleDragOver = (event, index) => {
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === index || isDraggingExternal) return;

    const newQueue = [...queue];
    const draggedSong = newQueue[draggedIndex];
    newQueue.splice(draggedIndex, 1);
    newQueue.splice(index, 0, draggedSong);

    let nextIndex = localCurrentIndex;
    if (draggedIndex === localCurrentIndex) {
      nextIndex = index;
    } else if (draggedIndex < localCurrentIndex && index >= localCurrentIndex) {
      nextIndex = localCurrentIndex - 1;
    } else if (draggedIndex > localCurrentIndex && index <= localCurrentIndex) {
      nextIndex = localCurrentIndex + 1;
    }

    setQueue(newQueue);
    setLocalCurrentIndex(nextIndex);
    setDraggedIndex(index);
    setPendingReorder({ queue: newQueue, index: nextIndex });
  };

  const handleDragEnd = () => {
    if (editable && !isDraggingExternal && pendingReorder && onReorder) {
      onReorder(pendingReorder.queue, pendingReorder.index);
    }

    setDraggedIndex(null);
    setIsDraggingExternal(false);
    setPendingReorder(null);

    if (onSongDragEnd) {
      onSongDragEnd();
    }
  };

  const handleDragLeave = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const isLeavingQueue =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (isLeavingQueue && draggedIndex !== null) {
      setIsDraggingExternal(true);
    }
  };

  const handleRemoveFromQueue = (event, index) => {
    event.stopPropagation();
    event.preventDefault();

    const nextQueue = queue.filter((_, i) => i !== index);
    const removedSong = queue[index];

    let nextIndex = localCurrentIndex;
    if (!nextQueue.length) {
      nextIndex = 0;
    } else if (index === localCurrentIndex) {
      nextIndex = index >= nextQueue.length ? 0 : index;
    } else if (index < localCurrentIndex) {
      nextIndex = Math.max(localCurrentIndex - 1, 0);
    }

    setQueue(nextQueue);
    setLocalCurrentIndex(nextIndex);

    if (onRemove) {
      onRemove({ queue: nextQueue, currentIndex: nextIndex, song: removedSong });
    }
  };

  const handleDeleteSong = (event, songId, index) => {
    event.stopPropagation();
    event.preventDefault();

    const removedSong = queue[index];

    if (onDelete) {
      onDelete({ songId, index, song: removedSong });
    }
  };

  const handlePlayFromQueue = (index) => {
    if (onPlayFromQueue) {
      onPlayFromQueue(index);
    }
  };

  const normalizedQuery = searchTerm.trim().toLowerCase();
  const isFiltering = normalizedQuery.length > 0;
  const filteredQueue = queue
    .map((song, index) => ({ song, index }))
    .filter(({ song }) => {
      if (!isFiltering) return true;
      const titleText = song.title?.toLowerCase() || "";
      const artistText = song.artist?.toLowerCase() || "";
      return titleText.includes(normalizedQuery) || artistText.includes(normalizedQuery);
    });

  if (queue.length === 0) {
    return (
      <div className="mood-songs">
        <h2>{title}</h2>
        <p className="empty-state">No songs yet.</p>
      </div>
    );
  }

  return (
    <div className="mood-songs">
      <div className="queue-section">
        <h2>{title}</h2>
        <p className="queue-subtitle">
          {editable ? "Drag to rearrange and tap songs to play" : "Tap songs to play"}
        </p>
        <div className="queue-search">
          <i className="ri-search-line"></i>
          <input
            type="text"
            placeholder="Search by song or artist"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="queue-list" onDragLeave={editable ? handleDragLeave : undefined}>
          {filteredQueue.map(({ song, index }) => {
            const songKey = song._id || `${song.title}-${index}`;
            const menuOpen = openMenuKey === songKey;

            return (
              <div
                key={songKey}
                className={`queue-item ${
                  index === localCurrentIndex ? "active" : ""
                } ${draggedIndex === index ? "dragging" : ""}`}
                draggable={editable && !isFiltering}
                onDragStart={(event) => editable && !isFiltering && handleDragStart(index, event)}
                onDragOver={(event) => editable && !isFiltering && handleDragOver(event, index)}
                onDragEnd={editable ? handleDragEnd : undefined}
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
                  <span className="mood-tag">{song.mood || "unknown"}</span>
                  {resolvedMenuActions.length > 0 ? (
                    <div
                      className="song-menu-wrapper"
                      ref={menuOpen ? menuRef : null}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="queue-action menu"
                        aria-label="Song options"
                        title="Song options"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenuKey((prev) => (prev === songKey ? "" : songKey));
                        }}
                      >
                        <i className="ri-more-2-fill"></i>
                      </button>
                      {menuOpen ? (
                        <div className="song-menu-dropdown">
                          {resolvedMenuActions.map((action) => (
                            <button
                              key={`${songKey}-${action.id}`}
                              type="button"
                              className={`song-menu-item ${action.variant || ""}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenMenuKey("");
                                action.onSelect({ song, index });
                              }}
                            >
                              <span>{action.label}</span>
                              {action.meta ? <small>{action.meta(song)}</small> : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {resolvedMenuActions.length === 0 && editable && (
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
                  )}
                  {resolvedMenuActions.length === 0 && editable && (
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
                  )}
                  {index === localCurrentIndex && isPlaying ? (
                    <i className="ri-music-2-fill playing-indicator"></i>
                  ) : null}
                </div>
              </div>
            );
          })}
          {filteredQueue.length === 0 ? <div className="queue-empty">No songs match your search.</div> : null}
        </div>
      </div>
    </div>
  );
};

export default QueueList;
