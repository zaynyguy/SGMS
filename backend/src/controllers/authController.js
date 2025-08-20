const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Handles user login, authenticates credentials, and generates a JWT.
exports.login = async (req, res) => {
  let { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }
  username = username.trim().toLowerCase();
  password = password.trim();

  try {
    // Fetch user details including role and settings in a single query.
    const userQuery = `
      SELECT
        u.id, u.username, u.name, u.password, u.language, u."darkMode",
        r.name AS "roleName"
      FROM "Users" u
      LEFT JOIN "Roles" r ON u."roleId" = r.id
      WHERE u.username = $1;
    `;
    const userResult = await db.query(userQuery, [username]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const user = userResult.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // Fetch dynamic permissions for the user's role.
    const permsQuery = `
      SELECT p.name AS permission
      FROM "Permissions" p
      JOIN "RolePermissions" rp ON p.id = rp."permissionId"
      WHERE rp."roleId" = (SELECT "roleId" FROM "Users" WHERE id = $1);
    `;
    const permsResult = await db.query(permsQuery, [user.id]);
    const permissions = permsResult.rows.map(r => r.permission);

    // JWT payload for client-side use.
    const payload = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.roleName,
      permissions,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    });

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.roleName,
        permissions,
        language: user.language,
        darkMode: user.darkMode,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};