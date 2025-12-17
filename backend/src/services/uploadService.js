// src/services/uploadService.js
const fs = require("fs");
const path = require("path");
const { UPLOAD_DIR } = require("../middleware/uploadMiddleware");

exports.uploadFile = async (file) => {
  if (!file) throw new Error("No file uploaded");

  // Multer already persisted the file into UPLOAD_DIR using a safe filename.
  const filename = path.basename(file.path);
  return {
    url: filename,
    provider: "local",
    fileName: file.originalname,
    fileType: file.mimetype,
    publicId: null,
  };
};

exports.deleteFile = async (filePath) => {
  if (!filePath) return;
  try {
    const fullPath = path.join(UPLOAD_DIR, path.basename(filePath));
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (err) {
    console.error("Local delete failed:", err);
  }
};
