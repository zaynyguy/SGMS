const db = require("../db");
const bcrypt = require("bcrypt");
const { uploadFile, deleteFile } = require("../services/uploadService");
const { buildProfilePictureUrl } = require("../utils/fileHelper");
const path = require("path");
const fs = require("fs");
const { UPLOAD_DIR } = require("../middleware/uploadMiddleware");

// ... (getAllUsers, createUser, updateUser, deleteUser, uploadProfilePictureForUser remain unchanged from previous step) ...

exports.getAllUsers = async (req, res) => {
try {
const { rows } = await db.query(`
SELECT u.id,
u.username,
u.name,
u."roleId",
r.name AS role,
u.language,
u."profilePicture",
COALESCE(u.token_version, 0) AS token_version,
u."createdAt",
u."updatedAt"
FROM "Users" u
LEFT JOIN "Roles" r ON u."roleId" = r.id
ORDER BY u."createdAt" DESC
`);

const users = rows.map(user => ({
...user,
profilePicture: buildProfilePictureUrl(user.profilePicture, 'user')
}));

res.json(users);
} catch (err) {
console.error('usersController.getAllUsers error', err);
res.status(500).json({ message: 'Internal server error.' });
}
};

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
RETURNING id, username, name, "roleId", language, "profilePicture", COALESCE(token_version,0) AS token_version, "createdAt", "updatedAt"`,
[username.trim(), name?.trim() || null, hash, roleId || null, language || 'en', profilePicture || null]
);

const user = {
...rows[0],
profilePicture: buildProfilePictureUrl(rows[0].profilePicture, 'user')
};

res.status(201).json(user);
} catch (err) {
console.error('usersController.createUser error', err);
res.status(500).json({ message: 'Internal server error.' });
}
};

exports.updateUser = async (req, res) => {
const { id } = req.params;
const { username, name, password, roleId, language, profilePicture } = req.body;

try {
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
RETURNING id, username, name, "roleId", language, "profilePicture", COALESCE(token_version,0) AS token_version, "createdAt", "updatedAt"`,
[
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

const user = {
...rows[0],
profilePicture: buildProfilePictureUrl(rows[0].profilePicture, 'user')
};

res.json(user);
} catch (err) {
if (err && err.code === '23505' && /username/i.test(err.detail || err.message || '')) {
return res.status(400).json({ message: 'Username already in use.' });
}
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
RETURNING id, username, name, "roleId", language, "profilePicture", COALESCE(token_version,0) AS token_version, "createdAt", "updatedAt"`,
[uploaded.url, userId]
);

try {
if (oldProfilePicture) await deleteFile(oldProfilePicture);
} catch (delErr) {
console.error('Warning: failed to delete old profile picture:', delErr);
}

const updatedUser = updateRes.rows?.[0] ? {
...updateRes.rows[0],
profilePicture: buildProfilePictureUrl(updateRes.rows[0].profilePicture, 'user')
} : null;

return res.json({
message: 'Profile picture updated successfully.',
profilePicture: updatedUser ? updatedUser.profilePicture : null,
provider: uploaded.provider || null,
user: updatedUser,
});
} catch (err) {
console.error('uploadProfilePictureForUser error:', err);
return res.status(500).json({ message: 'Failed to upload profile picture.' });
}
};

// --- UPDATED FUNCTION ---
exports.getProfilePicture = async (req, res) => {
try {
const { filename } = req.params;
if (!filename || filename.includes("..") || filename.includes("/")) {
return res.status(400).json({ error: "Invalid filename." });
}

// UPLOAD_DIR is an absolute path from uploadMiddleware.js
const fullPath = path.join(UPLOAD_DIR, filename);

// Use sync exists check, just like in attachmentsController
if (fs.existsSync(fullPath)) {
res.sendFile(fullPath);
} else {
console.warn(`Profile picture not found: ${fullPath}`);
res.status(404).json({ error: "File not found." });
}
} catch (err) {
console.error("Error serving profile picture:", err);
res.status(500).json({ error: "Server error." });
}
};

