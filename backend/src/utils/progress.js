async function recalcProgressFromActivity(client, activityId) {
  const a = await client.query('SELECT "taskId" FROM "Activities" WHERE id=$1', [activityId]);
  if (!a.rows.length) return;
  const taskId = a.rows[0].taskId;

  const t = await client.query(
    `SELECT COALESCE(AVG(CASE WHEN status='Done' THEN 100 ELSE 0 END),0)::int AS progress
     FROM "Activities" WHERE "taskId"=$1`, [taskId]);
  const taskProgress = t.rows[0].progress;
  await client.query('UPDATE "Tasks" SET progress=$1 WHERE id=$2', [taskProgress, taskId]);

  const g = await client.query('SELECT "goalId" FROM "Tasks" WHERE id=$1', [taskId]);
  if (!g.rows.length) return;
  const goalId = g.rows[0].goalId;

  const gg = await client.query(
    'SELECT COALESCE(AVG(progress),0)::int AS progress FROM "Tasks" WHERE "goalId"=$1',
    [goalId]
  );
  const goalProgress = gg.rows[0].progress;
  await client.query('UPDATE "Goals" SET progress=$1 WHERE id=$2', [goalProgress, goalId]);
}

module.exports = { recalcProgressFromActivity };
