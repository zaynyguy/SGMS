// src/middleware/uploadMiddleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");
const db = require("../db");
require("dotenv").config();

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");
const TMP_DIR = path.resolve(process.env.TMP_DIR || os.tmpdir());

const DEFAULT_ALLOWED = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
];

const envAllowed = process.env.ALLOWED_MIMETYPES
  ? process.env.ALLOWED_MIMETYPES.split(",").map((s) => s.trim())
  : [];

const ALLOWED_MIMETYPES = envAllowed.length ? envAllowed : DEFAULT_ALLOWED;

const CLOUDINARY_ENABLED =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

try {
  if (CLOUDINARY_ENABLED) {
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  } else {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch (err) {
  console.error("Failed to ensure upload directories exist:", { UPLOAD_DIR, TMP_DIR, err });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = CLOUDINARY_ENABLED ? TMP_DIR : UPLOAD_DIR;
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // ✅ PRESERVE ORIGINAL NAME — only sanitize for filesystem safety
    const ext = path.extname(file.originalname).toLowerCase();
    const basename = path.basename(file.originalname, ext);

    // Keep Unicode in basename; only replace dangerous chars
    // \ / : * ? " < > | are unsafe on Windows → replace with _
    const safeBasename = basename.replace(/[\\\/:*?"<>|]/g, "_");
    const timestamp = Date.now();
    const uniqueName = `${timestamp}_${safeBasename}${ext}`;
    
    cb(null, uniqueName);
  },
});

async function readSystemUploadSettings() {
  const out = {
    maxMb: parseInt(process.env.MAX_UPLOAD_MB || "10", 10),
    allowed: ALLOWED_MIMETYPES.slice(),
  };
  try {
    const q = await db.query(
      `SELECT key, value FROM "SystemSettings" WHERE key IN ($1,$2,$3)`,
      ["max_attachment_size_mb", "allowed_attachment_types", "allowed_mimetypes"]
    );
    for (const row of q.rows) {
      const key = row.key;
      const raw = row.value;
      if (key === "max_attachment_size_mb") {
        if (raw === null || raw === undefined) continue;
        if (typeof raw === "number") out.maxMb = Number(raw);
        else if (typeof raw === "string") {
          const parsed = parseInt(raw, 10);
          if (!Number.isNaN(parsed)) out.maxMb = parsed;
          else {
            try {
              const p2 = JSON.parse(raw);
              if (typeof p2 === "number") out.maxMb = p2;
            } catch {}
          }
        } else if (typeof raw === "object") {
          if (raw.max_attachment_size_mb && typeof raw.max_attachment_size_mb === "number") out.maxMb = raw.max_attachment_size_mb;
          else if (raw.value && typeof raw.value === "number") out.maxMb = raw.value;
        }
      } else if (key === "allowed_attachment_types" || key === "allowed_mimetypes") {
        if (!raw) continue;
        if (Array.isArray(raw)) {
          out.allowed = raw.slice();
        } else if (typeof raw === "string") {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) out.allowed = parsed;
            else out.allowed = raw.split(",").map((s) => s.trim());
          } catch {
            out.allowed = raw.split(",").map((s) => s.trim());
          }
        } else if (typeof raw === "object") {
          if (Array.isArray(raw.allowed)) out.allowed = raw.allowed.slice();
          else if (Array.isArray(raw.value)) out.allowed = raw.value.slice();
        }
      }
    }
  } catch (err) {
    console.error("readSystemUploadSettings failed, using env/defaults:", err);
  }
  out.maxMb = Number.isFinite(Number(out.maxMb)) ? Math.max(1, Math.round(Number(out.maxMb))) : 10;
  if (!Array.isArray(out.allowed) || out.allowed.length === 0) out.allowed = ALLOWED_MIMETYPES.slice();
  return out;
}

function buildFileFilter(allowed) {
  const norm = allowed.map((s) => String(s).trim());
  return function (req, file, cb) {
    try {
      if (norm.includes(file.mimetype) || norm.includes("*/*")) return cb(null, true);
      const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      if (
        (file.mimetype === "application/zip" || file.mimetype === "application/x-zip-compressed") &&
        (norm.includes(docxMime) || norm.includes(xlsxMime) || norm.includes("application/pdf"))
      ) {
        return cb(null, true);
      }
      return cb(new Error("Unsupported file type"), false);
    } catch (err) {
      console.error("fileFilter error:", err);
      if (ALLOWED_MIMETYPES.includes(file.mimetype)) return cb(null, true);
      return cb(new Error("Unsupported file type"), false);
    }
  };
}

function createMulterFromSettings(settings) {
  const maxBytes = settings.maxMb * 1024 * 1024;
  return multer({
    storage,
    fileFilter: buildFileFilter(settings.allowed),
    limits: { fileSize: maxBytes },
  });
}

const upload = {
  single: function (fieldName) {
    return async function (req, res, next) {
      try {
        const settings = await readSystemUploadSettings();
        const instance = createMulterFromSettings(settings);
        const handler = instance.single(fieldName);
        handler(req, res, function (err) {
          if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
              err.status = 413;
              err.message = `File too large. Max size is ${settings.maxMb} MB.`;
            }
            return next(err);
          }
          return next();
        });
      } catch (err) {
        return next(err);
      }
    };
  },
  array: function (fieldName, maxCount) {
    return async function (req, res, next) {
      try {
        const settings = await readSystemUploadSettings();
        const instance = createMulterFromSettings(settings);
        const handler = instance.array(fieldName, maxCount);
        handler(req, res, function (err) {
          if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
              err.status = 413;
              err.message = `File too large. Max size is ${settings.maxMb} MB.`;
            }
            return next(err);
          }
          return next();
        });
      } catch (err) {
        return next(err);
      }
    };
  },
  fields: function (fields) {
    return async function (req, res, next) {
      try {
        const settings = await readSystemUploadSettings();
        const instance = createMulterFromSettings(settings);
        const handler = instance.fields(fields);
        handler(req, res, function (err) {
          if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
              err.status = 413;
              err.message = `File too large. Max size is ${settings.maxMb} MB.`;
            }
            return next(err);
          }
          return next();
        });
      } catch (err) {
        return next(err);
      }
    };
  },
  any: function () {
    return async function (req, res, next) {
      try {
        const settings = await readSystemUploadSettings();
        const instance = createMulterFromSettings(settings);
        const handler = instance.any();
        handler(req, res, function (err) {
          if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
              err.status = 413;
              err.message = `File too large. Max size is ${settings.maxMb} MB.`;
            }
            return next(err);
          }
          return next();
        });
      } catch (err) {
        return next(err);
      }
    };
  },
  none: function () {
    return async function (req, res, next) {
      try {
        const settings = await readSystemUploadSettings();
        const instance = createMulterFromSettings(settings);
        const handler = instance.none();
        handler(req, res, function (err) {
          if (err) return next(err);
          return next();
        });
      } catch (err) {
        return next(err);
      }
    };
  },
};

module.exports = { upload, UPLOAD_DIR, TMP_DIR, ALLOWED_MIMETYPES, CLOUDINARY_ENABLED };