# 🎵 Moody Player  
## AI-Powered Music Ecosystem Based on Your Mood

<p align="center">
  <img src="https://img.shields.io/badge/AI-Emotion%20Detection-purple?style=for-the-badge" />
  <img src="https://img.shields.io/badge/React-19-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Node.js-Backend-green?style=for-the-badge" />
  <img src="https://img.shields.io/badge/MongoDB-Database-darkgreen?style=for-the-badge" />
  <img src="https://img.shields.io/badge/WASM-Essentia-orange?style=for-the-badge" />
  <img src="https://img.shields.io/badge/ImageKit-CDN-red?style=for-the-badge" />
</p>

<p align="center">
  <strong>Detect Emotion → Analyze Music → Curate Playlists → Control Experience</strong>
</p>

---

# 🚀 Overview

Moody Player is a full-stack AI-powered music platform that intelligently connects:

- 🎭 Real-Time Facial Emotion Detection  
- 🎧 WASM-Based Audio Feature Intelligence  
- 📚 Advanced Playlist & Queue Management  
- 🔁 Smart Playback & Loop Controls  
- ☁️ Cloud File Storage  
- 💾 Persistent MongoDB Architecture  
- 📱 Fully Responsive Split-Screen UI  

This is not just a music player.  
It is a **mood-driven music engine designed with real-world architecture principles.**

---

# 📊 Mood Intelligence Dashboard

Moody Player classifies songs into five emotional categories using AI-powered audio and facial analysis.

## 🎵 Mood Distribution

```mermaid
pie
    title Mood Distribution
    "Happy" : 30
    "Sad" : 18
    "Neutral" : 22
    "Angry" : 12
    "Surprised" : 10
```

---



# 🔄 Application Workflow

This section explains how Moody Player operates from user interaction to system response.

## 🎵 Song Upload Workflow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Essentia
    participant Backend
    participant MongoDB
    participant ImageKit

    User->>Frontend: Upload Song
    Frontend->>Essentia: Extract Audio Features
    Essentia-->>Frontend: Return BPM & Energy Data
    Frontend->>Backend: Send Song Metadata
    Backend->>MongoDB: Store Song Record
    Backend->>ImageKit: Upload Audio File
    Backend-->>Frontend: Confirm Upload
```

**Process Summary:**
1. User uploads audio file.
2. Essentia.js extracts audio features in-browser.
3. Mood classification assigned.
4. Metadata saved in MongoDB.
5. Audio file stored securely on ImageKit CDN.

---

## 🎭 Mood Detection Workflow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant FaceAPI
    participant Backend
    participant MongoDB

    User->>Frontend: Click Detect Mood
    Frontend->>FaceAPI: Capture Facial Expression
    FaceAPI-->>Frontend: Return Emotion
    Frontend->>Backend: Fetch Songs by Mood
    Backend->>MongoDB: Query Songs
    MongoDB-->>Frontend: Return Matching Songs
```

**Process Summary:**
1. Webcam activates.
2. face-api.js detects emotion.
3. System fetches songs matching mood.
4. Playlist auto-populates.

---

# 🧠 System Architecture

```mermaid
flowchart LR
    User -->|Upload Song| Frontend
    Frontend -->|Audio Analysis| EssentiaJS
    EssentiaJS -->|Mood Classification| Backend
    Backend -->|Save Metadata| MongoDB
    Backend -->|Upload Audio| ImageKit

    User -->|Detect Mood| FaceAPI
    FaceAPI -->|Emotion Result| Frontend
    Frontend -->|Fetch Songs| Backend
    Backend --> MongoDB
```

---

# 🎛 Core Features

## 🎭 Real-Time Mood Detection
- Webcam-based facial recognition
- Emotion confidence scoring
- Instant mood-based recommendation engine

---

## 🎧 Audio Intelligence (WASM)
- BPM detection
- Loudness measurement
- Spectral centroid mapping
- Energy scoring
- Automatic mood tagging

---

## 📚 Advanced Playlist Management
- Unlimited playlist creation
- Drag-and-drop queue reordering
- Cross-playlist copy system
- Duplicate prevention logic
- Real-time synchronization

---

## 🔁 Enhanced Playback Controls

| Mode | Function |
|------|----------|
| Normal | Sequential playback |
| Loop All | Repeat entire playlist |
| Loop One | Repeat single track |

Includes:
- Seekable progress bar
- Volume control
- Now playing section
- Auto next-track transition

---



# 📱 Responsive Design Optimization

- Mobile-first layout
- Adaptive split-screen
- Touch-friendly UI
- Zero layout shift structure

---

# ⚡ Tech Stack

## Frontend
- React 19 + Vite
- face-api.js
- Essentia.js (WASM)
- Axios
- Modern CSS3

## Backend
- Node.js
- Express.js
- MongoDB + Mongoose
- Multer
- ImageKit CDN

---

# 📦 Installation & Setup

## Backend

```bash
cd Backend
npm install

# Create .env file
# MONGODB_URI=
# IMAGEKIT_PUBLIC_KEY=
# IMAGEKIT_PRIVATE_KEY=
# IMAGEKIT_URL_ENDPOINT=

npx nodemon server.js
```

Backend runs on:
```
http://localhost:3000
```

---

## Frontend

```bash
cd Frontend
npm install
npm run dev
```

Frontend runs on:
```
http://localhost:5173
```

---

# 🔌 API Overview

| Method | Endpoint | Purpose |
|--------|----------|----------|
| POST | /playlists | Create playlist |
| POST | /playlists/:id/songs/upload | Upload song |
| POST | /playlists/:targetId/songs/transfer | Copy song |
| PUT | /playlists/:id/songs/reorder | Reorder queue |
| GET | /songs/mood/:mood | Fetch songs by mood |
| DELETE | /songs/:id | Delete song |

---

# 🏆 Why This Project Stands Out

Moody Player demonstrates:

- Real-time AI integration in web apps  
- WASM-powered audio intelligence  
- Complex drag-and-drop engineering  
- Full-stack CRUD architecture  
- Cloud-based file handling  
- Database relationship management  
- Responsive UI engineering  
- Production-level workflow design  

It merges **Machine Learning + UX + Full-Stack Engineering** into a cohesive ecosystem.

---

# ❤️ Final Note

Music feels different when it understands you.

Moody Player transforms emotion into sound —  
turning your face into your playlist.

⭐ If this project matches your vibe, consider starring the repository.
