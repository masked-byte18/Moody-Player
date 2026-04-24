require("dotenv").config();
const mongoose = require("mongoose");
const playlistModel = require("./src/models/playlist.model");
const userProfileModel = require("./src/models/userProfile.model");

mongoose.connect(process.env.MONGODB_URL).then(async () => {
    try {
        const playlist = await playlistModel.findOne({ "contributors.0": { $exists: true } });
        if (playlist) {
            console.log("Collab playlist:", playlist._id, playlist.name);
            console.log("Songs:", playlist.songs);
            console.log("Owner:", playlist.ownerUsername);
            console.log("Contributors:", playlist.contributors);
        } else {
            console.log("No collaborative playlists found.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
});
