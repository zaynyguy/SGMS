const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Helper: Generate token + payload
const generateToken = async (userId) => {
  const query = `
    SELECT u.id, u.username, u.name, u.password, u."roleId", u.language, u."darkMode", r.name AS "roleName"
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
  const permissions = permsResult.rows.map(r => r.permission);

  const payload = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.roleName,
    permissions,
    language: user.language,
    darkMode: user.darkMode,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });

  return { token, user: payload };
};

exports.login = async (req, res) => {
  let { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });

  username = username.trim();
  password = password.trim();

  try {
    const { rows } = await db.query(`SELECT id, username, password FROM "Users" WHERE username = $1;`, [username]);
    if (rows.length === 0) return res.status(401).json({ message: 'Invalid username or password.' });

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ message: 'Invalid username or password.' });

    const { token, user: payload } = await generateToken(user.id);
    res.status(200).json({ message: 'Login successful.', token, user: payload });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.generateToken = generateToken;