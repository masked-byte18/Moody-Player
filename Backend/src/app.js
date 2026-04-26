const express = require('express');
const path = require("path");
const songRoutes = require("./routes/song.routes")
const playlistRoutes = require("./routes/playlist.routes")
const authRoutes = require("./routes/auth.routes")
const cors = require('cors');
const app = express();
const configuredOrigins = String(process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (configuredOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

const frontendPath = path.join(__dirname, '../../Frontend/dist');
app.use(express.static(frontendPath));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use('/',songRoutes);
app.use('/',playlistRoutes);
app.use('/',authRoutes);

app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});


module.exports = app;
