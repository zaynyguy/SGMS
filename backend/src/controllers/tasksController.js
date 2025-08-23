const db = require('../db');

exports.getTasksByGoal = async (req, res) => {
  const { goalId } = req.params;
  const q = `SELECT t.*, u.username AS assignee FROM "Tasks" t
             LEFT JOIN "Users" u ON t."assigneeId"=u.id
             WHERE t."goalId"=$1 ORDER BY t."createdAt" DESC`;
  const { rows } = await db.query(q, [goalId]);
  res.json(rows);
};

exports.createTask = async (req, res) => {
  const { goalId } = req.params;
  const { title, description, assigneeId, dueDate } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required.' });
  const r = await db.query(
    `INSERT INTO "Tasks" ("goalId", title, description, "assigneeId", "dueDate")
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [goalId, title.trim(), description?.trim() || null, assigneeId || null, dueDate || null]
  );
  res.status(201).json({ message: 'Task created successfully.', task: r.rows[0] });
};

exports.updateTask = async (req, res) => {
  const { taskId } = req.params;
  const { title, description, assigneeId, dueDate, status } = req.body;
  await db.tx(async (client) => {
    const c = await client.query('SELECT id FROM "Tasks" WHERE id=$1', [taskId]);
    if (!c.rows.length) { const e=new Error('Task not found'); e.status=404; throw e; }
    const r = await client.query(
      `UPDATE "Tasks" SET title=$1, description=$2, "assigneeId"=$3, "dueDate"=$4, status=COALESCE($5,status), "updatedAt"=NOW()
       WHERE id=$6 RETURNING *`,
      [title?.trim() || null, description?.trim() || null, assigneeId || null, dueDate || null, status || null, taskId]
    );
    if (status === 'Done') {
      await client.query('UPDATE "Tasks" SET progress=100 WHERE id=$1', [taskId]);
      const g = await client.query('SELECT "goalId" FROM "Tasks" WHERE id=$1', [taskId]);
      const goalId = g.rows[0].goalId;
      const gp = await client.query('SELECT COALESCE(AVG(progress),0)::int AS progress FROM "Tasks" WHERE "goalId"=$1', [goalId]);
      await client.query('UPDATE "Goals" SET progress=$1 WHERE id=$2', [gp.rows[0].progress, goalId]);
    }
    res.json({ message: 'Task updated successfully.', task: r.rows[0] });
  });
};

exports.deleteTask = async (req, res) => {
  const { taskId } = req.params;
  await db.tx(async (client) => {
    const c = await client.query('SELECT id,"goalId" FROM "Tasks" WHERE id=$1', [taskId]);
    if (!c.rows.length) { const e=new Error('Task not found'); e.status=404; throw e; }
    const goalId = c.rows[0].goalId;
    await client.query('DELETE FROM "Tasks" WHERE id=$1', [taskId]);
    const gp = await client.query('SELECT COALESCE(AVG(progress),0)::int AS progress FROM "Tasks" WHERE "goalId"=$1', [goalId]);
    await client.query('UPDATE "Goals" SET progress=$1 WHERE id=$2', [gp.rows[0].progress, goalId]);
    res.json({ message: 'Task deleted successfully.' });
  });
};
