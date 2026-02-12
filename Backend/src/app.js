const express = require('express');
const songRoutes = require("./routes/song.routes")
const playlistRoutes = require("./routes/playlist.routes")
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/',songRoutes);
app.use('/',playlistRoutes);

module.exports = app;