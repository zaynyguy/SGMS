const db = require('../db');
const { recalcProgressFromActivity } = require('../utils/progress');
const { logAudit } = require('../helpers/audit');

exports.getTasksByGoal = async (req, res) => {
  const { goalId } = req.params;
  const isManager = req.user.permissions.includes("manage_gta");
  if (!isManager) {
    const check = await db.query(
      `SELECT 1 FROM "Goals" g
       JOIN "UserGroups" ug ON ug."groupId" = g."groupId"
       WHERE g.id = $1 AND ug."userId" = $2 LIMIT 1`,
      [goalId, req.user.id]
    );
    if (!check.rows.length) return res.status(403).json({ message: "Forbidden" });
  }

  const q = `SELECT t.*, u.username AS assignee FROM "Tasks" t
             LEFT JOIN "Users" u ON t."assigneeId"=u.id
             WHERE t."goalId"=$1 ORDER BY t."createdAt" DESC`;
  const { rows } = await db.query(q, [goalId]);
  res.json(rows);
};

exports.createTask = async (req, res) => {
  const { goalId } = req.params;
  const { title, description, assigneeId, dueDate, weight } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required.' });

  const r = await db.query(
    `INSERT INTO "Tasks" ("goalId", title, description, "assigneeId", "dueDate", "weight")
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [goalId, title.trim(), description?.trim() || null, assigneeId || null, dueDate || null, weight || 0]
  );
  res.status(201).json({ message: 'Task created successfully.', task: r.rows[0] });
};

exports.updateTask = async (req, res) => {
  const { taskId } = req.params;
  const { title, description, assigneeId, dueDate, status, weight } = req.body;

  await db.tx(async (client) => {
    const c = await client.query('SELECT * FROM "Tasks" WHERE id=$1', [taskId]);
    if (!c.rows.length) { const e=new Error('Task not found'); e.status=404; throw e; }

    // compute current task progress from activities (fresh calculation)
    const agg = await client.query(
      `SELECT
         COALESCE(SUM(CASE WHEN "isDone" THEN "weight" ELSE 0 END),0)::numeric AS done_weight,
         COALESCE(SUM("weight"),0)::numeric AS total_weight
       FROM "Activities" WHERE "taskId" = $1`,
      [taskId]
    );
    const doneW = parseFloat(agg.rows[0].done_weight);
    const totalW = parseFloat(agg.rows[0].total_weight);
    const computedProgress = totalW > 0 ? Math.round((doneW / totalW) * 100) : 0;

    // if trying to set status to Done but computedProgress < 100, treat as override
    if (status === 'Done' && computedProgress < 100) {
      // Only allow override from manage_gta (mutating routes are protected, but this ensures we record it)
      if (!req.user.permissions.includes('manage_gta')) {
        return res.status(400).json({ message: 'Cannot mark Task Done: task progress is not 100%.' });
      }
      // record override in AuditLogs
      await logAudit(req.user.id, 'override_task_done', 'Task', taskId, {
        note: 'Manual task Done override while progress < 100',
        computedProgress
      });
    }

    const r = await client.query(
      `UPDATE "Tasks" SET title=$1, description=$2, "assigneeId"=$3, "dueDate"=$4, status=COALESCE($5,status),
       "weight" = COALESCE($6,"weight"), "updatedAt"=NOW()
       WHERE id=$7 RETURNING *`,
      [title?.trim() || null, description?.trim() || null, assigneeId || null, dueDate || null, status || null, weight || null, taskId]
    );

    // Recalc goal progress if needed: use recalc helper via any activity id or set progress manually if no activities
    const oneAct = await client.query('SELECT id FROM "Activities" WHERE "taskId" = $1 LIMIT 1', [taskId]);
    if (oneAct.rows.length) {
      await recalcProgressFromActivity(client, oneAct.rows[0].id);
    } else {
      // if no activities and status Done -> set progress accordingly
      if (status === 'Done') {
        await client.query('UPDATE "Tasks" SET progress=100 WHERE id=$1', [taskId]);
        const g = await client.query('SELECT "goalId" FROM "Tasks" WHERE id=$1', [taskId]);
        if (g.rows.length) {
          const goalId = g.rows[0].goalId;
          const gp = await client.query('SELECT COALESCE(AVG(progress),0)::int AS progress FROM "Tasks" WHERE "goalId"=$1', [goalId]);
          await client.query('UPDATE "Goals" SET progress=$1 WHERE id=$2', [gp.rows[0].progress, goalId]);
        }
      }
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
