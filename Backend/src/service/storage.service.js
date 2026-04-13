const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const ImageKit = require("@imagekit/nodejs");
const { toFile } = require("@imagekit/nodejs");

const uploadsRoot = path.join(process.cwd(), "uploads");
const getPublicBaseUrl = () =>
  String(process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, "");

const imageKitConfigured = () =>
  Boolean(
    process.env.IMAGEKIT_PUBLIC_KEY &&
      process.env.IMAGEKIT_PRIVATE_KEY &&
      process.env.IMAGEKIT_URL_ENDPOINT
  );

const buildImageKitClient = () =>
  new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  });

const toSafeSegment = (value = "") =>
  String(value)
    .trim()
    .replace(/^\/*/, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");

const inferExtension = (mimeType = "", originalName = "") => {
  const fromName = path.extname(originalName || "").trim();
  if (fromName) {
    return fromName.toLowerCase();
  }

  if (mimeType.startsWith("image/")) {
    return ".jpg";
  }

  if (mimeType.startsWith("audio/") || mimeType === "video/mpeg") {
    return ".mp3";
  }

  return ".bin";
};

const writeToLocalDisk = async (file, folder = "cohort-audio") => {
  const safeFolder = toSafeSegment(folder) || "cohort-audio";
  const targetDir = path.join(uploadsRoot, safeFolder);
  await fs.mkdir(targetDir, { recursive: true });

  const extension = inferExtension(file.mimetype, file.originalname);
  const baseName = path
    .basename(file.originalname || "upload", path.extname(file.originalname || ""))
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 64);
  const unique = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
  const fileName = `${baseName || "file"}-${unique}${extension}`;
  const absolutePath = path.join(targetDir, fileName);

  await fs.writeFile(absolutePath, file.buffer);

  return {
    fileId: `local-${unique}`,
    name: fileName,
    url: `${getPublicBaseUrl()}/uploads/${safeFolder}/${fileName}`,
  };
};

async function uploadFile(file, folder = "cohort-audio") {
  if (imageKitConfigured()) {
    try {
      const imagekit = buildImageKitClient();
      const uploadable = await toFile(file.buffer, file.originalname);
      return await imagekit.files.upload({
        file: uploadable,
        fileName: file.originalname,
        folder,
      });
    } catch (error) {
      console.warn("ImageKit upload failed. Falling back to local uploads.", error.message);
    }
  }

  return writeToLocalDisk(file, folder);
}

module.exports = uploadFile;
