const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

require('dotenv').config();

// Helper for generating JWT with updated info
const generateToken = async (userId) => {
  const query = `
    SELECT u.id, u.username, u.name, u.language, u."darkMode",
           r.name AS "roleName"
    FROM "Users" u
    LEFT JOIN "Roles" r ON u."roleId" = r.id
    WHERE u.id = $1;
  `;
  const { rows } = await db.query(query, [userId]);
  const user = rows[0];

  const permsQuery = `
    SELECT p.name AS permission 
    FROM "Permissions" p
    JOIN "RolePermissions" rp ON p.id = rp."permissionId"
    WHERE rp."roleId" = $1;
  `;
  const permsResult = await db.query(permsQuery, [user.roleId]);
  const permissions = permsResult.rows.map(row => row.permission);

  const payload = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.roleName,
    permissions,
    language: user.language,
    darkMode: user.darkMode
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });

  return { token, user: payload };
};

// GET /settings
exports.getSettings = async (req, res) => {
  const userId = req.user.id;

  try {
    const { rows } = await db.query(
      'SELECT username, name, language, "darkMode" FROM "Users" WHERE id = $1',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// PUT /settings
exports.updateSettings = async (req, res) => {
  const userId = req.user.id;
  const { language, darkMode, oldPassword, newPassword } = req.body;

  try {
    // Handle password change if provided
    if (oldPassword && newPassword) {
      const { rows } = await db.query(
        'SELECT password FROM "Users" WHERE id = $1',
        [userId]
      );
      const user = rows[0];

      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Old password is incorrect.' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await db.query(
        'UPDATE "Users" SET password = $1, language = $2, "darkMode" = $3, "updatedAt" = NOW() WHERE id = $4',
        [hashedPassword, language, darkMode, userId]
      );
    } else {
      await db.query(
        'UPDATE "Users" SET language = $1, "darkMode" = $2, "updatedAt" = NOW() WHERE id = $3',
        [language, darkMode, userId]
      );
    }

    // Generate fresh token with updated data
    const { token, user } = await generateToken(userId);

    res.status(200).json({
      message: 'Settings updated successfully.',
      token,
      user
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
