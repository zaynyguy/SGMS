// src/controllers/groupsController.js

const db = require("../db");

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
    const r = await db.query(
      `INSERT INTO "Groups"(name, description) 
       VALUES ($1,$2) RETURNING *`,
      [name.trim(), description?.trim() || null]
    );
    res.status(201).json({ message: "Group created successfully.", group: r.rows[0] });
  } catch (err) {
    console.error("Error creating group:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

// UPDATE group
exports.updateGroup = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  try {
    const check = await db.query('SELECT id FROM "Groups" WHERE id=$1', [id]);
    if (!check.rows.length) return res.status(404).json({ message: "Group not found." });

    const r = await db.query(
      `UPDATE "Groups" 
       SET name=$1, description=$2, "updatedAt"=NOW() 
       WHERE id=$3 RETURNING *`,
      [name.trim(), description?.trim() || null, id]
    );
    res.json({ message: "Group updated successfully.", group: r.rows[0] });
  } catch (err) {
    console.error("Error updating group:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

// DELETE group
exports.deleteGroup = async (req, res) => {
  const { id } = req.params;
  try {
    const check = await db.query('SELECT id FROM "Groups" WHERE id=$1', [id]);
    if (!check.rows.length) return res.status(404).json({ message: "Group not found." });

    await db.query('DELETE FROM "Groups" WHERE id=$1', [id]);
    res.json({ message: "Group deleted successfully." });
  } catch (err) {
    console.error("Error deleting group:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};
