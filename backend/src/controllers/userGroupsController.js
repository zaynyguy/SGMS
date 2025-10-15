// src/controllers/userGroupsController.js
const db = require("../db");
const { logAudit } = require("../helpers/audit");
const notificationService = require("../services/notificationService");

// ADD user to group
exports.addUserToGroup = async (req, res) => {
  const { userId, groupId } = req.body;
  if (!userId || !groupId) return res.status(400).json({ message: "userId and groupId required." });

  try {
    const inserted = await db.tx(async (client) => {
      const r = await client.query(
        `INSERT INTO "UserGroups" ("userId", "groupId") 
         VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *`,
        [userId, groupId]
      );

      // If inserted, audit inside tx
      if (r.rows && r.rows[0]) {
        try {
          await logAudit({
            userId: req.user.id,
            action: "TEAM_MEMBER_ADDED",
            entity: "UserGroup",
            entityId: null,
            details: { addedUserId: userId, groupId },
            client,
            req,
          });
        } catch (e) {
          console.error("TEAM_MEMBER_ADDED audit failed (in-tx):", e);
        }
      }

      return r.rows[0] || null;
    });

    // Post-commit: notify the user if they were added
    if (inserted) {
      try {
        await notificationService({
          userId,
          type: "group_added",
          message: `You were added to a group (id: ${groupId}).`,
          meta: { groupId },
        });
      } catch (nerr) {
        console.error("addUserToGroup: notification failed", nerr);
      }
      return res.status(201).json({ message: "User added to group." });
    } else {
      // already existed
      return res.status(200).json({ message: "User already in group." });
    }
  } catch (err) {
    console.error("Error adding user to group:", err);
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
};

// REMOVE user from group
exports.removeUserFromGroup = async (req, res) => {
  const { userId, groupId } = req.body;
  if (!userId || !groupId) return res.status(400).json({ message: "userId and groupId required." });

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const q = await client.query(
      `SELECT * FROM "UserGroups" WHERE "userId" = $1 AND "groupId" = $2 FOR UPDATE`,
      [userId, groupId]
    );
    if (!q.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not in group." });
    }
    const row = q.rows[0];

    await client.query('DELETE FROM "UserGroups" WHERE "userId" = $1 AND "groupId" = $2', [userId, groupId]);

    try {
      await logAudit({
        userId: req.user.id,
        action: "TEAM_MEMBER_REMOVED",
        entity: "UserGroup",
        entityId: null,
        before: row,
        details: { removedUserId: userId, groupId },
        client,
        req,
      });
    } catch (e) {
      console.error("TEAM_MEMBER_REMOVED audit failed (in-tx):", e);
    }

    await client.query("COMMIT");

    // Post-commit: notify removed user
    try {
      await notificationService({
        userId,
        type: "group_removed",
        message: `You were removed from a group (id: ${groupId}).`,
        meta: { groupId },
      });
    } catch (nerr) {
      console.error("removeUserFromGroup: notification failed", nerr);
    }

    res.json({ message: "User removed from group." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error removing user from group:", err);
    res.status(500).json({ message: "Internal server error.", error: err.message });
  } finally {
    client.release();
  }
};

// LIST users in a group
exports.getGroupUsers = async (req, res) => {
  const { groupId } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.name, r.name as "roleName"
       FROM "UserGroups" ug
       JOIN "Users" u ON ug."userId" = u.id
       LEFT JOIN "Roles" r ON u."roleId" = r.id
       WHERE ug."groupId" = $1
       ORDER BY u.username ASC`,
      [groupId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching group users:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

// LIST groups for a user
exports.getUserGroups = async (req, res) => {
  const { userId } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT g.id, g.name, g.description
       FROM "UserGroups" ug
       JOIN "Groups" g ON ug."groupId" = g.id
       WHERE ug."userId" = $1
       ORDER BY g."createdAt" DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching user groups:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};
