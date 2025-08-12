const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const query = `
      SELECT u.id, u.username, u.name, u.password, u."roleId", r.name AS "roleName"
      FROM "Users" u
      LEFT JOIN "Roles" r ON u."roleId" = r.id
      WHERE u.username = $1;
    `;
    const { rows } = await db.query(query, [username]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

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
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
