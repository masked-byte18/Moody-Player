import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ensureDummyCollaborationRequests,
  getCollaborationAccessMap,
  getCollaborationRequests,
  getContributionActivity,
  getInboxRequestsForUser,
} from "../utils/collaborationInbox";
import { getDummyFriendNotifications, getDummyFriendsList } from "../utils/notificationSamples";
import "./NotificationsPage.css";

const API = "http://localhost:3000";

const formatRelativeTime = (value) => {
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffMinutes < 1440) return `${Math.round(diffMinutes / 60)} hr ago`;
  return `${Math.round(diffMinutes / 1440)} day ago`;
};

const stripByNotation = (value = "") => value.replace(/\s+by\s+[^.]+\.?$/i, ".").trim();

const getContributionNotation = (type) => {
  if (type === "add_song") return { chipClass: "is-accepted", label: "Added" };
  if (type === "delete_song" || type === "remove_song") return { chipClass: "is-rejected", label: "Deleted" };
  if (type === "reorder") return { chipClass: "is-update", label: "Reordered" };
  if (type === "request_message") return { chipClass: "is-message", label: "Message" };
  return { chipClass: "is-update", label: "Updated" };
};

const DUMMY_CONTRIBUTION_NOTATION = [
  {
    id: "dummy-notation-add",
    type: "add_song",
    icon: "ri-play-list-add-line",
    title: "Dummy Example",
    copy: 'added "Neon Lights".',
  },
  {
    id: "dummy-notation-delete",
    type: "delete_song",
    icon: "ri-delete-bin-6-line",
    title: "Dummy Example",
    copy: 'deleted "Late Window" from the playlist.',
  },
  {
    id: "dummy-notation-reorder",
    type: "reorder",
    icon: "ri-drag-move-2-line",
    title: "Dummy Example",
    copy: "reordered tracks to improve transition flow.",
  },
  {
    id: "dummy-notation-message",
    type: "request_message",
    icon: "ri-message-2-line",
    title: "Dummy Request Message",
    copy: "Can I help refine the first half mood arc?",
  },
];

const normalizeRequest = (request) => {
  const rawPlaylistId =
    typeof request?.playlist === "string"
      ? request.playlist
      : request?.playlist?._id || request?.playlistId || "";

  return {
    ...request,
    id: request?._id || request?.id || "",
    playlistId: String(rawPlaylistId || ""),
  };
};

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

const buildDemoContributorSnapshot = (activeUser, playlistFilterId = "") => {
  ensureDummyCollaborationRequests(activeUser);

  const demoRequests = getInboxRequestsForUser(activeUser).map(normalizeRequest);
  const allRequests = getCollaborationRequests().map(normalizeRequest);
  const accessMap = getCollaborationAccessMap();
  const playlistIds = Object.keys(accessMap).filter(
    (playlistId) => !playlistFilterId || String(playlistId) === String(playlistFilterId)
  );

  const contributors = playlistIds.flatMap((playlistId) =>
    (accessMap[playlistId] || []).map((username) => {
      const matchingRequest = allRequests.find(
        (request) =>
          request.playlistId === String(playlistId) &&
          (request.requesterUsername || "").toLowerCase() === String(username).toLowerCase()
      );
      return {
        id: `${playlistId}-${username}`,
        playlistId: String(playlistId),
        playlistName: matchingRequest?.playlistName || "Shared Playlist",
        username,
        displayName: matchingRequest?.requesterDisplayName || username,
      };
    })
  );

  const activityMap = Object.fromEntries(
    playlistIds.map((playlistId) => [
      String(playlistId),
      (getContributionActivity(playlistId) || []).map(normalizeActivityEntry),
    ])
  );

  return { requests: demoRequests, contributors, activityMap };
};

function NotificationsPage({ activeUser, authToken }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || "friends");
  const [contributorView, setContributorView] = useState(location.state?.contributorView || "people");
  const [requests, setRequests] = useState([]);
  const [friendStatuses, setFriendStatuses] = useState({});
  const [friendList, setFriendList] = useState([]);
  const [contributors, setContributors] = useState([]);
  const [messageTarget, setMessageTarget] = useState(null);
  const [manualMessage, setManualMessage] = useState("");
  const [sentMessages, setSentMessages] = useState({});
  const [contributionTarget, setContributionTarget] = useState(null);
  const [activityMap, setActivityMap] = useState({});

  const isLoggedIn = Boolean(activeUser && activeUser !== "guest" && authToken);
  const authHeaders = useMemo(
    () => (authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    [authToken]
  );
  const playlistFilterId = location.state?.playlistId || "";
  const playlistFilterName = location.state?.playlistName || "";

  const reloadRequests = useCallback(async () => {
    setFriendList(getDummyFriendsList(activeUser));

    if (!isLoggedIn) {
      setRequests([]);
      setContributors([]);
      setActivityMap({});
      return;
    }

    try {
      const [requestsResponse, managedResponse] = await Promise.all([
        axios.get(`${API}/collab/requests/inbox`, { headers: authHeaders }),
        axios.get(`${API}/playlists/managed`, { headers: authHeaders }),
      ]);

      const normalizedRequests = (requestsResponse.data?.requests || []).map(normalizeRequest);
      setRequests(normalizedRequests);

      const managedPlaylists = managedResponse.data?.playlists || [];
      const filteredPlaylists = playlistFilterId
        ? managedPlaylists.filter((playlist) => String(playlist._id) === String(playlistFilterId))
        : managedPlaylists;

      const nextContributors = filteredPlaylists.flatMap((playlist) =>
        (playlist.contributors || []).map((username) => {
          const matchingRequest = normalizedRequests.find(
            (request) =>
              request.playlistId === String(playlist._id) &&
              (request.requesterUsername || "").toLowerCase() === String(username).toLowerCase()
          );
          return {
            id: `${playlist._id}-${username}`,
            playlistId: String(playlist._id),
            playlistName: playlist.name || matchingRequest?.playlistName || "Shared Playlist",
            username,
            displayName: matchingRequest?.requesterDisplayName || username,
          };
        })
      );
      const activityResponses = await Promise.all(
        filteredPlaylists.map(async (playlist) => {
          const response = await axios.get(`${API}/playlists/${playlist._id}/activity`, {
            headers: authHeaders,
          });
          const activities = (response.data?.activities || []).map(normalizeActivityEntry);
          return [String(playlist._id), activities];
        })
      );
      const nextActivityMap = Object.fromEntries(activityResponses);
      const nextActivityCount = Object.values(nextActivityMap).flatMap((entries) => entries || []).length;

      const shouldUseDemoFallback = nextContributors.length === 0 || nextActivityCount === 0;
      if (shouldUseDemoFallback) {
        const demoSnapshot = buildDemoContributorSnapshot(activeUser, playlistFilterId);

        setRequests((current) => (current.length ? current : demoSnapshot.requests));
        setContributors(nextContributors.length ? nextContributors : demoSnapshot.contributors);
        setActivityMap(nextActivityCount > 0 ? nextActivityMap : demoSnapshot.activityMap);
        return;
      }

      setContributors(nextContributors);
      setActivityMap(nextActivityMap);
    } catch (error) {
      console.error("Failed to load contributor notifications:", error);
      const demoSnapshot = buildDemoContributorSnapshot(activeUser, playlistFilterId);
      setRequests(demoSnapshot.requests);
      setContributors(demoSnapshot.contributors);
      setActivityMap(demoSnapshot.activityMap);
    }
  }, [activeUser, authHeaders, isLoggedIn, playlistFilterId]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      reloadRequests();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [reloadRequests]);

  useEffect(() => {
    if (!isLoggedIn || activeTab !== "contributors") return undefined;

    const intervalId = window.setInterval(() => {
      reloadRequests();
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [activeTab, isLoggedIn, reloadRequests]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (location.state?.activeTab) {
        setActiveTab(location.state.activeTab);
      }
      if (location.state?.contributorView) {
        setContributorView(location.state.contributorView);
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [location.state]);

  const friendNotifications = useMemo(() => getDummyFriendNotifications(activeUser), [activeUser]);
  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === "pending"),
    [requests]
  );
  const playlistActivityFeed = useMemo(() => {
    const source = playlistFilterId
      ? activityMap[playlistFilterId] || []
      : Object.values(activityMap).flatMap((entries) => entries || []);

    return [...source].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  }, [activityMap, playlistFilterId]);
  const playlistActivityGroups = useMemo(() => {
    const grouped = new Map();
    playlistActivityFeed.forEach((entry) => {
      const current = grouped.get(entry.playlistId) || {
        playlistId: entry.playlistId,
        playlistName: entry.playlistName || "Playlist",
        adds: 0,
        deletes: 0,
        updates: 0,
        latestAt: entry.createdAt,
      };

      if (entry.type === "add_song") current.adds += 1;
      else if (entry.type === "delete_song" || entry.type === "remove_song") current.deletes += 1;
      else current.updates += 1;

      if (new Date(entry.createdAt) > new Date(current.latestAt)) {
        current.latestAt = entry.createdAt;
      }

      grouped.set(entry.playlistId, current);
    });

    return [...grouped.values()].sort((left, right) => new Date(right.latestAt) - new Date(left.latestAt));
  }, [playlistActivityFeed]);

  const handleRequestAction = async (requestId, status) => {
    if (!requestId || !status) return;

    try {
      await axios.post(
        `${API}/collab/requests/${requestId}/respond`,
        { status },
        { headers: authHeaders }
      );
      await reloadRequests();
    } catch (error) {
      console.error("Failed to respond to request:", error);
      alert(error?.response?.data?.message || "Failed to update request status.");
    }
  };

  const handleFriendAction = (notificationId, status) => {
    setFriendStatuses((current) => ({
      ...current,
      [notificationId]: status,
    }));
  };

  const handleUnfollowFriend = (friendId) => {
    setFriendList((current) => current.filter((friend) => friend.id !== friendId));
  };

  const handleRemoveContributor = async (contributor) => {
    if (!contributor?.playlistId || !contributor?.username) return;

    try {
      await axios.delete(`${API}/playlists/${contributor.playlistId}/contributors/${contributor.username}`, {
        headers: authHeaders,
      });
      await reloadRequests();
    } catch (error) {
      console.error("Failed to remove contributor:", error);
      alert(error?.response?.data?.message || "Failed to remove contributor.");
    }
  };

  const handleSendManualMessage = () => {
    if (!messageTarget || !manualMessage.trim()) return;
    setSentMessages((current) => ({
      ...current,
      [messageTarget.id]: manualMessage.trim(),
    }));
    setManualMessage("");
    setMessageTarget(null);
  };

  const openUserProfile = (username) => {
    if (!username) return;
    navigate(`/discover/users/${username}`);
  };

  const getContributionEntries = (contributor) => {
    if (!contributor) return [];

    const matchingRequest = requests.find(
      (request) =>
        request.playlistId === contributor.playlistId &&
        request.requesterUsername === contributor.username
    );
    const activity = (activityMap[contributor.playlistId] || []).filter(
      (entry) => entry.actorUsername === contributor.username
    );

    const entries = [];

    if (matchingRequest?.message) {
      entries.push({
        id: `${contributor.id}-message`,
        type: "request_message",
        icon: "ri-message-2-line",
        title: "Request message",
        copy: matchingRequest.message,
      });
    }

    activity.forEach((entry) => {
      entries.push({
        id: entry.id,
        type: entry.type,
        icon:
          entry.type === "add_song"
            ? "ri-play-list-add-line"
            : entry.type === "delete_song"
              ? "ri-delete-bin-6-line"
              : entry.type === "remove_song"
                ? "ri-indeterminate-circle-line"
                : entry.type === "reorder"
                  ? "ri-drag-move-2-line"
                  : "ri-file-list-3-line",
        title: entry.actorDisplayName || contributor.displayName,
        copy: entry.text,
      });
    });

    if (!entries.length) {
      entries.push({
        id: `${contributor.id}-joined`,
        type: "update",
        icon: "ri-user-shared-line",
        title: "Collaboration enabled",
        copy: `${contributor.displayName} can now edit this playlist together.`,
      });
    }

    return entries;
  };

  if (!isLoggedIn) {
    return (
      <div className="page-shell">
        <div className="notifications-page">
          <div className="notifications-empty-card">
            <h2>Notifications</h2>
            <p>Log in to view collaboration inbox items and friend activity.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="notifications-page">
        <section className="notifications-hero">
          <div>
            <h2>Notifications</h2>
            <p>Friend activity and collaboration requests.</p>
          </div>
          <div className="notifications-meta">
            <span>{friendNotifications.length} friend item(s)</span>
            <span>{pendingRequests.length} pending collab request(s)</span>
          </div>
        </section>

        <div className="notifications-tab-bar">
          <button
            type="button"
            className={activeTab === "friends" ? "is-active" : ""}
            onClick={() => setActiveTab("friends")}
          >
            Friend Requests & Updates
          </button>
          <button
            type="button"
            className={activeTab === "collab" ? "is-active" : ""}
            onClick={() => setActiveTab("collab")}
          >
            Contribution Inbox
          </button>
          <button
            type="button"
            className={activeTab === "friendList" ? "is-active" : ""}
            onClick={() => setActiveTab("friendList")}
          >
            Friends
          </button>
          <button
            type="button"
            className={activeTab === "contributors" ? "is-active" : ""}
            onClick={() => setActiveTab("contributors")}
          >
            Contributors
          </button>
        </div>

        {activeTab === "friends" ? (
          <section className="notifications-panel">
            {friendNotifications.map((item) => (
              <article key={item.id} className="notification-card">
                <div className="notification-avatar">
                  {(item.fromDisplayName || item.fromUsername || "U").charAt(0).toUpperCase()}
                </div>
                <div className="notification-copy">
                  {(() => {
                    const currentStatus = friendStatuses[item.id] || item.status || null;
                    const isPendingRequest =
                      item.type === "request" && currentStatus !== "accepted" && currentStatus !== "rejected";

                    return (
                      <>
                        <div className="notification-management-header">
                          <div className="notification-management-meta">
                            <div className="notification-topline">
                              <strong>{item.fromDisplayName}</strong>
                              <span className={`notification-type is-${currentStatus || item.type}`}>
                                {item.type === "request"
                                  ? currentStatus === "accepted"
                                    ? "Accepted"
                                    : currentStatus === "rejected"
                                      ? "Rejected"
                                      : "Friend Request"
                                  : "Friend Update"}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="notification-username notification-username-link"
                              onClick={() => openUserProfile(item.fromUsername)}
                            >
                              @{item.fromUsername}
                            </button>
                          </div>
                          {isPendingRequest ? (
                            <div className="notification-actions notification-actions-inline">
                            <button type="button" onClick={() => handleFriendAction(item.id, "rejected")}>
                                <i className="ri-close-line"></i>
                              </button>
                              <button type="button" className="btn-primary" onClick={() => handleFriendAction(item.id, "accepted")}>
                                <i className="ri-check-line"></i>
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <p>{item.message}</p>
                      </>
                    );
                  })()}
                </div>
                <time>{formatRelativeTime(item.createdAt)}</time>
              </article>
            ))}
          </section>
        ) : activeTab === "collab" ? (
          <section className="notifications-panel">
            {requests.length === 0 ? (
              <div className="notifications-empty-card">
                <p>No contribution requests yet.</p>
              </div>
            ) : (
              requests.map((request) => (
                <article key={request.id} className="notification-card notification-card-collab">
                  <div className="notification-avatar">
                    {(request.requesterDisplayName || request.requesterUsername || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="notification-copy">
                    <div className="notification-management-header">
                      <div className="notification-management-meta">
                        <div className="notification-topline">
                          <strong>{request.requesterDisplayName || request.requesterUsername}</strong>
                          <span className={`notification-type is-${request.status}`}>
                            {request.status}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="notification-username notification-username-link"
                          onClick={() => openUserProfile(request.requesterUsername)}
                        >
                          @{request.requesterUsername}
                        </button>
                      </div>
                      {request.status === "pending" ? (
                        <div className="notification-actions notification-actions-inline">
                          <button type="button" onClick={() => handleRequestAction(request.id, "rejected")}>
                            <i className="ri-close-line"></i>
                          </button>
                          <button type="button" className="btn-primary" onClick={() => handleRequestAction(request.id, "accepted")}>
                            <i className="ri-check-line"></i>
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <p>
                      wants to contribute to <strong>{request.playlistName}</strong>
                    </p>
                    {request.message ? (
                      <div className="notification-message-box">"{request.message}"</div>
                    ) : (
                      <div className="notification-message-box is-muted">No message attached.</div>
                    )}
                  </div>
                  <time>{formatRelativeTime(request.createdAt)}</time>
                </article>
              ))
            )}
          </section>
        ) : activeTab === "friendList" ? (
          <section className="notifications-panel">
            {friendList.length === 0 ? (
              <div className="notifications-empty-card">
                <p>No friends yet.</p>
              </div>
            ) : (
              friendList.map((friend) => (
                <article key={friend.id} className="notification-card">
                  <div className="notification-avatar">
                    {(friend.displayName || friend.username || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="notification-copy">
                    <div className="notification-management-header">
                      <div className="notification-management-meta">
                        <div className="notification-topline">
                          <strong>{friend.displayName}</strong>
                          <span className="notification-type is-update">{friend.mood}</span>
                        </div>
                        <button
                          type="button"
                          className="notification-username notification-username-link"
                          onClick={() => openUserProfile(friend.username)}
                        >
                          @{friend.username}
                        </button>
                      </div>
                      <div className="notification-actions notification-actions-inline">
                        <button type="button" title="Message" onClick={() => setMessageTarget(friend)}>
                          <i className="ri-message-2-line"></i>
                        </button>
                        <button type="button" title="Unfollow" onClick={() => handleUnfollowFriend(friend.id)}>
                          <i className="ri-user-unfollow-line"></i>
                        </button>
                      </div>
                    </div>
                    <p>{friend.note}</p>
                    {sentMessages[friend.id] ? (
                      <div className="notification-message-box">Message sent: "{sentMessages[friend.id]}"</div>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </section>
        ) : (
          <>
            <div className="contributors-subtabs">
              <button
                type="button"
                className={contributorView === "people" ? "is-active" : ""}
                onClick={() => setContributorView("people")}
              >
                People
              </button>
              <button
                type="button"
                className={contributorView === "activity" ? "is-active" : ""}
                onClick={() => setContributorView("activity")}
              >
                Activity
              </button>
            </div>

            {contributorView === "people" ? (
              <section className="notifications-panel">
                {contributors.length === 0 ? (
                  <div className="notifications-empty-card">
                    <p>No contributors added yet.</p>
                  </div>
                ) : (
                  contributors
                    .filter((contributor) => !playlistFilterId || contributor.playlistId === playlistFilterId)
                    .map((contributor) => (
                      <article key={contributor.id} className="notification-card">
                        <div className="notification-avatar">
                          {(contributor.displayName || contributor.username || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="notification-copy">
                          <div className="notification-management-header">
                            <div className="notification-management-meta">
                              <div className="notification-topline">
                                <strong>{contributor.displayName}</strong>
                                <span className="notification-type is-accepted">Contributor</span>
                              </div>
                              <button
                                type="button"
                                className="notification-username notification-username-link"
                                onClick={() => openUserProfile(contributor.username)}
                              >
                                @{contributor.username}
                              </button>
                            </div>
                            <div className="notification-actions notification-actions-inline">
                              <button
                                type="button"
                                title="View contributions"
                                onClick={() => setContributionTarget(contributor)}
                              >
                                <i className="ri-file-list-3-line"></i>
                              </button>
                              <button type="button" title="Message" onClick={() => setMessageTarget(contributor)}>
                                <i className="ri-message-2-line"></i>
                              </button>
                              <button type="button" title="Remove contributor" onClick={() => handleRemoveContributor(contributor)}>
                                <i className="ri-user-unfollow-line"></i>
                              </button>
                            </div>
                          </div>
                          <p>
                            Can edit{" "}
                            <Link
                              className="notification-playlist-link"
                              to={`/playlists/${contributor.playlistId}`}
                              state={{ source: "discover" }}
                            >
                              {contributor.playlistName}
                            </Link>
                          </p>
                          {sentMessages[contributor.id] ? (
                            <div className="notification-message-box">Message sent: "{sentMessages[contributor.id]}"</div>
                          ) : null}
                        </div>
                      </article>
                    ))
                )}
              </section>
            ) : (
              <section className="notifications-panel">
                {playlistFilterName ? (
                  <div className="notifications-empty-card analytics-filter-card">
                    Showing playlist activity for <strong>{playlistFilterName}</strong>
                  </div>
                ) : null}
                {playlistActivityGroups.length === 0 ? (
                  <div className="notifications-empty-card">
                    <p>No playlist contribution activity yet.</p>
                  </div>
                ) : (
                  playlistActivityGroups.map((playlistEntry) => (
                    <article
                      key={playlistEntry.playlistId}
                      className="notification-card activity-playlist-card"
                      onClick={() =>
                        navigate(`/playlists/${playlistEntry.playlistId}/activity`, {
                          state: { playlistName: playlistEntry.playlistName },
                        })
                      }
                    >
                      <div className="notification-avatar">
                        <i className="ri-play-list-2-line"></i>
                      </div>
                      <div className="notification-copy">
                        <div className="notification-management-header">
                          <div className="notification-management-meta">
                            <div className="notification-topline">
                              <strong>{playlistEntry.playlistName}</strong>
                              <span className="notification-type is-update">Activity</span>
                            </div>
                            <span className="notification-username">
                              Open detailed analytics for this playlist
                            </span>
                          </div>
                        </div>
                        <div className="activity-playlist-summary">
                          <span className="activity-summary-chip adds">{playlistEntry.adds} add</span>
                          <span className="activity-summary-chip deletes">{playlistEntry.deletes} delete</span>
                          <span className="activity-summary-chip updates">{playlistEntry.updates} update</span>
                        </div>
                      </div>
                      <time>{formatRelativeTime(playlistEntry.latestAt)}</time>
                    </article>
                  ))
                )}
              </section>
            )}
          </>
        )}

        {messageTarget ? (
          <div className="profile-modal-backdrop" onClick={() => setMessageTarget(null)}>
            <div className="profile-modal notification-message-modal" onClick={(event) => event.stopPropagation()}>
              <h3>Send Message</h3>
              <p className="copy-song-description">
                Write a message to <strong>{messageTarget.displayName || messageTarget.username}</strong>.
              </p>
              <textarea
                className="playlist-contribute-textarea"
                value={manualMessage}
                onChange={(event) => setManualMessage(event.target.value)}
                placeholder="Write your message here"
                rows={4}
              />
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setMessageTarget(null)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={handleSendManualMessage}>
                  Send
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {contributionTarget ? (
          <div className="profile-modal-backdrop" onClick={() => setContributionTarget(null)}>
            <div className="profile-modal notification-message-modal contribution-modal-fixed" onClick={(event) => event.stopPropagation()}>
              <h3>Playlist Contributions</h3>
              <p className="copy-song-description">
                Changes and context shared by <strong>{contributionTarget.displayName}</strong>.
              </p>
              <div className="contribution-modal-scroll-area">
                <div className="contribution-log-list">
                  {getContributionEntries(contributionTarget).map((entry) => (
                    <article key={entry.id} className={`contribution-log-item contribution-log-${entry.type || "update"}`}>
                      <span className="contribution-log-icon">
                        <i className={entry.icon}></i>
                      </span>
                      <div className="contribution-log-copy">
                        <div className="contribution-log-title-row">
                          <strong>{entry.title}</strong>
                          <span className={`notification-type ${getContributionNotation(entry.type).chipClass}`}>
                            {getContributionNotation(entry.type).label}
                          </span>
                        </div>
                        <p>{stripByNotation(entry.copy)}</p>
                      </div>
                    </article>
                  ))}
                </div>
                <p className="contribution-log-legend-title">Dummy notation preview</p>
                <div className="contribution-log-list">
                  {DUMMY_CONTRIBUTION_NOTATION.map((entry) => (
                    <article key={entry.id} className={`contribution-log-item contribution-log-${entry.type}`}>
                      <span className="contribution-log-icon">
                        <i className={entry.icon}></i>
                      </span>
                      <div className="contribution-log-copy">
                        <div className="contribution-log-title-row">
                          <strong>{entry.title}</strong>
                          <span className={`notification-type ${getContributionNotation(entry.type).chipClass}`}>
                            {getContributionNotation(entry.type).label}
                          </span>
                        </div>
                        <p>{stripByNotation(entry.copy)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-primary" onClick={() => setContributionTarget(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default NotificationsPage;
