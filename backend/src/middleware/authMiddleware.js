const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });

  try {
    const userResult = await db.query('SELECT * FROM "Users" WHERE username = $1', [username]);
    if (userResult.rows.length === 0) return res.status(401).json({ message: 'Invalid credentials.' });

    const user = userResult.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ message: 'Invalid credentials.' });
    
    const permsResult = await db.query(
      'SELECT p.name FROM "Permissions" p JOIN "RolePermissions" rp ON p.id = rp."permissionId" WHERE rp."roleId" = $1',
      [user.roleId]
    );
    const permissions = permsResult.rows.map(p => p.name);

    const roleResult = await db.query('SELECT name FROM "Roles" WHERE id = $1', [user.roleId]);
    const roleName = roleResult.rows[0]?.name || null;

    const payload = { id: user.id, username: user.username, name: user.name, role: roleName, permissions };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });

    res.status(200).json({
      message: 'Login successful!',
      token,
      user: { id: user.id, username: user.username, name: user.name, role: roleName, permissions },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  }
};