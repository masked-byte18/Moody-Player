const REQUESTS_KEY = "moody-collab-requests";
const DRAFTS_KEY = "moody-collab-drafts";
const COLLABS_KEY = "moody-collab-access";
const ACTIVITY_KEY = "moody-collab-activity";
const DEMO_DATA_ENABLED = true;

const safeParse = (value, fallback) => {
  try {
    return JSON.parse(value) || fallback;
  } catch {
    return fallback;
  }
};

const readStorage = (key, fallback) => safeParse(localStorage.getItem(key), fallback);

const writeStorage = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("moody-collaboration-updated"));
};

const isDemoId = (value = "") => {
  const id = String(value || "");
  return id.startsWith("demo-") || id.startsWith("dummy-");
};

const removeDemoDataFromStorage = () => {
  const requests = readStorage(REQUESTS_KEY, []).filter(
    (request) => !request?.isDemo && !isDemoId(request?.id) && !isDemoId(request?.playlistId)
  );
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));

  const drafts = readStorage(DRAFTS_KEY, {});
  const cleanedDrafts = Object.fromEntries(
    Object.entries(drafts).filter(([playlistId, draft]) => !isDemoId(playlistId) && !draft?.isDemo)
  );
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(cleanedDrafts));

  const access = readStorage(COLLABS_KEY, {});
  const cleanedAccess = Object.fromEntries(
    Object.entries(access).filter(([playlistId]) => !isDemoId(playlistId))
  );
  localStorage.setItem(COLLABS_KEY, JSON.stringify(cleanedAccess));

  const activity = readStorage(ACTIVITY_KEY, {});
  const cleanedActivity = Object.fromEntries(
    Object.entries(activity).filter(([playlistId]) => !isDemoId(playlistId))
  );
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(cleanedActivity));
};

export const getCollaborationRequests = () => readStorage(REQUESTS_KEY, []);
export const getPlaylistDraftsMap = () => readStorage(DRAFTS_KEY, {});

export const getInboxRequestsForUser = (username) => {
  const normalized = (username || "").trim().toLowerCase();
  if (!normalized || normalized === "guest") return [];

  return getCollaborationRequests()
    .filter((request) => request.ownerUsername === normalized)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
};

export const getOutgoingRequestsForUser = (username) => {
  const normalized = (username || "").trim().toLowerCase();
  if (!normalized || normalized === "guest") return [];

  return getCollaborationRequests()
    .filter((request) => request.requesterUsername === normalized)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
};

export const hasPendingCollaborationRequest = ({ playlistId, ownerUsername, requesterUsername }) => {
  const normalizedOwner = (ownerUsername || "").trim().toLowerCase();
  const normalizedRequester = (requesterUsername || "").trim().toLowerCase();

  return getCollaborationRequests().some(
    (request) =>
      request.playlistId === playlistId &&
      request.ownerUsername === normalizedOwner &&
      request.requesterUsername === normalizedRequester &&
      request.status === "pending"
  );
};

export const createCollaborationRequest = ({
  playlistId,
  playlistName,
  ownerUsername,
  ownerDisplayName,
  requesterUsername,
  requesterDisplayName,
  message = "",
}) => {
  const requests = getCollaborationRequests();
  const request = {
    id: `collab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    playlistId,
    playlistName,
    ownerUsername: (ownerUsername || "").trim().toLowerCase(),
    ownerDisplayName: ownerDisplayName || ownerUsername || "",
    requesterUsername: (requesterUsername || "").trim().toLowerCase(),
    requesterDisplayName: requesterDisplayName || requesterUsername || "",
    message: message.trim(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  requests.unshift(request);
  writeStorage(REQUESTS_KEY, requests);
  return request;
};

export const ensureDummyCollaborationRequests = (username) => {
  if (!DEMO_DATA_ENABLED) {
    removeDemoDataFromStorage();
    return;
  }

  const normalized = (username || "").trim().toLowerCase();
  if (!normalized || normalized === "guest") return;

  const requests = getCollaborationRequests();
  const demoRequests = [
    {
      id: `collab-demo-${normalized}-1`,
      playlistId: "dummy-djarya-night-drive",
      playlistName: "Night Drive Pulse",
      ownerUsername: normalized,
      ownerDisplayName: normalized,
      requesterUsername: "moonframes",
      requesterDisplayName: "Moon Frames",
      message: "I want to add a softer bridge section and reorder the late-night tracks.",
      status: "pending",
      createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      isDemo: true,
    },
    {
      id: `collab-demo-${normalized}-2`,
      playlistId: "dummy-moonframes-cloud-radio",
      playlistName: "Cloud Radio",
      ownerUsername: normalized,
      ownerDisplayName: normalized,
      requesterUsername: "djarya",
      requesterDisplayName: "DJ Arya",
      message: "Would love to help tune the mood flow between the first three songs.",
      status: "accepted",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
      isDemo: true,
    },
    {
      id: `collab-demo-outgoing-${normalized}-3`,
      playlistId: "dummy-djarya-night-drive",
      playlistName: "Night Drive Pulse",
      ownerUsername: "moonframes",
      ownerDisplayName: "Moon Frames",
      requesterUsername: normalized,
      requesterDisplayName: normalized,
      message: "Let me help tighten the first half of the playlist pacing.",
      status: "pending",
      createdAt: new Date(Date.now() - 1000 * 60 * 52).toISOString(),
      isDemo: true,
    },
    {
      id: `collab-demo-${normalized}-4`,
      playlistId: "dummy-djarya-night-drive",
      playlistName: "Night Drive Pulse",
      ownerUsername: normalized,
      ownerDisplayName: normalized,
      requesterUsername: "aurakit",
      requesterDisplayName: "Aura Kit",
      message: "Can I remove two tracks and make this playlist more calm?",
      status: "rejected",
      createdAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
      isDemo: true,
    },
    {
      id: `collab-demo-outgoing-${normalized}-5`,
      playlistId: "dummy-moonframes-cloud-radio",
      playlistName: "Cloud Radio",
      ownerUsername: "moonframes",
      ownerDisplayName: "Moon Frames",
      requesterUsername: normalized,
      requesterDisplayName: normalized,
      message: "I can help tune the transition after Paper Skies.",
      status: "accepted",
      createdAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
      isDemo: true,
    },
  ];

  const existingIds = new Set(requests.map((request) => request.id));
  const nextRequests = [...requests];
  let requestsChanged = false;
  demoRequests.forEach((request) => {
    if (!existingIds.has(request.id)) {
      nextRequests.unshift(request);
      requestsChanged = true;
    }
  });

  const access = readStorage(COLLABS_KEY, {});
  const currentCollaborators = new Set(access["dummy-moonframes-cloud-radio"] || []);
  const hadDemoCollaborator = currentCollaborators.has("djarya");
  const hadAcceptedOutgoingCollaborator = currentCollaborators.has(normalized);
  currentCollaborators.add("djarya");
  currentCollaborators.add(normalized);
  if (!hadDemoCollaborator) {
    access["dummy-moonframes-cloud-radio"] = [...currentCollaborators];
  } else if (!hadAcceptedOutgoingCollaborator) {
    access["dummy-moonframes-cloud-radio"] = [...currentCollaborators];
  }

  const activity = readStorage(ACTIVITY_KEY, {});
  const currentActivity = activity["dummy-moonframes-cloud-radio"] || [];
  let activityChanged = false;
  if (!currentActivity.some((entry) => entry.id === `activity-demo-${normalized}-1`)) {
    currentActivity.unshift(
      {
        id: `activity-demo-${normalized}-1`,
        actorUsername: "djarya",
        actorDisplayName: "DJ Arya",
        playlistId: "dummy-moonframes-cloud-radio",
        playlistName: "Cloud Radio",
        type: "add_song",
        text: 'added "Neon Drift" to the playlist.',
        createdAt: new Date(Date.now() - 1000 * 60 * 34).toISOString(),
        isDemo: true,
      },
      {
        id: `activity-demo-${normalized}-2`,
        actorUsername: "djarya",
        actorDisplayName: "DJ Arya",
        playlistId: "dummy-moonframes-cloud-radio",
        playlistName: "Cloud Radio",
        type: "reorder",
        text: "reordered the first three songs for a smoother mood flow.",
        createdAt: new Date(Date.now() - 1000 * 60 * 96).toISOString(),
        isDemo: true,
      }
    );
    activityChanged = true;
  }
  if (activityChanged) {
    activity["dummy-moonframes-cloud-radio"] = currentActivity;
  }

  const drafts = readStorage(DRAFTS_KEY, {});
  const ownedPlaylistId = `demo-owned-${normalized}`;
  const managedPlaylistId = `demo-managed-${normalized}`;
  const managedPlaylistId2 = `demo-managed-2-${normalized}`;
  const hasOwnedDraft = Boolean(drafts[ownedPlaylistId]);
  const hasManagedDraft = Boolean(drafts[managedPlaylistId]);
  const hasManagedDraft2 = Boolean(drafts[managedPlaylistId2]);
  if (!hasOwnedDraft) {
    drafts[ownedPlaylistId] = {
      _id: ownedPlaylistId,
      name: "Private Mood Lab",
      description: "Your personal playlist mock for rename/publish/delete preview.",
      coverImage: "",
      ownerUsername: normalized,
      ownerDisplayName: normalized,
      isFeatured: false,
      contributors: [],
      songs: [
        {
          _id: `demo-owned-song-${normalized}-1`,
          title: "City Pulse",
          artist: "Kairo",
          mood: "happy",
        },
      ],
    };
  }
  if (!hasManagedDraft) {
    drafts[managedPlaylistId] = {
      _id: managedPlaylistId,
      name: "Community Heat",
      description: "A managed playlist where contributors shape the final mood curve together.",
      coverImage: "",
      ownerUsername: normalized,
      ownerDisplayName: normalized,
      isFeatured: false,
      contributors: ["moonframes", "novaecho"],
      songs: [
        {
          _id: `demo-song-${normalized}-1`,
          title: "Glow Run",
          artist: "Luma Vale",
          mood: "happy",
          addedByUsername: "moonframes",
          addedByDisplayName: "Moon Frames",
        },
        {
          _id: `demo-song-${normalized}-2`,
          title: "Pressure Bloom",
          artist: "Nova Echo",
          mood: "energetic",
          addedByUsername: "novaecho",
          addedByDisplayName: "Nova Echo",
        },
      ],
    };
  }
  if (!hasManagedDraft2) {
    drafts[managedPlaylistId2] = {
      _id: managedPlaylistId2,
      name: "Blue Hour Collective",
      description: "Second managed mock playlist for contributor analytics preview.",
      coverImage: "",
      ownerUsername: normalized,
      ownerDisplayName: normalized,
      isFeatured: true,
      contributors: ["vinylfox", "aurakit"],
      songs: [
        {
          _id: `demo-song2-${normalized}-1`,
          title: "Afterglow Steps",
          artist: "Vanta",
          mood: "neutral",
          addedByUsername: "vinylfox",
          addedByDisplayName: "Vinyl Fox",
        },
        {
          _id: `demo-song2-${normalized}-2`,
          title: "Glass Tides",
          artist: "Aura Kit",
          mood: "sad",
          addedByUsername: "aurakit",
          addedByDisplayName: "Aura Kit",
        },
      ],
    };
  }

  const managedCollaborators = new Set(access[managedPlaylistId] || []);
  const hadManagedCollaborators =
    managedCollaborators.has("moonframes") && managedCollaborators.has("novaecho");
  managedCollaborators.add("moonframes");
  managedCollaborators.add("novaecho");
  if (!hadManagedCollaborators) {
    access[managedPlaylistId] = [...managedCollaborators];
  }

  const managedCollaborators2 = new Set(access[managedPlaylistId2] || []);
  const hadManagedCollaborators2 =
    managedCollaborators2.has("vinylfox") && managedCollaborators2.has("aurakit");
  managedCollaborators2.add("vinylfox");
  managedCollaborators2.add("aurakit");
  if (!hadManagedCollaborators2) {
    access[managedPlaylistId2] = [...managedCollaborators2];
  }

  const managedActivity = activity[managedPlaylistId] || [];
  let managedActivityChanged = false;
  if (!managedActivity.some((entry) => entry.id === `activity-managed-${normalized}-1`)) {
    managedActivity.unshift(
      {
        id: `activity-managed-${normalized}-1`,
        actorUsername: "moonframes",
        actorDisplayName: "Moon Frames",
        playlistId: managedPlaylistId,
        playlistName: "Community Heat",
        type: "add_song",
        text: 'added "Glow Run" by Luma Vale.',
        createdAt: new Date(Date.now() - 1000 * 60 * 21).toISOString(),
        isDemo: true,
      },
      {
        id: `activity-managed-${normalized}-2`,
        actorUsername: "novaecho",
        actorDisplayName: "Nova Echo",
        playlistId: managedPlaylistId,
        playlistName: "Community Heat",
        type: "delete_song",
        text: 'deleted "Dust Arcade" from the playlist.',
        createdAt: new Date(Date.now() - 1000 * 60 * 58).toISOString(),
        isDemo: true,
      },
      {
        id: `activity-managed-${normalized}-3`,
        actorUsername: "moonframes",
        actorDisplayName: "Moon Frames",
        playlistId: managedPlaylistId,
        playlistName: "Community Heat",
        type: "reorder",
        text: "reordered the opening tracks for smoother energy.",
        createdAt: new Date(Date.now() - 1000 * 60 * 115).toISOString(),
        isDemo: true,
      }
    );
    managedActivityChanged = true;
  }
  if (managedActivityChanged) {
    activity[managedPlaylistId] = managedActivity;
  }

  const managedActivity2 = activity[managedPlaylistId2] || [];
  let managedActivityChanged2 = false;
  if (!managedActivity2.some((entry) => entry.id === `activity-managed2-${normalized}-1`)) {
    managedActivity2.unshift(
      {
        id: `activity-managed2-${normalized}-1`,
        actorUsername: "vinylfox",
        actorDisplayName: "Vinyl Fox",
        playlistId: managedPlaylistId2,
        playlistName: "Blue Hour Collective",
        type: "add_song",
        text: 'added "Afterglow Steps" by Vanta.',
        createdAt: new Date(Date.now() - 1000 * 60 * 39).toISOString(),
        isDemo: true,
      },
      {
        id: `activity-managed2-${normalized}-2`,
        actorUsername: "aurakit",
        actorDisplayName: "Aura Kit",
        playlistId: managedPlaylistId2,
        playlistName: "Blue Hour Collective",
        type: "delete_song",
        text: 'deleted "Late Window" from the playlist.',
        createdAt: new Date(Date.now() - 1000 * 60 * 88).toISOString(),
        isDemo: true,
      },
      {
        id: `activity-managed2-${normalized}-3`,
        actorUsername: "vinylfox",
        actorDisplayName: "Vinyl Fox",
        playlistId: managedPlaylistId2,
        playlistName: "Blue Hour Collective",
        type: "reorder",
        text: "reordered tracks to keep a calmer build-up.",
        createdAt: new Date(Date.now() - 1000 * 60 * 166).toISOString(),
        isDemo: true,
      }
    );
    managedActivityChanged2 = true;
  }
  if (managedActivityChanged2) {
    activity[managedPlaylistId2] = managedActivity2;
  }

  const accessChanged =
    !hadDemoCollaborator ||
    !hadAcceptedOutgoingCollaborator ||
    !hadManagedCollaborators ||
    !hadManagedCollaborators2;
  const draftsChanged = !hasManagedDraft || !hasManagedDraft2 || !hasOwnedDraft;
  if (
    !requestsChanged &&
    !accessChanged &&
    !activityChanged &&
    !draftsChanged &&
    !managedActivityChanged &&
    !managedActivityChanged2
  ) {
    return;
  }

  if (accessChanged) {
    localStorage.setItem(COLLABS_KEY, JSON.stringify(access));
  }
  if (activityChanged || managedActivityChanged || managedActivityChanged2) {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity));
  }
  if (draftsChanged) {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  }
  if (requestsChanged) {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(nextRequests));
  }
};

export const getCollaboratorUsernames = (playlistId) => {
  const access = readStorage(COLLABS_KEY, {});
  return access[playlistId] || [];
};

export const getCollaborationAccessMap = () => readStorage(COLLABS_KEY, {});
export const getContributionActivity = (playlistId) => readStorage(ACTIVITY_KEY, {})[playlistId] || [];

export const isPlaylistCollaborator = (playlistId, username) => {
  const normalized = (username || "").trim().toLowerCase();
  if (!playlistId || !normalized || normalized === "guest") return false;
  return getCollaboratorUsernames(playlistId).includes(normalized);
};

export const respondToCollaborationRequest = (requestId, status) => {
  const requests = getCollaborationRequests();
  const nextRequests = requests.map((request) =>
    request.id === requestId ? { ...request, status } : request
  );

  const acceptedRequest = requests.find((request) => request.id === requestId);
  if (status === "accepted" && acceptedRequest) {
    const access = readStorage(COLLABS_KEY, {});
    const current = access[acceptedRequest.playlistId] || [];
    if (!current.includes(acceptedRequest.requesterUsername)) {
      access[acceptedRequest.playlistId] = [...current, acceptedRequest.requesterUsername];
      localStorage.setItem(COLLABS_KEY, JSON.stringify(access));
    }
  }

  writeStorage(REQUESTS_KEY, nextRequests);
};

export const removePlaylistCollaborator = (playlistId, username) => {
  const access = readStorage(COLLABS_KEY, {});
  const normalized = (username || "").trim().toLowerCase();
  if (!playlistId || !normalized) return;

  access[playlistId] = (access[playlistId] || []).filter((item) => item !== normalized);
  writeStorage(COLLABS_KEY, access);
};

export const removeOutgoingCollaborationRequest = (playlistId, requesterUsername) => {
  const normalized = (requesterUsername || "").trim().toLowerCase();
  const requests = getCollaborationRequests().filter(
    (request) =>
      !(request.playlistId === playlistId && request.requesterUsername === normalized && request.status === "pending")
  );
  writeStorage(REQUESTS_KEY, requests);
};

export const logContributionActivity = ({
  actorUsername,
  actorDisplayName,
  playlistId,
  playlistName,
  type,
  text,
}) => {
  if (!playlistId || !actorUsername || !text) return;

  const activity = readStorage(ACTIVITY_KEY, {});
  const current = activity[playlistId] || [];
  activity[playlistId] = [
    {
      id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      actorUsername: (actorUsername || "").trim().toLowerCase(),
      actorDisplayName: actorDisplayName || actorUsername,
      playlistId,
      playlistName: playlistName || "Playlist",
      type: type || "update",
      text,
      createdAt: new Date().toISOString(),
    },
    ...current,
  ];

  writeStorage(ACTIVITY_KEY, activity);
};

export const canEditPlaylist = (playlist, username) => {
  const normalized = (username || "").trim().toLowerCase();
  if (!playlist?._id || !normalized || normalized === "guest") return false;
  if ((playlist.ownerUsername || "").trim().toLowerCase() === normalized) return true;
  return isPlaylistCollaborator(playlist._id, normalized);
};

export const getPlaylistDraft = (playlistId) => {
  const drafts = readStorage(DRAFTS_KEY, {});
  return drafts[playlistId] || null;
};

export const savePlaylistDraft = (playlistId, draft) => {
  const drafts = readStorage(DRAFTS_KEY, {});
  drafts[playlistId] = {
    ...(drafts[playlistId] || {}),
    ...draft,
    updatedAt: new Date().toISOString(),
  };
  writeStorage(DRAFTS_KEY, drafts);
  return drafts[playlistId];
};
