const { buildQuarterlyRecordsMap } = require("./quarterlyRecords");

async function buildImportPreview(db, parsed) {
  const existingGoals = (
    await db.query(`SELECT id, title, "groupId", "rollNo" FROM "Goals"`)
  ).rows;
  const existingTasks = (
    await db.query(`SELECT id, title, "goalId", "rollNo" FROM "Tasks"`)
  ).rows;
  const existingActivities = (
    await db.query(
      `SELECT id, title, "taskId", "rollNo", "targetMetric", "quarterlyGoals" FROM "Activities"`,
    )
  ).rows;

  const goalMap = new Map();
  const taskMap = new Map();
  const activityMap = new Map();

  for (const goal of existingGoals) {
    const title = String(goal.title).trim().toLowerCase();
    goalMap.set(`id:${goal.id}`, goal);
    if (goal.rollNo) goalMap.set(`rollno:${goal.rollNo}`, goal);
    goalMap.set(`${title}|${goal.groupId || 0}`, goal);
    goalMap.set(title, goal);
  }
  for (const task of existingTasks) {
    const title = String(task.title).trim().toLowerCase();
    taskMap.set(`id:${task.id}`, task);
    if (task.rollNo) taskMap.set(`rollno:${task.rollNo}|${task.goalId}`, task);
    taskMap.set(`${title}|${task.goalId}`, task);
    taskMap.set(title, task);
  }
  for (const activity of existingActivities) {
    const title = String(activity.title).trim().toLowerCase();
    activityMap.set(`id:${activity.id}`, activity);
    if (activity.rollNo)
      activityMap.set(`rollno:${activity.rollNo}|${activity.taskId}`, activity);
    activityMap.set(`${title}|${activity.taskId}`, activity);
    activityMap.set(title, activity);
  }

  const preview = {
    goals: { create: 0, update: 0, unknown: 0 },
    tasks: { create: 0, update: 0, unknown: 0 },
    activities: { create: 0, update: 0, unknown: 0 },
    quarters: { create: 0, update: 0, missingActivity: 0 },
  };

  function normalize(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim().toLowerCase();
  }

  function matchGoal(row) {
    if (row.goal_id) return goalMap.get(`id:${Number(row.goal_id)}`);
    if (row.goal_roll_no) return goalMap.get(`rollno:${row.goal_roll_no}`);
    const titleKey = normalize(
      row.goal_title || row.goal_name || row.title || row.name,
    );
    const groupKey = `${titleKey}|${Number(row.goal_group_id) || 0}`;
    return goalMap.get(groupKey) || goalMap.get(titleKey);
  }

  function matchTask(row) {
    if (row.task_id) return taskMap.get(`id:${Number(row.task_id)}`);
    if (row.task_roll_no && row.goal_id)
      return taskMap.get(`rollno:${row.task_roll_no}|${Number(row.goal_id)}`);
    if (row.task_roll_no) return taskMap.get(`rollno:${row.task_roll_no}`);
    const titleKey = normalize(
      row.task_title || row.task_name || row.title || row.name,
    );
    const goalId = Number(row.goal_id) || 0;
    return taskMap.get(`${titleKey}|${goalId}`) || taskMap.get(titleKey);
  }

  function matchActivity(row) {
    if (row.activity_id)
      return activityMap.get(`id:${Number(row.activity_id)}`);
    if (row.activity_roll_no && row.task_id)
      return activityMap.get(
        `rollno:${row.activity_roll_no}|${Number(row.task_id)}`,
      );
    if (row.activity_roll_no)
      return activityMap.get(`rollno:${row.activity_roll_no}`);
    const titleKey = normalize(
      row.activity_title || row.activity_name || row.title || row.name,
    );
    const taskId = Number(row.task_id) || 0;
    return (
      activityMap.get(`${titleKey}|${taskId}`) || activityMap.get(titleKey)
    );
  }

  parsed.goals.forEach((row) => {
    const existing = matchGoal(row);
    if (existing) preview.goals.update += 1;
    else preview.goals.create += 1;
  });

  parsed.tasks.forEach((row) => {
    const existing = matchTask(row);
    if (existing) preview.tasks.update += 1;
    else preview.tasks.create += 1;
  });

  parsed.activities.forEach((row) => {
    const existing = matchActivity(row);
    if (existing) preview.activities.update += 1;
    else preview.activities.create += 1;
  });

  parsed.quarters.forEach((row) => {
    const activity = matchActivity(row);
    if (activity) {
      preview.quarters.update += 1;
    } else {
      preview.quarters.missingActivity += 1;
    }
  });

  // Hydrate quarterly values for activities so import preview UI can show existing q1..q4 values
  try {
    const activityIds = existingActivities.map((a) => a.id).filter(Boolean);
    if (activityIds.length > 0) {
      const fiscalRes = await db.query(
        `SELECT * FROM calc_fiscal_period(CURRENT_DATE)`,
      );
      const currentFiscalYear =
        fiscalRes.rows[0]?.fiscal_year || new Date().getFullYear();
      const recordsRes = await db.query(
        `SELECT "activityId", "quarter", "metricKey", "value" FROM "ActivityRecords" WHERE "activityId" = ANY($1) AND "fiscalYear" = $2 AND "quarter" IS NOT NULL`,
        [activityIds, currentFiscalYear],
      );
      const quarterlyMap = buildQuarterlyRecordsMap(
        existingActivities,
        recordsRes.rows,
        null,
      );

      const activitiesPreview = parsed.activities.map((row) => {
        const matched = matchActivity(row) || null;
        const activityId = matched?.id || null;
        const quarterlyRecords = activityId
          ? quarterlyMap[activityId] || {
              q1: null,
              q2: null,
              q3: null,
              q4: null,
            }
          : { q1: null, q2: null, q3: null, q4: null };
        return {
          row,
          matched,
          quarterlyRecords,
        };
      });

      preview.activitiesPreview = activitiesPreview;
    } else {
      preview.activitiesPreview = parsed.activities.map((r) => ({
        row: r,
        matched: null,
        quarterlyRecords: { q1: null, q2: null, q3: null, q4: null },
      }));
    }
  } catch (e) {
    // Non-fatal: keep preview counts even if hydration fails
    preview.activitiesPreview = parsed.activities.map((r) => ({
      row: r,
      matched: null,
      quarterlyRecords: { q1: null, q2: null, q3: null, q4: null },
    }));
    console.error("buildImportPreview hydration error:", e);
  }

  return preview;
}

module.exports = {
  buildImportPreview,
};
