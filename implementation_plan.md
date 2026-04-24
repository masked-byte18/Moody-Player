# Moody Player — Flow Fixes, Likes, Notifications & UX Polish

## Root Cause Analysis

### Why collaboration requests auto-reject
The **contribution request** from `PlaylistPage.jsx` calls `createCollaborationRequest()` which **only saves to localStorage** (in `collaborationInbox.js`). But the **Notification Inbox** reads from **MongoDB** via `GET /collab/requests/inbox`. So the owner never sees the real request. Additionally, the backend unpublish endpoint mass-rejects all pending/accepted requests in the DB — if any stale data existed, it gets shown as "rejected".

**Fix:** Make `PlaylistPage` call the **backend API** `POST /playlists/:id/collab/request` instead of the localStorage-only utility, so requests go into MongoDB and appear correctly in the owner's inbox.

---

## Proposed Changes

### Component 1: Fix Collaboration Request Flow

#### [MODIFY] [PlaylistPage.jsx](file:///c:/Users/rajka/Desktop/Web_Dev/Seriyans%20Coding%20School/Backend/Moody%20Player/Frontend/src/components/PlaylistPage.jsx)
- Replace `createCollaborationRequest(...)` (localStorage) with `axios.post(API + '/playlists/' + id + '/collab/request', { message }, authConfig)` (backend API)
- Also check for pending requests from the backend (`GET /collab/requests/outgoing`) instead of localStorage

---

### Component 2: Like Feature on Discover Page

#### [MODIFY] [playlist.model.js](file:///c:/Users/rajka/Desktop/Web_Dev/Seriyans%20Coding%20School/Backend/Moody%20Player/Backend/src/models/playlist.model.js)
- Add `likesCount: { type: Number, default: 0 }` field
- Add `likedBy: [{ type: String, lowercase: true, trim: true }]` array field

#### [MODIFY] [playlist.routes.js](file:///c:/Users/rajka/Desktop/Web_Dev/Seriyans%20Coding%20School/Backend/Moody%20Player/Backend/src/routes/playlist.routes.js)
- Add `POST /playlists/:id/like` — toggles like (add/remove from `likedBy`, increment/decrement `likesCount`)
- Add `GET /playlists/:id/likes` — returns `{ likesCount, isLiked }` for current user

#### [MODIFY] [FeaturedHubPage.jsx](file:///c:/Users/rajka/Desktop/Web_Dev/Seriyans%20Coding%20School/Backend/Moody%20Player/Frontend/src/components/FeaturedHubPage.jsx)
- Add a ❤️ like button next to the `+` (clone) button on each discover card
- Show dynamic like count in small text beside the button
- On click: call `POST /playlists/:id/like`, update count locally

#### [MODIFY] [DiscoverProfilePage.jsx](file:///c:/Users/rajka/Desktop/Web_Dev/Seriyans%20Coding%20School/Backend/Moody%20Player/Frontend/src/components/DiscoverProfilePage.jsx)
- Same like button with count as FeaturedHubPage

---

### Component 3: Real Notification System

#### [NEW] [notification.model.js](file:///c:/Users/rajka/Desktop/Web_Dev/Seriyans%20Coding%20School/Backend/Moody%20Player/Backend/src/models/notification.model.js)
- Schema: `{ recipientUsername, senderUsername, senderDisplayName, type (follow | new_playlist | like_playlist | collab_rejected), message, playlistId?, playlistName?, read, createdAt }`

#### [MODIFY] [playlist.routes.js](file:///c:/Users/rajka/Desktop/Web_Dev/Seriyans%20Coding%20School/Backend/Moody%20Player/Backend/src/routes/playlist.routes.js)
- Add `GET /notifications` — fetch notifications for logged-in user
- Add `PUT /notifications/:id/read` — mark as read
- **When user follows someone** (`POST /social/follow`): create a notification for the target user → "X started following you"
- **When user publishes a playlist** (`PUT /playlists/:id/publish` with `isFeatured: true`): create notifications for all followers → "X published a new playlist: Y"
- **When user likes a playlist** (`POST /playlists/:id/like`): create notification for playlist owner → "X liked your playlist Y"
- **When owner rejects a collab request** (`POST /collab/requests/:id/respond` with `rejected`): create notification for the requester → "Your request to contribute to Y was rejected"

#### [MODIFY] [NotificationsPage.jsx](file:///c:/Users/rajka/Desktop/Web_Dev/Seriyans%20Coding%20School/Backend/Moody%20Player/Frontend/src/components/NotificationsPage.jsx)
- Replace dummy `getDummyFriendNotifications` with real `GET /notifications` API data
- Show 3 update types in the "Friend Requests & Updates" tab:
  1. Follow/friend requests
  2. Friend published new playlist
  3. Friend liked a playlist
- In the "Contribution Inbox" tab: also show **outgoing rejected requests** from `GET /collab/requests/outgoing` so the requester sees "Your request was rejected"

---

### Component 4: Library Duplicate Protection

#### [MODIFY] [playlist.routes.js](file:///c:/Users/rajka/Desktop/Web_Dev/Seriyans%20Coding%20School/Backend/Moody%20Player/Backend/src/routes/playlist.routes.js) — `/playlists/:id/clone`
- Before cloning, check if user already owns a playlist with the exact same `name` AND original source. Return `409 { message: "This playlist already exists in your library" }` if duplicate.

#### [MODIFY] [FeaturedHubPage.jsx](file:///c:/Users/rajka/Desktop/Web_Dev/Seriyans%20Coding%20School/Backend/Moody%20Player/Frontend/src/components/FeaturedHubPage.jsx)
- Replace `alert()` with inline toast message for both success and "already exists" scenarios

---

### Component 5: Login UX — Replace Popups with Inline Messages

#### [MODIFY] [LoginPage.jsx](file:///c:/Users/rajka/Desktop/Web_Dev/Seriyans%20Coding%20School/Backend/Moody%20Player/Frontend/src/components/LoginPage.jsx)
- Remove `alert("OTP sent...")` — instead, just transition to the OTP form directly
- Add a subtle white helper text beside the "Send OTP" button: `"You'll receive an OTP in your email"`
- Replace `alert(error.message)` with inline red error text below the form: `"Wrong credentials, please try again"`
- Add `formError` and `formHint` state variables

#### [MODIFY] [AuthPage.css](file:///c:/Users/rajka/Desktop/Web_Dev/Seriyans%20Coding%20School/Backend/Moody%20Player/Frontend/src/components/AuthPage.css)
- Add `.auth-error` class (red text below form)
- Add `.auth-hint-inline` class (white/muted text beside button)

---

### Component 6: Global Alert Replacement

> [!IMPORTANT]
> Replace `alert()` calls across `FeaturedHubPage.jsx`, `DiscoverProfilePage.jsx`, and `PlaylistPage.jsx` with inline toast/feedback messages instead of browser popup dialogs.

#### [MODIFY] Multiple frontend files
- Add a simple `toast` state + auto-dismiss component
- Show success messages as green inline toasts
- Show error messages as red inline toasts
- Keep the toast within the page shell, auto-dismiss after 3 seconds

---

### Component 7: Real Follower/Following Counts

#### [MODIFY] [DiscoverProfilePage.jsx](file:///c:/Users/rajka/Desktop/Web_Dev/Seriyans%20Coding%20School/Backend/Moody%20Player/Frontend/src/components/DiscoverProfilePage.jsx)
- Replace the dummy calculation `publicPlaylists.length * 12 + 8` with a real API call to `GET /social/stats/:username`
- Store `followerCount` and `followingCount` in state
- Refresh counts after follow/unfollow toggle so they update live
- The backend endpoint already exists and works correctly (`playlist.routes.js` line 1031)

---

## Design Decisions

- **`clonedFrom` field:** Yes — we'll add a `clonedFrom` ObjectId to the playlist model. This lets us check if a user already cloned a specific playlist and show "already in library" on discover cards in real-time.
- **Likes visibility:** Like counts will be visible to everyone including non-logged-in users. Only the like toggle action requires authentication.

## Verification Plan

### Automated Tests
- Restart backend server and confirm no crashes
- `npm run build` on frontend to verify no compilation errors

### Manual Verification
1. Send a contribution request from User B → verify it shows as "pending" in User A's inbox
2. Accept/reject from User A → verify User B sees the correct status
3. Click like on a discover playlist → verify count updates
4. Clone playlist → verify it appears in the user's library
5. Clone same playlist again → verify "already exists" message
6. Login with wrong credentials → verify red error text appears below form
7. Login with correct credentials → verify direct transition to OTP step with no popup
