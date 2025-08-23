const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const generateToken = require('../utils/generateToken')
require('dotenv').config();


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
