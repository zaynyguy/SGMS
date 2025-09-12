// src/middleware/uploadMiddleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || "10", 10);
const MAX_SIZE = MAX_UPLOAD_MB * 1024 * 1024;

const DEFAULT_ALLOWED = [
  "image/png", "image/jpeg", "image/jpg", "image/gif",
  "application/pdf", "text/plain", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
];

const envAllowed = process.env.ALLOWED_MIMETYPES
  ? process.env.ALLOWED_MIMETYPES.split(",").map(s => s.trim())
  : [];
const ALLOWED_MIMETYPES = envAllowed.length ? envAllowed : DEFAULT_ALLOWED;

// ✅ Only make local folder if Cloudinary is NOT being used
const CLOUDINARY_ENABLED =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (!CLOUDINARY_ENABLED) {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (CLOUDINARY_ENABLED) {
      // Store temp file in system tmp dir, will be uploaded to Cloudinary then deleted
      cb(null, "/tmp");
    } else {
      cb(null, UPLOAD_DIR);
    }
  },
  filename: (req, file, cb) => {
    const safeBase = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = path.extname(safeBase).toLowerCase();
    const name = path.basename(safeBase, ext);
    cb(null, `${Date.now()}_${name}${ext}`);
  }
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    return cb(new Error("Unsupported file type"), false);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
});

module.exports = { upload, UPLOAD_DIR, ALLOWED_MIMETYPES, MAX_UPLOAD_MB, CLOUDINARY_ENABLED };
