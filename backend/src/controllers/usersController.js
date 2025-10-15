const db = require('../db');
const bcrypt = require('bcrypt');
const { uploadFile, deleteFile } = require('../services/uploadService');

// GET all users
exports.getAllUsers = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT u.id,
             u.username,
             u.name,
             u."roleId",
             r.name AS role,
             u.language,
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

// CREATE user
exports.createUser = async (req, res) => {
  try {
    const { username, name, password, roleId, language, profilePicture } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'username and password required' });
    }

    const hash = await bcrypt.hash(password, 10);

    const { rows } = await db.query(
      `INSERT INTO "Users"(username, name, password, "roleId", language, "profilePicture", token_version, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,0,NOW(),NOW())
       RETURNING id, username, name, "roleId", language, COALESCE("profilePicture",'') AS "profilePicture", COALESCE(token_version,0) AS token_version, "createdAt", "updatedAt"`,
      [username.trim(), name?.trim() || null, hash, roleId || null, language || 'en', profilePicture || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('usersController.createUser error', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// UPDATE user
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  // include username here
  const { username, name, password, roleId, language, profilePicture } = req.body;

  try {
    // if username was provided explicitly, normalize it
    let usernameValue = undefined;
    if (typeof username !== 'undefined') {
      if (username === null || String(username).trim() === '') {
        return res.status(400).json({ message: 'username cannot be empty' });
      }
      usernameValue = String(username).trim();
    }

    const bumpTokenVersion = Boolean(password);
    const hash = password ? await bcrypt.hash(password, 10) : null;

    const { rows } = await db.query(
      `UPDATE "Users" SET
         username = COALESCE($1, username),
         name = COALESCE($2, name),
         password = COALESCE($3, password),
         "roleId" = COALESCE($4, "roleId"),
         language = COALESCE($5, language),
         "profilePicture" = COALESCE($6, "profilePicture"),
         token_version = CASE WHEN $7 THEN COALESCE(token_version,0) + 1 ELSE token_version END,
         "updatedAt" = NOW()
       WHERE id = $8
       RETURNING id, username, name, "roleId", language, COALESCE("profilePicture",'') AS "profilePicture", COALESCE(token_version,0) AS token_version, "createdAt", "updatedAt"`,
      [
        // param positions:
        // $1 -> usernameValue (may be undefined -> COALESCE will keep existing)
        usernameValue,
        name?.trim() || null,
        hash,
        roleId || null,
        language || null,
        typeof profilePicture !== 'undefined' ? profilePicture : null,
        bumpTokenVersion,
        id,
      ]
    );

    if (!rows.length) return res.status(404).json({ message: 'User not found.' });
    res.json(rows[0]);
  } catch (err) {
    // handle unique constraint violation (username collision)
    if (err && err.code === '23505' && /username/i.test(err.detail || err.message || '')) {
      return res.status(400).json({ message: 'Username already in use.' });
    }
    console.error('usersController.updateUser error', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};


// DELETE user
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

// UPLOAD profile picture
exports.uploadProfilePictureForUser = async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) return res.status(400).json({ message: 'Invalid user id' });

  if (!req.file) return res.status(400).json({ message: 'No file uploaded. Field name must be "file".' });

  try {
    const current = await db.query('SELECT "profilePicture" FROM "Users" WHERE id = $1 LIMIT 1', [userId]);
    const oldProfilePicture = current.rows?.[0]?.profilePicture || null;

    const uploaded = await uploadFile(req.file);

    const updateRes = await db.query(
      `UPDATE "Users" SET "profilePicture" = $1, "updatedAt" = NOW()
       WHERE id = $2
       RETURNING id, username, name, "roleId", language, COALESCE("profilePicture",'') AS "profilePicture", COALESCE(token_version,0) AS token_version, "createdAt", "updatedAt"`,
      [uploaded.url, userId]
    );

    try {
      if (oldProfilePicture) await deleteFile(oldProfilePicture);
    } catch (delErr) {
      console.error('Warning: failed to delete old profile picture:', delErr);
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
