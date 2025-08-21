const db = require('../db');


// -------------------- ADD USER TO GROUP --------------------
exports.addUserToGroup = async (req, res) => {
  const { userId, groupId } = req.body;
  try {
    await db.query(
      'INSERT INTO "UserGroups" ("userId", "groupId") VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, groupId]
    );
    res.status(201).json({ message: 'User added to group.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error.' });
  }
};


// -------------------- REMOVE USER FROM GROUP --------------------
exports.removeUserFromGroup = async (req, res) => {
  const { userId, groupId } = req.body;
  try {
    await db.query('DELETE FROM "UserGroups" WHERE "userId" = $1 AND "groupId" = $2', [userId, groupId]);
    res.status(200).json({ message: 'User removed from group.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error.' });
  }
};


// -------------------- LIST USERS IN A GROUP --------------------
exports.getGroupUsers = async (req, res) => {
  const { groupId } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.name, r.name as "roleName"
       FROM "UserGroups" ug
       JOIN "Users" u ON ug."userId" = u.id
       LEFT JOIN "Roles" r ON u."roleId" = r.id
       WHERE ug."groupId" = $1`,
      [groupId]
    );
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error.' });
  }
};
