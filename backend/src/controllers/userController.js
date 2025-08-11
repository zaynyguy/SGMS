const db = require('../db');
const bcrypt = require('bcrypt');

exports.getAllUsers = async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.username, u.name, r.name AS "roleName", u."createdAt"
      FROM "Users" u
      LEFT JOIN "Roles" r ON u."roleId" = r.id
      ORDER BY u.id ASC;
    `;
    const { rows } = await db.query(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.createUser = async (req, res) => {
  const { username, name, password, roleId } = req.body;

  if (!username || !name || !password || !roleId) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO "Users" (username, name, password, "roleId")
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, name, "roleId";
    `;
    const { rows } = await db.query(query, [username, name, hashedPassword, roleId]);

    res.status(201).json({ message: 'User created successfully.', user: rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A user with that username already exists.' });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { username, name, roleId, password } = req.body;

  if (!username || !name || !roleId) {
    return res.status(400).json({ message: 'Username, name, and roleId are required.' });
  }

  try {
    let query, params;

    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = `
        UPDATE "Users"
        SET username = $1, name = $2, "roleId" = $3, password = $4, "updatedAt" = NOW()
        WHERE id = $5
        RETURNING id, username, name, "roleId";
      `;
      params = [username, name, roleId, hashedPassword, id];
    } else {
      query = `
        UPDATE "Users"
        SET username = $1, name = $2, "roleId" = $3, "updatedAt" = NOW()
        WHERE id = $4
        RETURNING id, username, name, "roleId";
      `;
      params = [username, name, roleId, id];
    }

    const { rows } = await db.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({ message: 'User updated successfully.', user: rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A user with that username already exists.' });
    }
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const { rowCount } = await db.query('DELETE FROM "Users" WHERE id = $1', [id]);

    if (rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
