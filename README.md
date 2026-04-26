# 🎵 Moody Player

Moody Player is a modern, AI-powered music application that curates personalized, mood-based playlists by detecting your facial expressions in real-time. Designed with collaboration and social interaction in mind, Moody Player allows you to discover new music, share your playlists, collaborate with friends, and see what the community is listening to.

**🔗 Live Demo: [https://your-live-link-here.com](https://your-live-link-here.com)**

![Moody Player Preview](./Frontend/public/favicon.ico) *(Feel free to add your own screenshots here!)*

---

## 🌊 Platform Architecture & Data Flow

Moody Player is composed of several interconnected subsystems that blend AI, social networking, and real-time collaboration. Below is a detailed view of how data flows through the platform.

### 1. High-Level System Architecture

This diagram illustrates the macro-level interactions between the User, the Frontend (React + AI Models), the Backend API, and external services like Jamendo.

```mermaid
flowchart TD
    %% Entities
    User((User))
    Jamendo[Jamendo API]
    
    %% Frontend Layer
    subgraph Frontend [Frontend Client - React/Vite]
        UI[UI Components & Player]
        FaceAPI[face-api.js Model]
    end

    %% Backend Layer
    subgraph Backend [Backend Server - Node/Express]
        Auth[Auth Service]
        CollabServ[Collaboration Service]
        MusicServ[Music & Playlist Service]
        SocialServ[Social Service]
    end

    %% Database Layer
    DB[(MongoDB)]

    %% Connections
    User <-->|Interacts| UI
    User -->|Webcam Feed| FaceAPI
    FaceAPI -->|Extracted Mood| UI
    
    UI <-->|JWT Auth| Auth
    UI <-->|Fetch/Search Music| Jamendo
    UI <-->|Manage Playlists| MusicServ
    UI <-->|Collab Requests| CollabServ
    UI <-->|Follows / Feed| SocialServ
    
    Auth <--> DB
    CollabServ <--> DB
    MusicServ <--> DB
    SocialServ <--> DB
```

---

### 2. The Core AI Music Flow

When a user visits the main page, the application uses their webcam to detect their current emotion and instantly curates a listening experience.

```mermaid
sequenceDiagram
    participant User
    participant Browser as React Frontend
    participant AI as face-api.js (Local)
    participant API as Express API
    participant DB as MongoDB

    User->>Browser: Clicks "Detect Mood"
    Browser->>User: Prompts for Webcam Access
    User-->>Browser: Grants Access
    Browser->>AI: Passes Video Frame
    AI-->>Browser: Returns Emotion Scores (e.g., Happy: 0.85)
    Browser->>Browser: Selects Dominant Mood ("happy")
    Browser->>API: GET /songs?mood=happy
    API->>DB: Query songs matching mood
    DB-->>API: Array of Songs
    API-->>Browser: JSON Playlist Data
    Browser->>User: Starts Playing Upbeat Music
```

---

### 3. Collaborative Playlist Lifecycle

Moody Player allows users to request edit access to public playlists. Once approved, contributors can add, delete, or reorder songs, with every action tracked in an activity ledger.

```mermaid
stateDiagram-v2
    [*] --> PublicPlaylist: Owner creates playlist
    
    state "Social Discovery" as SD {
        PublicPlaylist --> UserBrowsing: User finds playlist
        UserBrowsing --> RequestSent: User clicks "Contribute"
    }
    
    state "Inbox Management" as IM {
        RequestSent --> OwnerInbox: Notification created
        OwnerInbox --> Rejected: Owner Rejects
        OwnerInbox --> Accepted: Owner Accepts
    }
    
    Rejected --> [*]
    
    state "Collaborative Editing" as CE {
        Accepted --> ContributorAccess
        ContributorAccess --> AddSong: Uploads/Adds Jamendo track
        ContributorAccess --> ReorderSong: Drags to change order
        ContributorAccess --> DeleteSong: Removes a track
        
        AddSong --> ActivityLog: Logs "Added Song"
        ReorderSong --> ActivityLog: Logs "Reordered"
        DeleteSong --> ActivityLog: Logs "Deleted Song"
    }
    
    ActivityLog --> PlaylistUpdated: Real-time update
    PlaylistUpdated --> [*]
```

---

### 4. External Discovery (Jamendo Integration)

Users can step out of their local library to discover trending, royalty-free tracks worldwide and bring them into the Moody ecosystem.

```mermaid
flowchart LR
    A[User on Explore Page] -->|Searches Lo-Fi| B(Jamendo API)
    B -->|Returns Track List| C{Frontend Actions}
    
    C -->|Play Track| D[Audio Player Streams from Jamendo URL]
    C -->|Like Track| E[Backend creates external reference & increments likes]
    C -->|Add to Playlist| F[Backend saves Jamendo URL into MongoDB Playlist]
```

---

## ✨ Key Features

- **🎭 AI Facial Expression Detection**: Utilizes your device's webcam and `face-api.js` to analyze your current facial expression and automatically curate a customized music queue matching your mood.
- **🤝 Real-time Collaborative Playlists**: Create playlists and invite friends to contribute. Manage incoming contribution requests via a dedicated inbox, and see real-time playlist activity and analytics.
- **🌍 Social & Discovery Hub**: Follow other users, see their public playlists, and get notified about their latest activity. 
- **🎧 Jamendo API Integration**: Explore trending, royalty-free tracks directly from independent artists using the Jamendo API. Play them instantly or save them to your personal playlists.
- **🎨 Premium UI/UX**: Features a highly responsive, mobile-first design with a beautiful custom theme system (Charcoal and Deep Blue), glassmorphism effects, and smooth micro-animations.

## 🛠 Tech Stack

**Frontend**:
- **React (Vite)**: For blazing-fast development and optimized production builds.
- **React Router**: For seamless, client-side navigation.
- **Face-api.js**: For running in-browser, lightweight AI models (TinyFaceDetector, FaceExpressionNet) to detect moods.
- **Vanilla CSS**: Fully custom, responsive styling without heavy CSS frameworks.
- **Axios**: For API requests.

**Backend**:
- **Node.js & Express.js**: Robust, scalable backend architecture.
- **MongoDB & Mongoose**: Flexible NoSQL database for managing users, playlists, songs, and social graphs.
- **JWT Authentication**: Secure user login and registration flow.
- **Multer**: For handling profile photo and local song uploads.

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites
- Node.js (v16+)
- MongoDB (Local instance or MongoDB Atlas cluster)
- A free Jamendo Developer Client ID (for the Explore feature)

### 1. Backend Setup
1. Navigate to the `Backend` directory:
   ```bash
   cd Backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `Backend` directory and configure the following variables:
   ```env
   PORT=3000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_super_secret_jwt_key
   ```
4. Start the backend development server:
   ```bash
   npm run dev
   ```

### 2. Frontend Setup
1. Open a new terminal and navigate to the `Frontend` directory:
   ```bash
   cd Frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `Frontend` directory and add your Jamendo Client ID:
   ```env
   VITE_JAMENDO_CLIENT_ID=your_jamendo_client_id
   ```
4. Start the frontend development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173`.

## 📁 Project Structure

```
Moody Player/
├── Backend/                 # Express Server & API routes
│   ├── src/
│   │   ├── controllers/     # Route logic
│   │   ├── middleware/      # Auth & file upload middlewares
│   │   ├── models/          # Mongoose schemas (User, Playlist, Song, etc.)
│   │   ├── routes/          # Express route definitions
│   │   ├── service/         # Business logic & integrations
│   │   └── index.js         # Server entry point
│   └── package.json
│
├── Frontend/                # React UI
│   ├── public/              # Static assets & AI Models (/models)
│   ├── src/
│   │   ├── components/      # React components (Sidebar, PlayerFooter, Pages)
│   │   ├── utils/           # Helper functions (audio mood extraction)
│   │   ├── App.jsx          # Main application routing
│   │   └── index.css        # Global design tokens and utilities
│   └── package.json
└── README.md
```

## 📝 License
This project is for educational and portfolio purposes. Data fetched from Jamendo is subject to Jamendo's API usage terms.
