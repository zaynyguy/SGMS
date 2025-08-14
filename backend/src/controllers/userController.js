const db = require('../db');
const bcrypt = require('bcrypt');

// -------------------- GET ALL USERS --------------------
exports.getAllUsers = async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.username, u.name, r.name AS "roleName",
             COALESCE(json_agg(p.name) FILTER (WHERE p.name IS NOT NULL), '[]'::json) AS permissions,
             u.language, u."darkMode", u."createdAt"
      FROM "Users" u
      LEFT JOIN "Roles" r ON u."roleId" = r.id
      LEFT JOIN "RolePermissions" rp ON r.id = rp."roleId"
      LEFT JOIN "Permissions" p ON rp."permissionId" = p.id
      GROUP BY u.id, r.name
      ORDER BY u.id ASC;
    `;
    const { rows } = await db.query(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// -------------------- CREATE USER --------------------
exports.createUser = async (req, res) => {
  const { username, name, password, roleId } = req.body;
  if (!username || !name || !password || !roleId) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if username exists
    const existingUser = await client.query('SELECT id FROM "Users" WHERE username = $1', [username.trim()]);
    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'A user with that username already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userResult = await client.query(
      `INSERT INTO "Users" (username, name, password, "roleId", language, "darkMode")
       VALUES ($1, $2, $3, $4, 'en', false)
       RETURNING id, username, name, "roleId", language, "darkMode";`,
      [username.trim(), name.trim(), hashedPassword, roleId]
    );

    const permsResult = await client.query(
      `SELECT p.name AS permission
       FROM "Permissions" p
       JOIN "RolePermissions" rp ON p.id = rp."permissionId"
       WHERE rp."roleId" = $1;`,
      [roleId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'User created successfully.',
      user: { 
        ...userResult.rows[0],
        permissions: permsResult.rows.map(r => r.permission),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};

// -------------------- UPDATE USER --------------------
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { username, name, roleId, password } = req.body;

  if (!username || !name || !roleId) {
    return res.status(400).json({ message: 'Username, name, and roleId are required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const userCheck = await client.query('SELECT id FROM "Users" WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found.' });
    }

    // Check if username is taken by another user
    const usernameCheck = await client.query('SELECT id FROM "Users" WHERE username = $1 AND id <> $2', [username.trim(), id]);
    if (usernameCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'A user with that username already exists.' });
    }

    let query, params;
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = `
        UPDATE "Users"
        SET username = $1, name = $2, "roleId" = $3, password = $4, "updatedAt" = NOW()
        WHERE id = $5
        RETURNING id, username, name, "roleId";
      `;
      params = [username.trim(), name.trim(), roleId, hashedPassword, id];
    } else {
      query = `
        UPDATE "Users"
        SET username = $1, name = $2, "roleId" = $3, "updatedAt" = NOW()
        WHERE id = $4
        RETURNING id, username, name, "roleId";
      `;
      params = [username.trim(), name.trim(), roleId, id];
    }

    const { rows } = await client.query(query, params);

    const permsResult = await client.query(
      `SELECT p.name AS permission
       FROM "Permissions" p
       JOIN "RolePermissions" rp ON p.id = rp."permissionId"
       WHERE rp."roleId" = $1;`,
      [roleId]
    );

    await client.query('COMMIT');

    res.status(200).json({
      message: 'User updated successfully.',
      user: { ...rows[0], permissions: permsResult.rows.map(r => r.permission) },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};

// -------------------- DELETE USER --------------------
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const userCheck = await client.query('SELECT id FROM "Users" WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found.' });
    }

    await client.query('DELETE FROM "Users" WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};
