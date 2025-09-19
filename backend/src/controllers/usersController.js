// src/controllers/usersController.js
const db = require('../db');
const bcrypt = require('bcrypt');
const { uploadFile, deleteFile } = require('../services/uploadService'); // <- new
// Note: uploadFile/deleteFile already provided by your uploadService

// Existing getAllUsers / createUser / updateUser / deleteUser remain unchanged...
exports.getAllUsers = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT u.id,
             u.username,
             u.name,
             u."roleId",
             r.name AS role,
             u.language,
             u."darkMode",
             COALESCE(u."profilePicture",'') AS "profilePicture",
             COALESCE(u.token_version, 0) AS token_version,
             u."createdAt",
             u."updatedAt"
      FROM "Users" u
      LEFT JOIN "Roles" r ON u."roleId" = r.id
      ORDER BY u."createdAt" DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('usersController.getAllUsers error', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { username, name, password, roleId, language, darkMode, profilePicture } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'username and password required' });
    }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO "Users"(username, name, password, "roleId", language, "darkMode", "profilePicture", token_version, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,NOW(),NOW())
       RETURNING id, username, name, "roleId", language, "darkMode", COALESCE("profilePicture",'') AS "profilePicture", COALESCE(token_version,0) AS token_version, "createdAt", "updatedAt"`,
      [username.trim(), name?.trim() || null, hash, roleId || null, language || 'en', !!darkMode, profilePicture || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('usersController.createUser error', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, password, roleId, language, darkMode, profilePicture } = req.body;
  try {
    let hash = null;
    const bumpTokenVersion = Boolean(password);
    if (password) hash = await bcrypt.hash(password, 10);

    const { rows } = await db.query(
      `UPDATE "Users" SET
         name = COALESCE($1, name),
         password = COALESCE($2, password),
         "roleId" = COALESCE($3, "roleId"),
         language = COALESCE($4, language),
         "darkMode" = COALESCE($5, "darkMode"),
         "profilePicture" = COALESCE($6, "profilePicture"),
         token_version = CASE WHEN $7 THEN COALESCE(token_version,0) + 1 ELSE token_version END,
         "updatedAt" = NOW()
       WHERE id = $8
       RETURNING id, username, name, "roleId", language, "darkMode", COALESCE("profilePicture",'') AS "profilePicture", COALESCE(token_version,0) AS token_version, "createdAt", "updatedAt"`,
      [
        name?.trim() || null,
        hash,
        roleId || null,
        language || null,
        typeof darkMode === 'boolean' ? darkMode : null,
        profilePicture ?? null,
        bumpTokenVersion,
        id,
      ]
    );

    if (!rows.length) return res.status(404).json({ message: 'User not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('usersController.updateUser error', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM "Users" WHERE id=$1', [id]);
    res.json({ message: 'User deleted.' });
  } catch (err) {
    console.error('usersController.deleteUser error', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

/**
 * Admin-only: upload profile picture for a specific user.
 * Route: PUT /api/users/:id/profile-picture
 * Expects multipart/form-data with field "file" (handled by multer middleware).
 * Returns { message, profilePicture, user } on success.
 */
exports.uploadProfilePictureForUser = async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) return res.status(400).json({ message: 'Invalid user id' });

  // multer will place file at req.file
  if (!req.file) return res.status(400).json({ message: 'No file uploaded. Field name must be "file".' });

  try {
    // 1) fetch current profilePicture for potential deletion
    const current = await db.query('SELECT "profilePicture" FROM "Users" WHERE id = $1 LIMIT 1', [userId]);
    const oldProfilePicture = current.rows?.[0]?.profilePicture || null;

    // 2) upload the file (local or cloudinary) using existing service
    const uploaded = await uploadFile(req.file); // returns { url, provider, fileName, fileType, public_id? }

    // 3) persist new url in DB
    const updateRes = await db.query(
      `UPDATE "Users" SET "profilePicture" = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING id, username, name, "roleId", language, "darkMode", COALESCE("profilePicture",'') AS "profilePicture", COALESCE(token_version,0) AS token_version, "createdAt", "updatedAt"`,
      [uploaded.url, userId]
    );

    // 4) attempt to delete old asset (best-effort)
    try {
      if (oldProfilePicture) {
        // If you stored additional metadata (public_id) somewhere, pass it as extra. We don't have it here so pass only the path.
        await deleteFile(oldProfilePicture);
      }
    } catch (delErr) {
      console.error('Warning: failed to delete old profile picture:', delErr);
      // Do not fail the request for delete errors.
    }

    const updatedUser = updateRes.rows?.[0] || null;

    return res.json({
      message: 'Profile picture updated successfully.',
      profilePicture: uploaded.url,
      provider: uploaded.provider || null,
      user: updatedUser,
    });
  } catch (err) {
    console.error('uploadProfilePictureForUser error:', err);
    return res.status(500).json({ message: 'Failed to upload profile picture.' });
  }
};
