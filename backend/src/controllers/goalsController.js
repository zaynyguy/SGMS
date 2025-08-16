const db = require('../db');

// -------------------- GET ALL GOALS --------------------
exports.getAllGoals = async (req, res) => {
  try {
    const query = `
      SELECT g.*, grp.name AS "groupName"
      FROM "Goals" g
      LEFT JOIN "Groups" grp ON g."groupId" = grp.id
      ORDER BY g."createdAt" DESC;
    `;
    const { rows } = await db.query(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// -------------------- CREATE GOAL --------------------
exports.createGoal = async (req, res) => {
  const { title, description, groupId, startDate, endDate } = req.body;

  if (!title || !groupId) {
    return res.status(400).json({ message: 'Title and groupId are required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO "Goals" (title, description, "groupId", "startDate", "endDate") 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title.trim(), description?.trim() || null, groupId, startDate || null, endDate || null]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Goal created successfully.', goal: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating goal:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};

// -------------------- UPDATE GOAL --------------------
exports.updateGoal = async (req, res) => {
  const { id } = req.params;
  const { title, description, groupId, startDate, endDate } = req.body;

  if (!title || !groupId) {
    return res.status(400).json({ message: 'Title and groupId are required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const check = await client.query('SELECT id FROM "Goals" WHERE id=$1', [id]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Goal not found.' });
    }

    const { rows } = await client.query(
      `UPDATE "Goals"
       SET title=$1, description=$2, "groupId"=$3, "startDate"=$4, "endDate"=$5, "updatedAt"=NOW()
       WHERE id=$6 RETURNING *`,
      [title.trim(), description?.trim() || null, groupId, startDate || null, endDate || null, id]
    );

    await client.query('COMMIT');
    res.status(200).json({ message: 'Goal updated successfully.', goal: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating goal:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};

// -------------------- DELETE GOAL --------------------
exports.deleteGoal = async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const check = await client.query('SELECT id FROM "Goals" WHERE id=$1', [id]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Goal not found.' });
    }

    await client.query('DELETE FROM "Goals" WHERE id=$1', [id]);
    await client.query('COMMIT');

    res.status(200).json({ message: 'Goal deleted successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting goal:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};
