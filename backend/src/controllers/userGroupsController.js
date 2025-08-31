const db = require("../db");

// ADD user to group
exports.addUserToGroup = async (req, res) => {
  const { userId, groupId } = req.body;
  try {
    await db.query(
      `INSERT INTO "UserGroups" ("userId", "groupId") 
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, groupId]
    );
    res.status(201).json({ message: "User added to group." });
  } catch (err) {
    console.error("Error adding user to group:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

// REMOVE user from group
exports.removeUserFromGroup = async (req, res) => {
  const { userId, groupId } = req.body;
  try {
    await db.query(
      'DELETE FROM "UserGroups" WHERE "userId" = $1 AND "groupId" = $2',
      [userId, groupId]
    );
    res.json({ message: "User removed from group." });
  } catch (err) {
    console.error("Error removing user from group:", err);
    res.status(500).json({ message: "Internal server error." });
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
