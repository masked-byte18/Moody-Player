export const getDummyFriendNotifications = (username) => {
  const normalized = (username || "").trim().toLowerCase();
  if (!normalized || normalized === "guest") return [];

  return [
    {
      id: `friend-request-${normalized}-1`,
      type: "request",
      fromUsername: "djarya",
      fromDisplayName: "DJ Arya",
      message: "sent you a follow request and wants to swap playlist ideas.",
      createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    },
    {
      id: `friend-update-${normalized}-1`,
      type: "update",
      fromUsername: "moonframes",
      fromDisplayName: "Moon Frames",
      message: "just uploaded Cloud Radio with 3 new dreamy tracks.",
      createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    },
    {
      id: `friend-update-${normalized}-2`,
      type: "update",
      fromUsername: "novaecho",
      fromDisplayName: "Nova Echo",
      message: "started following your profile and liked your latest mood mix.",
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
  ];
};

export const getDummyFriendsList = (username) => {
  const normalized = (username || "").trim().toLowerCase();
  if (!normalized || normalized === "guest") return [];

  return [
    {
      id: `friend-list-${normalized}-1`,
      username: "djarya",
      displayName: "DJ Arya",
      mood: "Energetic",
      note: "Builds strong late-night dance playlists.",
    },
    {
      id: `friend-list-${normalized}-2`,
      username: "moonframes",
      displayName: "Moon Frames",
      mood: "Dreamy",
      note: "Great for softer indie and floating mood transitions.",
    },
    {
      id: `friend-list-${normalized}-3`,
      username: "novaecho",
      displayName: "Nova Echo",
      mood: "Happy",
      note: "Likes sharing upbeat community mixes.",
    },
  ];
};
