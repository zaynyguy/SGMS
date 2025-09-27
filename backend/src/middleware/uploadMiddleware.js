// src/middleware/uploadMiddleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db"); // used to read SystemSettings
require("dotenv").config();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";

const DEFAULT_ALLOWED = [
  "image/png", "image/jpeg", "image/jpg", "image/gif",
  "application/pdf", "text/plain", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed"
];

const envAllowed = process.env.ALLOWED_MIMETYPES
  ? process.env.ALLOWED_MIMETYPES.split(",").map(s => s.trim())
  : [];
const ALLOWED_MIMETYPES = envAllowed.length ? envAllowed : DEFAULT_ALLOWED;

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
    if (CLOUDINARY_ENABLED) cb(null, "/tmp");
    else cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const safeBase = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = path.extname(safeBase).toLowerCase();
    const name = path.basename(safeBase, ext);
    cb(null, `${Date.now()}_${name}${ext}`);
  }
});

/**
 * Read the DB settings used for uploads.
 * Looks for keys: max_attachment_size_mb, allowed_attachment_types, allowed_mimetypes
 * Falls back to env defaults above.
 */
async function readSystemUploadSettings() {
  const out = {
    maxMb: parseInt(process.env.MAX_UPLOAD_MB || "10", 10),
    allowed: ALLOWED_MIMETYPES.slice(),
  };

  try {
    const q = await db.query(
      `SELECT key, value FROM "SystemSettings" WHERE key IN ($1,$2,$3)`,
      ['max_attachment_size_mb', 'allowed_attachment_types', 'allowed_mimetypes']
    );

    for (const row of q.rows) {
      const key = row.key;
      const raw = row.value;

      if (key === 'max_attachment_size_mb') {
        if (raw === null || raw === undefined) continue;
        if (typeof raw === 'number') out.maxMb = Number(raw);
        else if (typeof raw === 'string') {
          const parsed = parseInt(raw, 10);
          if (!Number.isNaN(parsed)) out.maxMb = parsed;
          else {
            try {
              const p2 = JSON.parse(raw);
              if (typeof p2 === 'number') out.maxMb = p2;
            } catch (e) {}
          }
        } else if (typeof raw === 'object') {
          if (raw.max_attachment_size_mb && typeof raw.max_attachment_size_mb === 'number') out.maxMb = raw.max_attachment_size_mb;
          else if (raw.value && typeof raw.value === 'number') out.maxMb = raw.value;
        }
      } else if (key === 'allowed_attachment_types' || key === 'allowed_mimetypes') {
        if (!raw) continue;
        if (Array.isArray(raw)) {
          out.allowed = raw.slice();
        } else if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) out.allowed = parsed;
            else out.allowed = raw.split(",").map(s => s.trim());
          } catch (e) {
            out.allowed = raw.split(",").map(s => s.trim());
          }
        } else if (typeof raw === 'object') {
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

/**
 * Build a fileFilter closure from a list of allowed mimetypes.
 */
function buildFileFilter(allowed) {
  const norm = allowed.map(s => String(s).trim());
  return function (req, file, cb) {
    try {
      if (norm.includes(file.mimetype) || norm.includes('*/*')) return cb(null, true);

      const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      if ((file.mimetype === "application/zip" || file.mimetype === "application/x-zip-compressed") &&
          (norm.includes(docxMime) || norm.includes(xlsxMime) || norm.includes("application/pdf"))) {
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

/**
 * Create a multer instance from runtime settings
 */
function createMulterFromSettings(settings) {
  const maxBytes = settings.maxMb * 1024 * 1024;
  return multer({
    storage,
    fileFilter: buildFileFilter(settings.allowed),
    limits: { fileSize: maxBytes },
  });
}

/**
 * Wrapper to preserve multer-style API but build the actual multer instance per-request.
 * Supported methods: single, array, fields, any, none
 *
 * Usage (unchanged): upload.single('attachment')
 */
const upload = {
  single: function (fieldName) {
    return async function (req, res, next) {
      try {
        const settings = await readSystemUploadSettings();
        const instance = createMulterFromSettings(settings);
        const handler = instance.single(fieldName);
        handler(req, res, function (err) {
          if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
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
            if (err.code === 'LIMIT_FILE_SIZE') {
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
            if (err.code === 'LIMIT_FILE_SIZE') {
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
            if (err.code === 'LIMIT_FILE_SIZE') {
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
  }
};

module.exports = { upload, UPLOAD_DIR, ALLOWED_MIMETYPES, CLOUDINARY_ENABLED };
