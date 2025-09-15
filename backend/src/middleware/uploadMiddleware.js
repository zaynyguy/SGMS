// src/middleware/uploadMiddleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db"); // used to read SystemSettings
require("dotenv").config();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || "10", 10);
const MAX_SIZE = MAX_UPLOAD_MB * 1024 * 1024;

const DEFAULT_ALLOWED = [
  "image/png", "image/jpeg", "image/jpg", "image/gif",
  "application/pdf", "text/plain", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed"
];

// env override (keeps old behaviour if you still want env-based list)
const envAllowed = process.env.ALLOWED_MIMETYPES
  ? process.env.ALLOWED_MIMETYPES.split(",").map(s => s.trim())
  : [];
const ALLOWED_MIMETYPES = envAllowed.length ? envAllowed : DEFAULT_ALLOWED;

// Cloudinary toggle (string truthiness is fine)
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
    // If cloudinary enabled, store temporarily in /tmp so uploadService can push to cloudinary
    if (CLOUDINARY_ENABLED) {
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

/**
 * fileFilter is async: it will attempt to read allowed mimetypes from SystemSettings 
 * key = 'allowed_mimetypes'. That setting can be stored as:
 *  - JSON array in the value column (Postgres JSONB) OR
 *  - comma-separated string
 *
 * Fallback is ALLOWED_MIMETYPES above.
 */
function fileFilter(req, file, cb) {
  (async () => {
    try {
      const q = await db.query(`SELECT value FROM "SystemSettings" WHERE key = $1 LIMIT 1`, ['allowed_mimetypes']);
      let allowed = ALLOWED_MIMETYPES;

      if (q.rows[0]) {
        const raw = q.rows[0].value;
        if (Array.isArray(raw)) {
          allowed = raw;
        } else if (typeof raw === 'string') {
          // accept JSON-stringified arrays or comma-separated strings
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) allowed = parsed;
            else allowed = raw.split(",").map(s => s.trim());
          } catch (e) {
            allowed = raw.split(",").map(s => s.trim());
          }
        } else if (raw && typeof raw === 'object' && raw.allowed) {
          // support { "allowed": [...] } structure too
          if (Array.isArray(raw.allowed)) allowed = raw.allowed;
        }
      }

      // Accept if mimetype exactly matches or if allowed contains wildcard '*/*'
      if (allowed.includes(file.mimetype) || allowed.includes('*/*')) {
        return cb(null, true);
      }

      // Special-case: some OSes report "application/zip" for .docx/.xlsx/etc.
      // If allowed explicitly contains the official docx/xlsx mime, accept zip as well.
      const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      if ((file.mimetype === "application/zip" || file.mimetype === "application/x-zip-compressed") &&
          (allowed.includes(docxMime) || allowed.includes(xlsxMime) || allowed.includes("application/pdf"))) {
        return cb(null, true);
      }

      return cb(new Error("Unsupported file type"), false);
    } catch (err) {
      console.error("fileFilter system settings read failed:", err);
      // fallback to static list
      if (ALLOWED_MIMETYPES.includes(file.mimetype)) return cb(null, true);
      return cb(new Error("Unsupported file type"), false);
    }
  })();
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
});

module.exports = { upload, UPLOAD_DIR, ALLOWED_MIMETYPES, MAX_UPLOAD_MB, CLOUDINARY_ENABLED };
