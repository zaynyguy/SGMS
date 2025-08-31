const db = require("../db");

async function recalcProgressFromActivity(db, activityId) {
  // get taskId
  const a = await db.query(
    `SELECT "taskId" FROM "Activities" WHERE id = $1 LIMIT 1`,
    [activityId]
  );
  if (!a.rows.length) return null;
  const taskId = a.rows[0].taskId;

  // TASK aggregates
  const taskAgg = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN "isDone" THEN "weight" ELSE 0 END),0)::numeric AS done_weight,
       COALESCE(SUM("weight"),0)::numeric AS total_weight
     FROM "Activities"
     WHERE "taskId" = $1`,
    [taskId]
  );

  const tDone = parseFloat(taskAgg.rows[0].done_weight);
  const tTotal = parseFloat(taskAgg.rows[0].total_weight);
  const taskProgress = tTotal > 0 ? Math.round((tDone / tTotal) * 100) : 0;

  await db.query(`UPDATE "Tasks" SET progress = $1 WHERE id = $2`, [
    taskProgress,
    taskId,
  ]);

  // update task status automatically
  let newTaskStatus = "To Do";
  if (taskProgress === 100) newTaskStatus = "Done";
  else if (taskProgress > 0) newTaskStatus = "In Progress";

  await db.query(
    `UPDATE "Tasks" SET status = $1 WHERE id = $2 AND status <> $1`,
    [newTaskStatus, taskId]
  );

  // GOAL aggregates - using activities weights across tasks
  const g = await db.query(
    `SELECT "goalId" FROM "Tasks" WHERE id = $1 LIMIT 1`,
    [taskId]
  );
  if (!g.rows.length) return { taskId, taskProgress };

  const goalId = g.rows[0].goalId;

  const goalAgg = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN a."isDone" THEN a."weight" ELSE 0 END),0)::numeric AS done_weight,
       COALESCE(SUM(a."weight"),0)::numeric AS total_weight
     FROM "Activities" a
     JOIN "Tasks" t ON a."taskId" = t.id
     WHERE t."goalId" = $1`,
    [goalId]
  );

  const gDone = parseFloat(goalAgg.rows[0].done_weight);
  const gTotal = parseFloat(goalAgg.rows[0].total_weight);
  const goalProgress = gTotal > 0 ? Math.round((gDone / gTotal) * 100) : 0;

  await db.query(`UPDATE "Goals" SET progress = $1 WHERE id = $2`, [
    goalProgress,
    goalId,
  ]);

  // update goal status automatically
  let newGoalStatus = "Not Started";
  if (goalProgress === 100) newGoalStatus = "Completed";
  else if (goalProgress > 0) newGoalStatus = "In Progress";

  await db.query(
    `UPDATE "Goals" SET status = $1 WHERE id = $2 AND status <> $1`,
    [newGoalStatus, goalId]
  );

  return { taskId, taskProgress, goalId, goalProgress: goalProgress };
}

module.exports = { recalcProgressFromActivity };
