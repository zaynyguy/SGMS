// src/utils/systemSettings.js
const db = require('../db');

const DEFAULTS = {
  max_attachment_size_mb: 10,
  allowed_attachment_types: [
    'image/png','image/jpeg','image/jpg','image/gif',
    'application/pdf','text/plain','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
};

// cache TTL (ms) — change as needed
const TTL_MS = parseInt(process.env.SYSTEM_SETTINGS_TTL_MS || '30000', 10);

let cache = {
  ts: 0,
  data: null
};

async function loadFromDb() {
  // fetch keys we care about in one query
  const keys = [
    'max_attachment_size_mb',
    'allowed_attachment_types'
  ];
  const q = `SELECT key, value FROM "SystemSettings" WHERE key = ANY($1)`;
  const { rows } = await db.query(q, [keys]);
  const map = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }

  const maxSizeMb = Number(map.max_attachment_size_mb ?? DEFAULTS.max_attachment_size_mb);
  const allowed = Array.isArray(map.allowed_attachment_types)
    ? map.allowed_attachment_types
    : (typeof map.allowed_attachment_types === 'string' ? JSON.parse(map.allowed_attachment_types) : DEFAULTS.allowed_attachment_types);

  cache = {
    ts: Date.now(),
    data: { maxSizeMb, allowed }
  };
  return cache.data;
}

/**
 * Returns the attachment related settings, using cache with TTL.
 * @returns {Promise<{maxSizeMb: number, allowed: string[]}>}
 */
async function getAttachmentSettings() {
  if (cache.data && (Date.now() - cache.ts) < TTL_MS) {
    return cache.data;
  }
  try {
    return await loadFromDb();
  } catch (err) {
    // DB failure -> fallback to defaults (do not throw; allow uploads to continue)
    console.error('systemSettings: failed to load from DB, falling back to defaults', err);
    cache = { ts: Date.now(), data: { maxSizeMb: DEFAULTS.max_attachment_size_mb, allowed: DEFAULTS.allowed_attachment_types } };
    return cache.data;
  }
}

/**
 * Force refresh (useful if you change settings in UI and want immediate effect)
 */
async function refresh() {
  return await loadFromDb();
}

module.exports = { getAttachmentSettings, refresh };
