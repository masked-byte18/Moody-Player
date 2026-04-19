require("dotenv").config();
const mongoose = require("mongoose");
const playlistModel = require("./src/models/playlist.model");

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    try {
        const p = await playlistModel.findOne({ ownerUsername: "test" }).populate("songs");
        if (p) {
            console.log("Playlist Found:", p.name);
            console.log("- isFeatured:", p.isFeatured);
            console.log("- contributors:", p.contributors);
            console.log("- Songs:", p.songs.map(s => ({ id: s._id, title: s.title, duration: s.duration })));
        } else {
            console.log("No playlist found for 'test'");
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
});
