const mongoose = require('mongoose');

async function connectDB() {
  const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URI;
  if (!mongoUrl) {
    throw new Error("Missing MongoDB connection string. Set MONGODB_URL or MONGODB_URI.");
  }

  await mongoose.connect(mongoUrl);
  console.log("Connected to MongoDB");
}

module.exports = connectDB;
