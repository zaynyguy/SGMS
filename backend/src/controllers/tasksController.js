const db = require('../db');

// -------------------- GET TASKS BY GOAL --------------------
exports.getTasksByGoal = async (req, res) => {
  const { goalId } = req.params;
  try {
    const query = `
      SELECT t.*, u.username AS assignee
      FROM "Tasks" t
      LEFT JOIN "Users" u ON t."assigneeId" = u.id
      WHERE t."goalId" = $1
      ORDER BY t."createdAt" DESC;
    `;
    const { rows } = await db.query(query, [goalId]);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// -------------------- CREATE TASK --------------------
exports.createTask = async (req, res) => {
  const { goalId } = req.params;
  const { title, description, assigneeId, dueDate } = req.body;

  if (!title || !goalId) {
    return res.status(400).json({ message: 'Title and goalId are required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO "Tasks" ("goalId", title, description, "assigneeId", "dueDate")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *;`,
      [goalId, title.trim(), description?.trim() || null, assigneeId || null, dueDate || null]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Task created successfully.', task: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};

// -------------------- UPDATE TASK --------------------
exports.updateTask = async (req, res) => {
  const { taskId } = req.params;
  const id = taskId
  const { title, description, assigneeId, dueDate } = req.body;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const taskCheck = await client.query('SELECT id FROM "Tasks" WHERE id = $1', [taskId]);
    if (taskCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Task not found.' });
    }

    const query = `
      UPDATE "Tasks"
      SET title = $1, description = $2, "assigneeId" = $3, "dueDate" = $4, "updatedAt" = NOW()
      WHERE id = $5
      RETURNING *;
    `;
    const { rows } = await client.query(query, [
      title.trim(),
      description?.trim() || null,
      assigneeId || null,
      dueDate || null,
      taskId,
    ]);

    await client.query('COMMIT');
    res.status(200).json({ message: 'Task updated successfully.', task: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating task:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};

// -------------------- DELETE TASK --------------------
exports.deleteTask = async (req, res) => {
  const { taskId } = req.params;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const taskCheck = await client.query('SELECT id FROM "Tasks" WHERE id = $1', [taskId]);
    if (taskCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Task not found.' });
    }

    await client.query('DELETE FROM "Tasks" WHERE id = $1', [taskId]);
    await client.query('COMMIT');

    res.status(200).json({ message: 'Task deleted successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting task:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};
