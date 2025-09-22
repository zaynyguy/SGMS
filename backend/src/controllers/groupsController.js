// src/controllers/groupsController.js
const db = require("../db");
const { logAudit } = require("../helpers/audit");
const uploadService = require("../services/uploadService");

exports.getAllGroups = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT g.*,
             COALESCE(g."profilePicture", '') AS "profilePicture",
             COUNT(ug."userId")::int AS "memberCount"
      FROM "Groups" g
      LEFT JOIN "UserGroups" ug ON g.id = ug."groupId"
      GROUP BY g.id
      ORDER BY g."createdAt" DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('groupsController.getAllGroups error', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.getGroupDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const g = await db.query(
      `SELECT id, name, description, COALESCE("profilePicture",'') AS "profilePicture", "createdAt", "updatedAt"
       FROM "Groups" WHERE id = $1`,
      [id]
    );
    if (!g.rows.length) return res.status(404).json({ message: 'Group not found.' });

    const m = await db.query(
      `SELECT u.id, u.username, u.name, COALESCE(u."profilePicture",'') AS "profilePicture", r.name AS role
       FROM "UserGroups" ug
       JOIN "Users" u ON ug."userId" = u.id
       LEFT JOIN "Roles" r ON u."roleId" = r.id
       WHERE ug."groupId" = $1
       ORDER BY u.username ASC`,
      [id]
    );

    res.json({
      ...g.rows[0],
      members: m.rows,
      memberCount: m.rows.length,
    });
  } catch (err) {
    console.error('groupsController.getGroupDetails error', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

/**
 * Helper: get profilePicture value to store in DB.
 * - If multer uploaded file: req.file present -> call uploadService.uploadFile(req.file) -> returns { url, ... }
 * - Otherwise fallback to req.body.profilePicture (string url) if present
 */
async function resolveUploadedProfilePicture(req) {
  if (req.file) {
    const uploaded = await uploadService.uploadFile(req.file);
    return uploaded.url || null;
  }
  // client might send a profilePicture string (small URL) in JSON (keeps backwards compatibility)
  if (req.body && typeof req.body.profilePicture === 'string' && req.body.profilePicture.trim()) {
    return req.body.profilePicture.trim();
  }
  return null;
}

exports.createGroup = async (req, res) => {
  const { name, description } = req.body;
  let profilePictureToSave = null;

  try {
    profilePictureToSave = await resolveUploadedProfilePicture(req);
  } catch (err) {
    console.error('groupsController.createGroup upload error', err);
    return res.status(400).json({ message: err.message || 'File upload failed' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO "Groups"(name, description, "profilePicture", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,NOW(),NOW()) RETURNING *`,
      [name?.trim(), description?.trim() || null, profilePictureToSave || null]
    );
    const newGroup = r.rows[0];

    try {
      await logAudit({
        userId: req.user.id,
        action: 'GROUP_CREATED',
        entity: 'Group',
        entityId: newGroup.id,
        details: { name: newGroup.name },
        client,
        req,
      });
    } catch (auditErr) {
      console.error('groupsController.createGroup audit error', auditErr);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Group created successfully.', group: newGroup });
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error('groupsController.createGroup error', err);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};

exports.updateGroup = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // lock row for update
    const check = await client.query('SELECT * FROM "Groups" WHERE id=$1 FOR UPDATE', [id]);
    if (!check.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Group not found.' });
    }
    const before = check.rows[0];

    // Resolve uploaded file -> may return null
    let newProfilePicture = null;
    try {
      newProfilePicture = await resolveUploadedProfilePicture(req);
    } catch (err) {
      console.error('groupsController.updateGroup upload error', err);
      await client.query('ROLLBACK').catch(()=>{});
      return res.status(400).json({ message: err.message || 'File upload failed' });
    }

    // If newProfilePicture exists and before.profilePicture exists, attempt to delete old file
    const oldProfilePicture = before.profilePicture || null;

    const r = await client.query(
      `UPDATE "Groups" SET
         name = $1,
         description = $2,
         "profilePicture" = COALESCE($3, "profilePicture"),
         "updatedAt" = NOW()
       WHERE id = $4
       RETURNING *`,
      [name?.trim(), description?.trim() || null, newProfilePicture ?? null, id]
    );

    const updatedGroup = r.rows[0];

    try {
      await logAudit({
        userId: req.user.id,
        action: 'GROUP_UPDATED',
        entity: 'Group',
        entityId: id,
        before,
        after: updatedGroup,
        client,
        req,
      });
    } catch (auditErr) {
      console.error('groupsController.updateGroup audit error', auditErr);
    }

    await client.query('COMMIT');

    // delete old file AFTER commit (best-effort; non-blocking)
    if (newProfilePicture && oldProfilePicture && oldProfilePicture !== newProfilePicture) {
      (async () => {
        try {
          await uploadService.deleteFile(oldProfilePicture);
        } catch (delErr) {
          console.error('Failed to delete old group profile picture:', delErr);
        }
      })();
    }

    res.json({ message: 'Group updated successfully.', group: updatedGroup });
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error('groupsController.updateGroup error', err);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};

exports.deleteGroup = async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const check = await client.query('SELECT * FROM "Groups" WHERE id=$1 FOR UPDATE', [id]);
    if (!check.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Group not found.' });
    }
    const toDelete = check.rows[0];

    await client.query('DELETE FROM "Groups" WHERE id=$1', [id]);

    try {
      await logAudit({
        userId: req.user.id,
        action: 'GROUP_DELETED',
        entity: 'Group',
        entityId: id,
        before: toDelete,
        client,
        req,
      });
    } catch (auditErr) {
      console.error('groupsController.deleteGroup audit error', auditErr);
    }

    await client.query('COMMIT');

    // best-effort delete of group file (non-blocking)
    if (toDelete.profilePicture) {
      (async () => {
        try {
          await uploadService.deleteFile(toDelete.profilePicture);
        } catch (delErr) {
          console.error('Failed to delete group profile picture on group delete:', delErr);
        }
      })();
    }

    res.json({ message: 'Group deleted successfully.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error('groupsController.deleteGroup error', err);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};
