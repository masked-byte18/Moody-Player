const express = require('express');
const path = require("path");
const songRoutes = require("./routes/song.routes")
const playlistRoutes = require("./routes/playlist.routes")
const authRoutes = require("./routes/auth.routes")
const cors = require('cors');
const app = express();


// Serve frontend static files FIRST (before CORS/API middleware)
const frontendPath = path.join(__dirname, '../public');

// Allow Google Identity Services popup to communicate with the main window
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

app.use(express.static(frontendPath));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use('/',songRoutes);
app.use('/',playlistRoutes);
app.use('/',authRoutes);

app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});


module.exports = app;
