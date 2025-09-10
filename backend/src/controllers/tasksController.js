// src/controllers/tasksController.js

const db = require('../db');
const { logAudit } = require('../helpers/audit');

exports.getTasksByGoal = async (req, res) => {
  const { goalId } = req.params;
  const isManager = req.user.permissions.includes('manage_gta');

  if (!isManager) {
    const check = await db.query(
      `SELECT 1 FROM "Goals" g
       JOIN "UserGroups" ug ON ug."groupId" = g."groupId"
       WHERE g.id = $1 AND ug."userId" = $2 LIMIT 1`,
      [goalId, req.user.id]
    );

    if (!check.rows.length) return res.status(403).json({ message: 'Forbidden' });
  }

  const { rows } = await db.query(
    `SELECT t.*, u.username AS assignee 
     FROM "Tasks" t
     LEFT JOIN "Users" u ON t."assigneeId" = u.id
     WHERE t."goalId" = $1
     ORDER BY t."createdAt" DESC`,
    [goalId]
  );

  res.json(rows);
};

exports.createTask = async (req, res) => {
  const { goalId } = req.params;
  const { title, description, assigneeId, dueDate, weight } = req.body;

  if (!title) return res.status(400).json({ message: 'Title is required.' });

  const { rows } = await db.query(
    `INSERT INTO "Tasks" ("goalId", title, description, "assigneeId", "dueDate", "weight")
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [goalId, title.trim(), description?.trim() || null, assigneeId || null, dueDate || null, weight || 0]
  );

  res.status(201).json({ message: 'Task created successfully.', task: rows[0] });
};

exports.updateTask = async (req, res) => {
  const { taskId } = req.params;
  const { title, description, assigneeId, dueDate, status, weight } = req.body;

  try {
    const { rows: currentTask } = await db.query('SELECT * FROM "Tasks" WHERE id = $1', [taskId]);
    if (!currentTask.length) return res.status(404).json({ message: 'Task not found.' });

    // Optional: audit manual status change
    if (status === 'Done' && !req.user.permissions.includes('manage_gta')) {
      await logAudit(req.user.id, 'manual_task_done', 'Task', taskId, {
        note: 'Task status manually set to Done by non-manager.'
      });
    }

    const { rows: updated } = await db.query(
      `UPDATE "Tasks" 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           "assigneeId" = COALESCE($3, "assigneeId"),
           "dueDate" = COALESCE($4, "dueDate"),
           status = COALESCE($5, status),
           weight = COALESCE($6, weight),
           "updatedAt" = NOW()
       WHERE id = $7
       RETURNING *`,
      [title?.trim() || null, description?.trim() || null, assigneeId || null, dueDate || null, status || null, weight || null, taskId]
    );

    res.json({ message: 'Task updated successfully.', task: updated[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.deleteTask = async (req, res) => {
  const { taskId } = req.params;

  try {
    const { rows: currentTask } = await db.query('SELECT id FROM "Tasks" WHERE id = $1', [taskId]);
    if (!currentTask.length) return res.status(404).json({ message: 'Task not found.' });

    await db.query('DELETE FROM "Tasks" WHERE id = $1', [taskId]);
    res.json({ message: 'Task deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
