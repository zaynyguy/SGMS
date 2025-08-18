const db = require('../db');

// -------------------- GET ALL GROUPS --------------------
exports.getAllGroups = async (req, res) => {
  try {
    const query = `
      SELECT g.*, COUNT(ug."userId") AS "memberCount"
      FROM "Groups" g
      LEFT JOIN "UserGroups" ug ON g.id = ug."groupId"
      GROUP BY g.id
      ORDER BY g.id ASC;
    `;
    const { rows } = await db.query(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// -------------------- CREATE GROUP --------------------
exports.createGroup = async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Group name is required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM "Groups" WHERE name = $1', [name.trim()]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'A group with that name already exists.' });
    }

    const { rows } = await client.query(
      `INSERT INTO "Groups" (name, description) VALUES ($1, $2) RETURNING *`,
      [name.trim(), description?.trim() || null]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Group created successfully.', group: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating group:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};

// -------------------- UPDATE GROUP --------------------
exports.updateGroup = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Group name is required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const check = await client.query('SELECT id FROM "Groups" WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Group not found.' });
    }

    const { rows } = await client.query(
      `UPDATE "Groups" 
       SET name=$1, description=$2, "updatedAt"=NOW() 
       WHERE id=$3 RETURNING *`,
      [name.trim(), description?.trim() || null, id]
    );

    await client.query('COMMIT');
    res.status(200).json({ message: 'Group updated successfully.', group: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating group:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};

// -------------------- DELETE GROUP --------------------
exports.deleteGroup = async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const check = await client.query('SELECT id FROM "Groups" WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Group not found.' });
    }

    await client.query('DELETE FROM "Groups" WHERE id = $1', [id]);
    await client.query('COMMIT');

    res.status(200).json({ message: 'Group deleted successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting group:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};
