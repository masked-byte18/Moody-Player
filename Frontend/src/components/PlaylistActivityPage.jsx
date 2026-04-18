import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getDummyPlaylistById } from "../data/discoverDummyData";
import { getContributionActivity, getPlaylistDraft } from "../utils/collaborationInbox";
import "./NotificationsPage.css";

const API = "http://localhost:3000";

const formatRelativeTime = (value) => {
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffMinutes < 1440) return `${Math.round(diffMinutes / 60)} hr ago`;
  return `${Math.round(diffMinutes / 1440)} day ago`;
};

const stripByNotation = (value = "") => value.replace(/\s+by\s+[^.]+\.?$/i, ".").trim();

const normalizeActivityEntry = (entry) => {
  const rawPlaylistId =
    typeof entry?.playlist === "string"
      ? entry.playlist
      : entry?.playlist?._id || entry?.playlistId || "";

  return {
    ...entry,
    id: entry?._id || entry?.id || "",
    playlistId: String(rawPlaylistId || ""),
  };
};

function PlaylistActivityPage({ authToken }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [activityFeed, setActivityFeed] = useState([]);

  const loadActivity = useCallback(async () => {
    if (!id) {
      setActivityFeed([]);
      return;
    }

    if (!authToken) {
      setActivityFeed(
        [...getContributionActivity(id)].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
      );
      return;
    }

    try {
      const response = await axios.get(`${API}/playlists/${id}/activity`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const normalized = (response.data?.activities || [])
        .map(normalizeActivityEntry)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
      setActivityFeed(normalized);
    } catch (error) {
      console.error("Failed to load playlist activity:", error);
      setActivityFeed(
        [...getContributionActivity(id)].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
      );
    }
  }, [authToken, id]);

  const playlistName = useMemo(() => {
    const stateName = location.state?.playlistName;
    if (stateName) return stateName;
    const draft = getPlaylistDraft(id);
    if (draft?.name) return draft.name;
    const dummy = getDummyPlaylistById(id);
    if (dummy?.name) return dummy.name;
    return "Playlist Activity";
  }, [id, location.state]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      loadActivity();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [loadActivity]);

  useEffect(() => {
    if (!authToken) return undefined;

    const intervalId = window.setInterval(() => {
      loadActivity();
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [authToken, loadActivity]);

  return (
    <div className="page-shell">
      <div className="notifications-page">
        <section className="notifications-hero">
          <div>
            <h2>{playlistName}</h2>
            <p>Track contributor actions on this playlist in one focused activity view.</p>
          </div>
          <div className="notifications-meta">
            <span>{activityFeed.length} activity item(s)</span>
            <span>Live playlist analytics</span>
          </div>
        </section>

        <div className="activity-page-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate("/notifications", { state: { activeTab: "contributors", contributorView: "activity" } })}>
            Back To Contributors
          </button>
          <Link className="btn-primary activity-open-playlist" to={`/playlists/${id}`} state={location.state?.playlistData ? { playlistData: location.state.playlistData, source: "discover", ownerUsername: location.state.ownerUsername, ownerDisplayName: location.state.ownerDisplayName } : undefined}>
            Open Playlist
          </Link>
        </div>

        <section className="notifications-panel">
          {activityFeed.length === 0 ? (
            <div className="notifications-empty-card">
              <p>No contributor activity tracked for this playlist yet.</p>
            </div>
          ) : (
            activityFeed.map((entry) => (
              <article key={entry.id} className={`notification-card analytics-card analytics-${entry.type}`}>
                <div className="notification-avatar">
                  {(entry.actorDisplayName || entry.actorUsername || "U").charAt(0).toUpperCase()}
                </div>
                <div className="notification-copy">
                  <div className="notification-management-header">
                    <div className="notification-management-meta">
                      <div className="notification-topline">
                        <strong>{entry.actorDisplayName || entry.actorUsername}</strong>
                        <span
                          className={`notification-type ${
                            entry.type === "add_song"
                              ? "is-accepted"
                              : entry.type === "delete_song" || entry.type === "remove_song"
                                ? "is-rejected"
                                : "is-update"
                          }`}
                        >
                          {entry.type === "add_song"
                            ? "Added"
                            : entry.type === "delete_song"
                              ? "Deleted"
                              : entry.type === "remove_song"
                                ? "Removed"
                                : "Updated"}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="notification-username notification-username-link"
                        onClick={() => navigate(`/discover/users/${entry.actorUsername}`)}
                      >
                        @{entry.actorUsername}
                      </button>
                    </div>
                  </div>
                  <p>{stripByNotation(entry.text)}</p>
                </div>
                <time>{formatRelativeTime(entry.createdAt)}</time>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

export default PlaylistActivityPage;
