const db = require('../db');
const { recalcProgressFromActivity } = require('../utils/progress');

exports.getActivitiesByTask = async (req, res) => {
  const { taskId } = req.params;
  const q = `
    SELECT a.*, t."goalId", gl."groupId", g.name AS "groupName"
    FROM "Activities" a
    JOIN "Tasks" t ON a."taskId"=t.id
    JOIN "Goals" gl ON t."goalId"=gl.id
    JOIN "Groups" g ON gl."groupId"=g.id
    WHERE a."taskId"=$1
    ORDER BY a."createdAt" DESC`;
  const { rows } = await db.query(q, [taskId]);
  res.json(rows);
};

exports.createActivity = async (req, res) => {
  const { taskId } = req.params;
  const { title, description, metrics, dueDate } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required.' });
  await db.tx(async (client) => {
    const t = await client.query('SELECT id FROM "Tasks" WHERE id=$1', [taskId]);
    if (!t.rows.length) {
      const err = new Error('Task not found'); err.status = 404; throw err;
    }
    const r = await client.query(
      `INSERT INTO "Activities" ("taskId", title, description, metrics, "dueDate")
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [taskId, title.trim(), description?.trim() || null, metrics || {}, dueDate || null]
    );
    res.status(201).json({ message: 'Activity created successfully.', activity: r.rows[0] });
  });
};

exports.updateActivity = async (req, res) => {
  const { activityId } = req.params;
  const { title, description, metrics, status, dueDate } = req.body;
  await db.tx(async (client) => {
    const c = await client.query('SELECT id FROM "Activities" WHERE id=$1', [activityId]);
    if (!c.rows.length) { const e=new Error('Activity not found'); e.status=404; throw e; }
    const r = await client.query(
      `UPDATE "Activities"
       SET title=$1, description=$2, metrics=$3, status=COALESCE($4,status), "dueDate"=$5, "updatedAt"=NOW()
       WHERE id=$6 RETURNING *`,
      [title?.trim() || null, description?.trim() || null, metrics || {}, status || null, dueDate || null, activityId]
    );
    await recalcProgressFromActivity(client, activityId);
    res.json({ message: 'Activity updated successfully.', activity: r.rows[0] });
  });
};

exports.deleteActivity = async (req, res) => {
  const { activityId } = req.params;
  await db.tx(async (client) => {
    const a = await client.query('SELECT id FROM "Activities" WHERE id=$1', [activityId]);
    if (!a.rows.length) { const e=new Error('Activity not found'); e.status=404; throw e; }
    const ta = await client.query('SELECT "taskId" FROM "Activities" WHERE id=$1', [activityId]);
    const taskId = ta.rows[0].taskId;
    await client.query('DELETE FROM "Activities" WHERE id=$1', [activityId]);
    const any = await client.query('SELECT id FROM "Activities" WHERE "taskId"=$1 LIMIT 1', [taskId]);
    if (any.rows.length) {
      await recalcProgressFromActivity(client, any.rows[0].id);
    } else {
      await client.query('UPDATE "Tasks" SET progress=0 WHERE id=$1', [taskId]);
      const g = await client.query('SELECT "goalId" FROM "Tasks" WHERE id=$1', [taskId]);
      if (g.rows.length) {
        const goalId = g.rows[0].goalId;
        const gp = await client.query('SELECT COALESCE(AVG(progress),0)::int AS progress FROM "Tasks" WHERE "goalId"=$1', [goalId]);
        await client.query('UPDATE "Goals" SET progress=$1 WHERE id=$2', [gp.rows[0].progress, goalId]);
      }
    }
    res.json({ message: 'Activity deleted successfully.' });
  });
};
