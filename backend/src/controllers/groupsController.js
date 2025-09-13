// src/controllers/groupsController.js
const db = require("../db");
const { logAudit } = require("../helpers/audit");

// GET all groups with member count
exports.getAllGroups = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT g.*, 
             COUNT(ug."userId")::int AS "memberCount"
      FROM "Groups" g
      LEFT JOIN "UserGroups" ug ON g.id = ug."groupId"
      GROUP BY g.id
      ORDER BY g."createdAt" DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching groups:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

// GET single group details + members
exports.getGroupDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const group = await db.query(
      `SELECT id, name, description, "createdAt", "updatedAt"
       FROM "Groups" WHERE id=$1`,
      [id]
    );

    if (!group.rows.length) {
      return res.status(404).json({ message: "Group not found." });
    }

    const members = await db.query(
      `SELECT u.id, u.username, u.name, r.name AS role
       FROM "UserGroups" ug
       JOIN "Users" u ON ug."userId" = u.id
       LEFT JOIN "Roles" r ON u."roleId" = r.id
       WHERE ug."groupId" = $1
       ORDER BY u.username ASC`,
      [id]
    );

    res.json({
      ...group.rows[0],
      members: members.rows,
      memberCount: members.rows.length,
    });
  } catch (err) {
    console.error("Error fetching group details:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

// CREATE group
exports.createGroup = async (req, res) => {
  const { name, description } = req.body;
  try {
    const group = await db.tx(async (client) => {
      const r = await client.query(
        `INSERT INTO "Groups"(name, description, "createdAt", "updatedAt") 
         VALUES ($1,$2, NOW(), NOW()) RETURNING *`,
        [name.trim(), description?.trim() || null]
      );
      const newGroup = r.rows[0];

      try {
        await logAudit({
          userId: req.user.id,
          action: "GROUP_CREATED",
          entity: "Group",
          entityId: newGroup.id,
          details: { name: newGroup.name },
          client,
          req,
        });
      } catch (e) {
        console.error("GROUP_CREATED audit failed (in-tx):", e);
      }

      return newGroup;
    });

    res.status(201).json({ message: "Group created successfully.", group });
  } catch (err) {
    console.error("Error creating group:", err);
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
};

// UPDATE group
exports.updateGroup = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  try {
    const updated = await db.tx(async (client) => {
      const check = await client.query('SELECT * FROM "Groups" WHERE id=$1 FOR UPDATE', [id]);
      if (!check.rows.length) {
        const e = new Error("Group not found.");
        e.status = 404;
        throw e;
      }
      const before = check.rows[0];

      const r = await client.query(
        `UPDATE "Groups" 
         SET name=$1, description=$2, "updatedAt"=NOW() 
         WHERE id=$3 RETURNING *`,
        [name.trim(), description?.trim() || null, id]
      );

      const updatedGroup = r.rows[0];

      try {
        await logAudit({
          userId: req.user.id,
          action: "GROUP_UPDATED",
          entity: "Group",
          entityId: id,
          before,
          after: updatedGroup,
          client,
          req,
        });
      } catch (e) {
        console.error("GROUP_UPDATED audit failed (in-tx):", e);
      }

      return updatedGroup;
    });

    res.json({ message: "Group updated successfully.", group: updated });
  } catch (err) {
    console.error("Error updating group:", err);
    if (err && err.status === 404) return res.status(404).json({ message: err.message });
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
};

// DELETE group
exports.deleteGroup = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await db.tx(async (client) => {
      const check = await client.query('SELECT * FROM "Groups" WHERE id=$1 FOR UPDATE', [id]);
      if (!check.rows.length) {
        const e = new Error("Group not found.");
        e.status = 404;
        throw e;
      }
      const toDelete = check.rows[0];

      await client.query('DELETE FROM "Groups" WHERE id=$1', [id]);

      try {
        await logAudit({
          userId: req.user.id,
          action: "GROUP_DELETED",
          entity: "Group",
          entityId: id,
          before: toDelete,
          client,
          req,
        });
      } catch (e) {
        console.error("GROUP_DELETED audit failed (in-tx):", e);
      }

      return toDelete;
    });

    res.json({ message: "Group deleted successfully." });
  } catch (err) {
    console.error("Error deleting group:", err);
    if (err && err.status === 404) return res.status(404).json({ message: err.message });
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
};
