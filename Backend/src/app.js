const express = require('express');
const path = require("path");
const songRoutes = require("./routes/song.routes")
const playlistRoutes = require("./routes/playlist.routes")
const authRoutes = require("./routes/auth.routes")
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use('/',songRoutes);
app.use('/',playlistRoutes);
app.use('/',authRoutes);

module.exports = app;
