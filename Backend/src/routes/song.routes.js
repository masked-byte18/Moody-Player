const express = require("express");
const multer = require("multer");
const router = express.Router();
const { requireAuth, optionalAuth } = require("../middleware/auth.middleware");
const songController = require("../controllers/song.controller");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = new Set(["audio/mpeg", "video/mpeg"]);
    if (file.mimetype.startsWith("audio/") || allowedTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only audio files allowed"), false);
  },
});

router.post("/songs", requireAuth, upload.single("audio"), songController.createSong);

router.get("/songs", optionalAuth, songController.getSongs);
router.get("/songs/mine", requireAuth, songController.getMySongs);
router.get("/songs/mood/:mood", optionalAuth, songController.getSongsByMood);

router.delete("/songs/:id", requireAuth, songController.deleteSong);

module.exports = router;
