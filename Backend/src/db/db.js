const mongoose = require('mongoose');
const songModel = require("../models/song.model");

async function connectDB() {
  const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URI;
  if (!mongoUrl) {
    throw new Error("Missing MongoDB connection string. Set MONGODB_URL or MONGODB_URI.");
  }

  await mongoose.connect(mongoUrl);

  // Migration guard: remove legacy unique index on titleKey so central DB can store songs
  // with the same title while deduping by audioHash/title+artist pair.
  const indexes = await songModel.collection.indexes();
  const legacyTitleKeyUniqueIndex = indexes.find(
    (index) => index?.key?.titleKey === 1 && index?.unique
  );
  if (legacyTitleKeyUniqueIndex?.name) {
    await songModel.collection.dropIndex(legacyTitleKeyUniqueIndex.name);
  }

  console.log("Connected to MongoDB");
}

module.exports = connectDB;
