import { useMemo } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getDummyPlaylistById } from "../data/discoverDummyData";
import { getContributionActivity, getPlaylistDraft } from "../utils/collaborationInbox";
import "./NotificationsPage.css";

const formatRelativeTime = (value) => {
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffMinutes < 1440) return `${Math.round(diffMinutes / 60)} hr ago`;
  return `${Math.round(diffMinutes / 1440)} day ago`;
};

function PlaylistActivityPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const playlistName = useMemo(() => {
    const stateName = location.state?.playlistName;
    if (stateName) return stateName;
    const draft = getPlaylistDraft(id);
    if (draft?.name) return draft.name;
    const dummy = getDummyPlaylistById(id);
    if (dummy?.name) return dummy.name;
    return "Playlist Activity";
  }, [id, location.state]);

  const activityFeed = useMemo(() => {
    return [...getContributionActivity(id)].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  }, [id]);

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
                  <p>{entry.text}</p>
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

