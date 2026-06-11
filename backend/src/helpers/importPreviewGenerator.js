async function buildImportPreview(db, parsed) {
  const existingGoals = (await db.query(`SELECT id, title, "groupId", "rollNo" FROM "Goals"`)).rows;
  const existingTasks = (await db.query(`SELECT id, title, "goalId", "rollNo" FROM "Tasks"`)).rows;
  const existingActivities = (await db.query(`SELECT id, title, "taskId", "rollNo" FROM "Activities"`)).rows;

  const goalMap = new Map();
  const taskMap = new Map();
  const activityMap = new Map();

  for (const goal of existingGoals) {
    goalMap.set(`id:${goal.id}`, goal);
    if (goal.rollNo) goalMap.set(`rollno:${goal.rollNo}`, goal);
    goalMap.set(`${String(goal.title).trim().toLowerCase()}|${goal.groupId || 0}`, goal);
  }
  for (const task of existingTasks) {
    taskMap.set(`id:${task.id}`, task);
    if (task.rollNo) taskMap.set(`rollno:${task.rollNo}|${task.goalId}`, task);
    taskMap.set(`${String(task.title).trim().toLowerCase()}|${task.goalId}`, task);
  }
  for (const activity of existingActivities) {
    activityMap.set(`id:${activity.id}`, activity);
    if (activity.rollNo) activityMap.set(`rollno:${activity.rollNo}|${activity.taskId}`, activity);
    activityMap.set(`${String(activity.title).trim().toLowerCase()}|${activity.taskId}`, activity);
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
    return goalMap.get(`${normalize(row.goal_title || row.goal_name)}|${Number(row.goal_group_id) || 0}`);
  }

  function matchTask(row) {
    if (row.task_id) return taskMap.get(`id:${Number(row.task_id)}`);
    if (row.task_roll_no && row.goal_id) return taskMap.get(`rollno:${row.task_roll_no}|${Number(row.goal_id)}`);
    return taskMap.get(`${normalize(row.task_title || row.task_name)}|${Number(row.goal_id) || 0}`);
  }

  function matchActivity(row) {
    if (row.activity_id) return activityMap.get(`id:${Number(row.activity_id)}`);
    if (row.activity_roll_no && row.task_id) return activityMap.get(`rollno:${row.activity_roll_no}|${Number(row.task_id)}`);
    return activityMap.get(`${normalize(row.activity_title || row.activity_name)}|${Number(row.task_id) || 0}`);
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

  return preview;
}

module.exports = {
  buildImportPreview,
};
