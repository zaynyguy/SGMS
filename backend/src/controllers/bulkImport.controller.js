const fs = require("fs");
const path = require("path");
const db = require("../db");
const { UPLOAD_DIR } = require("../middleware/uploadMiddleware");
const { parseWorkbook } = require("../helpers/excelParser");
const { validateImportData } = require("../helpers/importValidator");
const { buildImportPreview } = require("../helpers/importPreviewGenerator");
const { buildErrorWorkbook, buildErrorCsv } = require("../helpers/importErrorReporter");
const { buildTemplateWorkbook } = require("../scripts/templateGenerator");

function safeParseJson(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      return JSON.parse(trimmed.replace(/'/g, '"'));
    } catch {
      return trimmed;
    }
  }
}

const IMPORT_HISTORY_TABLE = "ImportHistory";

function buildUploadPath(fileName) {
  return path.join(UPLOAD_DIR, path.basename(fileName || ""));
}

function getUploadedImportFile(req) {
  if (req.file) return req.file;
  if (req.files) {
    if (Array.isArray(req.files) && req.files.length > 0) return req.files[0];
    if (req.files.file && Array.isArray(req.files.file) && req.files.file.length > 0)
      return req.files.file[0];
    const firstKey = Object.keys(req.files)[0];
    if (firstKey && Array.isArray(req.files[firstKey]) && req.files[firstKey].length > 0)
      return req.files[firstKey][0];
  }
  return null;
}

async function ensureImportHistoryTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${IMPORT_HISTORY_TABLE}" (
      id SERIAL PRIMARY KEY,
      "fileName" VARCHAR(255) NOT NULL,
      "originalName" VARCHAR(255),
      "uploadedBy" INTEGER REFERENCES "Users"(id) ON DELETE SET NULL,
      "importDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "summary" JSONB NOT NULL,
      "status" VARCHAR(50) NOT NULL,
      "errors" JSONB DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function uploadImportFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "Excel file is required." });
  }

  return res.json({
    fileName: req.file.filename,
    originalName: req.file.originalname,
    message: "File uploaded successfully.",
  });
}

async function previewImport(req, res) {
  try {
    const uploadedFile = getUploadedImportFile(req);
    const filePath = uploadedFile
      ? uploadedFile.path
      : req.body.fileName
      ? buildUploadPath(req.body.fileName)
      : null;

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({ error: "Uploaded file not found." });
    }

    const parsed = await parseWorkbook(filePath);
    const validation = validateImportData(parsed);
    const preview = await buildImportPreview(db, parsed);

    return res.json({
      fileName: path.basename(filePath),
      preview,
      validation,
    });
  } catch (err) {
    console.error("previewImport error:", err);
    return res.status(500).json({ error: err.message || "Failed to preview import." });
  }
}

async function executeImport(req, res) {
  const uploadedFile = getUploadedImportFile(req);
  const requestedFileName = req.body.fileName ? path.basename(req.body.fileName) : null;
  const deleteAfterImport =
    typeof req.body.deleteAfterImport === "undefined"
      ? true
      : String(req.body.deleteAfterImport).toLowerCase() !== "false";

  const fileNameToUse = uploadedFile?.filename || requestedFileName;
  const filePath = uploadedFile
    ? uploadedFile.path
    : requestedFileName
    ? buildUploadPath(requestedFileName)
    : null;

  if (!filePath) {
    return res.status(400).json({ error: "file or fileName is required." });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found on server." });
  }

  const client = await db.connect();
  let historyId = null;
  let importSummary = null;
  let importErrors = [];

  try {
    const parsed = await parseWorkbook(filePath);
    const validation = validateImportData(parsed);
    if (validation.errors.length) {
      return res.status(400).json({
        message: "Validation failed.",
        validation,
      });
    }

    const preview = await buildImportPreview(db, parsed);

    await ensureImportHistoryTable(client);
    await client.query("BEGIN");

    const importResult = await performImport(client, parsed, req.user.id);
    importSummary = importResult.summary;
    importErrors = importResult.errors;

    if (importErrors.length) {
      await client.query("ROLLBACK");
      const historyRes = await client.query(
        `INSERT INTO "${IMPORT_HISTORY_TABLE}" (
            "fileName", "originalName", "uploadedBy", "summary", "status", "errors"
          ) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          fileNameToUse,
          req.body.originalName || uploadedFile?.originalname || null,
          req.user?.id || null,
          importSummary,
          "failed",
          JSON.stringify(importErrors),
        ],
      );
      historyId = historyRes.rows[0].id;
      return res.status(400).json({
        message: "Import failed.",
        historyId,
        summary: importSummary,
        errors: importErrors,
      });
    }

    await client.query("COMMIT");

    const historyRes = await client.query(
      `INSERT INTO "${IMPORT_HISTORY_TABLE}" (
          "fileName", "originalName", "uploadedBy", "summary", "status", "errors"
        ) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [
        fileNameToUse,
        req.body.originalName || uploadedFile?.originalname || null,
        req.user?.id || null,
        importSummary,
        importErrors.length ? "failed" : "completed",
        JSON.stringify(importErrors),
      ],
    );
    historyId = historyRes.rows[0].id;

    return res.json({
      message: "Import completed.",
      historyId,
      summary: importSummary,
      errors: importErrors,
      preview,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("executeImport error:", err);
    return res.status(500).json({ error: err.message || "Import failed." });
  } finally {
    client.release();
    if (deleteAfterImport) {
      fs.unlink(filePath, () => {});
    }
  }
}

async function performImport(client, parsed, userId) {
  const results = {
    goals_created: 0,
    goals_updated: 0,
    tasks_created: 0,
    tasks_updated: 0,
    activities_created: 0,
    activities_updated: 0,
    quarterly_records_created: 0,
    quarterly_records_updated: 0,
    errors: [],
  };

  const goals = await loadExistingGoals(client);
  const tasks = await loadExistingTasks(client);
  const activities = await loadExistingActivities(client);
  const groups = await loadExistingGroups(client);

  const goalLookup = buildGoalLookup(goals);
  const taskLookup = buildTaskLookup(tasks);
  const activityLookup = buildActivityLookup(activities);
  const groupLookup = buildGroupLookup(groups);

  const goalIdByRow = new Map();
  const taskIdByRow = new Map();

  for (let index = 0; index < parsed.goals.length; index += 1) {
    const row = parsed.goals[index];
    try {
      const { id, action } = await upsertGoal(client, row, goalLookup, groupLookup);
      goalIdByRow.set(index, id);
      if (action === "created") results.goals_created += 1;
      else if (action === "updated") results.goals_updated += 1;
    } catch (err) {
      results.errors.push({ row: index + 2, type: "goal", message: err.message });
    }
  }

  for (let index = 0; index < parsed.tasks.length; index += 1) {
    const row = parsed.tasks[index];
    try {
      const goalId = await resolveGoalIdForTask(client, row, goalLookup, groupLookup, goalIdByRow, parsed.goals);
      const { id, action } = await upsertTask(client, row, goalId, taskLookup);
      taskIdByRow.set(index, id);
      if (action === "created") results.tasks_created += 1;
      else if (action === "updated") results.tasks_updated += 1;
    } catch (err) {
      results.errors.push({ row: index + 2, type: "task", message: err.message });
    }
  }

  for (let index = 0; index < parsed.activities.length; index += 1) {
    const row = parsed.activities[index];
    try {
      const taskId = await resolveTaskIdForActivity(client, row, taskLookup, parsed.tasks);
      const { action } = await upsertActivity(client, row, taskId, activityLookup);
      if (action === "created") results.activities_created += 1;
      else if (action === "updated") results.activities_updated += 1;
    } catch (err) {
      results.errors.push({ row: index + 2, type: "activity", message: err.message });
    }
  }

  for (const quarterRow of parsed.quarters) {
    try {
      const activityId = await resolveActivityIdForQuarter(client, quarterRow, activityLookup, parsed.activities);
      if (!activityId) {
        results.errors.push({ row: quarterRow.rowNumber, type: "quarter", message: "Activity could not be resolved." });
        continue;
      }
      const { action } = await upsertQuarterlyRecord(client, quarterRow, activityId, userId);
      if (action === "created") results.quarterly_records_created += 1;
      else if (action === "updated") results.quarterly_records_updated += 1;
    } catch (err) {
      results.errors.push({ row: quarterRow.rowNumber, type: "quarter", message: err.message });
    }
  }

  return { summary: results, errors: results.errors };
}

async function loadExistingGoals(client) {
  const { rows } = await client.query(`SELECT id, title, "groupId", "rollNo" FROM "Goals"`);
  return rows;
}

async function loadExistingTasks(client) {
  const { rows } = await client.query(`SELECT id, title, "goalId", "rollNo" FROM "Tasks"`);
  return rows;
}

async function loadExistingActivities(client) {
  const { rows } = await client.query(`SELECT id, title, "taskId", "rollNo" FROM "Activities"`);
  return rows;
}

async function loadExistingGroups(client) {
  const { rows } = await client.query(`SELECT id, name FROM "Groups"`);
  return rows;
}

function buildGoalLookup(goals) {
  const map = new Map();
  for (const goal of goals) {
    const titleKey = `${String(goal.title).trim().toLowerCase()}|${goal.groupId || 0}`;
    map.set(titleKey, goal);
    if (goal.rollNo) {
      map.set(`rollno:${goal.rollNo}`, goal);
    }
    map.set(`id:${goal.id}`, goal);
  }
  return map;
}

function buildTaskLookup(tasks) {
  const map = new Map();
  for (const task of tasks) {
    const titleKey = `${String(task.title).trim().toLowerCase()}|${task.goalId}`;
    map.set(titleKey, task);
    if (task.rollNo) {
      map.set(`rollno:${task.rollNo}|${task.goalId}`, task);
      map.set(`rollno:${task.rollNo}`, task);
    }
    map.set(`id:${task.id}`, task);
  }
  return map;
}

function buildActivityLookup(activities) {
  const map = new Map();
  for (const activity of activities) {
    const titleKey = `${String(activity.title).trim().toLowerCase()}|${activity.taskId}`;
    map.set(titleKey, activity);
    if (activity.rollNo) {
      map.set(`rollno:${activity.rollNo}|${activity.taskId}`, activity);
      map.set(`rollno:${activity.rollNo}`, activity);
    }
    map.set(`id:${activity.id}`, activity);
  }
  return map;
}

function buildGroupLookup(groups) {
  const map = new Map();
  for (const group of groups) {
    map.set(String(group.name).trim().toLowerCase(), group);
    map.set(`id:${group.id}`, group);
  }
  return map;
}

function normalizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

async function upsertGoal(client, row, goalLookup, groupLookup) {
  let groupId = null;
  if (row.goal_group_id) groupId = Number(row.goal_group_id);
  else if (row.goal_group_name) {
    const group = groupLookup.get(normalizeString(row.goal_group_name));
    groupId = group?.id || null;
  }

  let existingGoal = null;
  if (row.goal_id) existingGoal = goalLookup.get(`id:${Number(row.goal_id)}`);
  if (!existingGoal) {
    const titleKey = `${normalizeString(row.goal_title)}|${groupId || 0}`;
    existingGoal = goalLookup.get(titleKey);
  }

  const values = {
    title: row.goal_title || row.goal_name || null,
    description: row.goal_description || row.description || null,
    status: row.goal_status || "Not Started",
    weight: Number(row.goal_weight) || null,
    startDate: row.goal_start_date || null,
    endDate: row.goal_end_date || null,
    groupId,
  };

  if (existingGoal) {
    const updateRes = await client.query(
      `UPDATE "Goals"
        SET title = COALESCE($1, title),
            description = COALESCE($2, description),
            status = COALESCE($3, status),
            weight = COALESCE($4::numeric, weight),
            "startDate" = COALESCE($5, "startDate"),
            "endDate" = COALESCE($6, "endDate"),
            "groupId" = COALESCE($7, "groupId"),
            "updatedAt" = NOW()
       WHERE id = $8 RETURNING id`,
      [
        values.title,
        values.description,
        values.status,
        values.weight,
        values.startDate,
        values.endDate,
        values.groupId,
        existingGoal.id,
      ],
    );
    return { id: updateRes.rows[0].id, action: "updated" };
  }

  const insertRes = await client.query(
    `INSERT INTO "Goals"
       (title, description, "groupId", status, weight, "startDate", "endDate", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,COALESCE($5::numeric,100),$6,$7,NOW(),NOW())
       RETURNING id`,
    [
      values.title,
      values.description,
      values.groupId,
      values.status,
      values.weight,
      values.startDate,
      values.endDate,
    ],
  );
  const id = insertRes.rows[0].id;
  const titleKey = `${normalizeString(values.title)}|${groupId || 0}`;
  goalLookup.set(titleKey, { id, ...values, groupId });
  return { id, action: "created" };
}

async function resolveGoalIdForTask(client, row, goalLookup, groupLookup, goalIdByRow, goalsRows) {
  if (row.goal_id) return Number(row.goal_id);

  if (row.goal_roll_no) {
    const goal = goalLookup.get(`rollno:${row.goal_roll_no}`);
    if (goal) return goal.id;
  }

  let groupId = null;
  if (row.goal_group_id) groupId = Number(row.goal_group_id);
  else if (row.goal_group_name) {
    const group = groupLookup.get(normalizeString(row.goal_group_name));
    groupId = group?.id || null;
  }

  const titleKey = `${normalizeString(row.goal_title || row.goal_name)}|${groupId || 0}`;
  const goal = goalLookup.get(titleKey);
  if (goal) return goal.id;

  // fall back to row-level created goals from the same upload if the title matches
  for (const [rowIndex, id] of goalIdByRow.entries()) {
    const uploaded = goalsRows[rowIndex];
    if (normalizeString(uploaded.goal_title || uploaded.goal_name) === normalizeString(row.goal_title || row.goal_name)) {
      return id;
    }
  }

  throw new Error("Unable to resolve parent Goal for Task.");
}

async function upsertTask(client, row, goalId, taskLookup) {
  let existingTask = null;
  if (row.task_id) existingTask = taskLookup.get(`id:${Number(row.task_id)}`);
  if (!existingTask) {
    const titleKey = `${normalizeString(row.task_title || row.task_name)}|${goalId}`;
    existingTask = taskLookup.get(titleKey);
  }

  const values = {
    title: row.task_title || row.task_name || null,
    description: row.task_description || row.description || null,
    status: row.task_status || "To Do",
    weight: Number(row.task_weight) || null,
    dueDate: row.task_due_date || null,
    assigneeId: row.task_assignee_id || null,
    goalId,
  };

  if (existingTask) {
    const updateRes = await client.query(
      `UPDATE "Tasks"
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             status = COALESCE($3, status),
             weight = COALESCE($4::numeric, weight),
             "dueDate" = COALESCE($5, "dueDate"),
             "assigneeId" = COALESCE($6, "assigneeId"),
             "updatedAt" = NOW()
       WHERE id = $7 RETURNING id`,
      [
        values.title,
        values.description,
        values.status,
        values.weight,
        values.dueDate,
        values.assigneeId,
        existingTask.id,
      ],
    );
    return { id: updateRes.rows[0].id, action: "updated" };
  }

  const insertRes = await client.query(
    `INSERT INTO "Tasks"
       ("goalId", title, description, status, weight, "dueDate", "assigneeId", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,COALESCE($5::numeric,0),$6,$7,NOW(),NOW())
       RETURNING id`,
    [
      values.goalId,
      values.title,
      values.description,
      values.status,
      values.weight,
      values.dueDate,
      values.assigneeId,
    ],
  );
  const id = insertRes.rows[0].id;
  const titleKey = `${normalizeString(values.title)}|${goalId}`;
  taskLookup.set(titleKey, { id, ...values });
  return { id, action: "created" };
}

async function resolveTaskIdForActivity(client, row, taskLookup, tasksRows) {
  if (row.task_id) return Number(row.task_id);
  if (row.task_roll_no) {
    const task =
      taskLookup.get(`rollno:${row.task_roll_no}|${Number(row.goal_id) || 0}`) ||
      taskLookup.get(`rollno:${row.task_roll_no}`);
    if (task) return task.id;
  }
  const titleKey = `${normalizeString(row.task_title || row.task_name)}|${Number(row.goal_id) || 0}`;
  const task = taskLookup.get(titleKey);
  if (task) return task.id;

  for (const taskRow of tasksRows) {
    if (normalizeString(taskRow.task_title || taskRow.task_name) === normalizeString(row.task_title || row.task_name)) {
      return Number(taskRow.task_id || taskRow.taskId || null) || null;
    }
  }

  throw new Error("Unable to resolve parent Task for Activity.");
}

async function upsertActivity(client, row, taskId, activityLookup) {
  let existingActivity = null;
  if (row.activity_id) existingActivity = activityLookup.get(`id:${Number(row.activity_id)}`);
  if (!existingActivity) {
    const titleKey = `${normalizeString(row.activity_title || row.activity_name)}|${taskId}`;
    existingActivity = activityLookup.get(titleKey);
  }

  const values = {
    title: row.activity_title || row.activity_name || null,
    description: row.activity_description || row.description || null,
    status: row.activity_status || "To Do",
    weight: Number(row.activity_weight) || null,
    dueDate: row.activity_due_date || null,
    metricType: row.activity_metric_type || "Plus",
    targetMetric: row.activity_target_metric || null,
    currentMetric: row.activity_current_metric || null,
    previousMetric: row.activity_previous_metric || null,
    quarterlyGoals: safeParseJson(
      row.activity_quarterly_goals ||
        row.activity_quarterlyGoals ||
        row.quarterly_goals ||
        row.quarterlyGoals ||
        null,
    ),
    isDone:
      row.activity_is_done === true ||
      String(row.activity_is_done).toLowerCase() === "true" ||
      String(row.activity_status).trim().toLowerCase() === "done" ||
      String(row.activity_status).trim().toLowerCase() === "completed",
    taskId,
  };

  if (existingActivity) {
    const updateRes = await client.query(
      `UPDATE "Activities"
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             status = COALESCE($3, status),
             weight = COALESCE($4::numeric, weight),
             "dueDate" = COALESCE($5, "dueDate"),
             "metricType" = COALESCE($6, "metricType"),
             "targetMetric" = COALESCE($7, "targetMetric"),
             "currentMetric" = COALESCE($8, "currentMetric"),
             "previousMetric" = COALESCE($9, "previousMetric"),
             "isDone" = COALESCE($10, "isDone"),
             "quarterlyGoals" = COALESCE($11, "quarterlyGoals"),
             "updatedAt" = NOW()
       WHERE id = $12 RETURNING id`,
      [
        values.title,
        values.description,
        values.status,
        values.weight,
        values.dueDate,
        values.metricType,
        values.targetMetric,
        values.currentMetric,
        values.previousMetric,
        values.isDone,
        values.quarterlyGoals,
        existingActivity.id,
      ],
    );
    return { id: updateRes.rows[0].id, action: "updated" };
  }

  const insertRes = await client.query(
    `INSERT INTO "Activities"
       ("taskId", title, description, status, weight, "dueDate", "metricType", "targetMetric", "currentMetric", "previousMetric", "isDone", "quarterlyGoals", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,COALESCE($5::numeric,0),$6,COALESCE($7,'Plus'),$8,$9,$10,$11,$12,NOW(),NOW())
       RETURNING id`,
    [
      values.taskId,
      values.title,
      values.description,
      values.status,
      values.weight,
      values.dueDate,
      values.metricType,
      values.targetMetric,
      values.currentMetric,
      values.previousMetric,
      values.isDone,
      values.quarterlyGoals,
    ],
  );
  const id = insertRes.rows[0].id;
  const titleKey = `${normalizeString(values.title)}|${taskId}`;
  activityLookup.set(titleKey, { id, ...values });
  return { id, action: "created" };
}

async function resolveActivityIdForQuarter(client, row, activityLookup, activitiesRows) {
  if (row.activity_id) return Number(row.activity_id);
  if (row.activity_roll_no) {
    const activity =
      activityLookup.get(`rollno:${row.activity_roll_no}|${Number(row.task_id) || 0}`) ||
      activityLookup.get(`rollno:${row.activity_roll_no}`);
    if (activity) return activity.id;
  }
  const titleKey = `${normalizeString(row.activity_title || row.activity_name)}|${Number(row.task_id) || 0}`;
  const found = activityLookup.get(titleKey);
  if (found) return found.id;

  for (const activityRow of activitiesRows) {
    if (normalizeString(activityRow.activity_title || activityRow.activity_name) === normalizeString(row.activity_title || row.activity_name)) {
      return Number(activityRow.activity_id || activityRow.activityId || null) || null;
    }
  }

  if (row.activity_code) {
    const goalKey = `code:${String(row.activity_code).trim()}`;
    const foundByCode = activityLookup.get(goalKey);
    if (foundByCode) return foundByCode.id;
  }
  return null;
}

async function upsertQuarterlyRecord(client, row, activityId, userId) {
  const quarter = Number(row.quarter);
  const fiscalYear = Number(row.fiscal_year || new Date().getFullYear());
  const metricKey = row.metric_key || (row.sheetName ? `Q${quarter}` : "quarter_update");
  const planned = Number(row.planned);
  const actual = Number(row.actual);
  const remark = row.remark || null;

  if (Number.isFinite(planned)) {
    await client.query(
      `INSERT INTO "ActivityRecords"
         ("activityId", "fiscalYear", quarter, "metricKey", value, source, "createdBy", "updatedBy", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'import',$6,$6,NOW(),NOW())
       ON CONFLICT ("activityId", "fiscalYear", quarter, "metricKey") WHERE "quarter" IS NOT NULL
       DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = NOW()`,
      [activityId, fiscalYear, quarter, `${metricKey}_planned`, planned, userId],
    );
  }

  if (Number.isFinite(actual)) {
    await client.query(
      `INSERT INTO "ActivityRecords"
         ("activityId", "fiscalYear", quarter, "metricKey", value, source, "createdBy", "updatedBy", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'import',$6,$6,NOW(),NOW())
       ON CONFLICT ("activityId", "fiscalYear", quarter, "metricKey") WHERE "quarter" IS NOT NULL
       DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = NOW()`,
      [activityId, fiscalYear, quarter, `${metricKey}_actual`, actual, userId],
    );
  }

  if (remark) {
    await client.query(
      `INSERT INTO "ActivityRecords"
         ("activityId", "fiscalYear", quarter, "metricKey", value, source, "createdBy", "updatedBy", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'import',$6,$6,NOW(),NOW())
       ON CONFLICT ("activityId", "fiscalYear", quarter, "metricKey") WHERE "quarter" IS NOT NULL
       DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = NOW()`,
      [activityId, fiscalYear, quarter, `${metricKey}_remark`, remark, userId],
    );
  }

  return { action: "updated" };
}

async function getImportHistory(req, res) {
  try {
    const { rows } = await db.query(`SELECT * FROM "${IMPORT_HISTORY_TABLE}" ORDER BY "importDate" DESC LIMIT 100`);
    return res.json({ rows });
  } catch (err) {
    console.error("getImportHistory error:", err);
    return res.status(500).json({ error: err.message || "Failed to load import history." });
  }
}

async function getImportHistoryById(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(`SELECT * FROM "${IMPORT_HISTORY_TABLE}" WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: "Import history not found." });
    return res.json(rows[0]);
  } catch (err) {
    console.error("getImportHistoryById error:", err);
    return res.status(500).json({ error: err.message || "Failed to load history record." });
  }
}

async function downloadTemplate(req, res) {
  try {
    const goalsRes = await db.query(
      `SELECT g.id AS goal_id, g."rollNo" AS goal_roll_no, g.title AS goal_title,
              g.description AS goal_description, g.status AS goal_status,
              g.weight AS goal_weight, g."startDate" AS goal_start_date,
              g."endDate" AS goal_end_date, g."groupId" AS goal_group_id,
              gr.name AS goal_group_name
       FROM "Goals" g
       LEFT JOIN "Groups" gr ON g."groupId" = gr.id
       ORDER BY g.id`,
    );

    const tasksRes = await db.query(
      `SELECT t.id AS task_id, t."rollNo" AS task_roll_no, t.title AS task_title,
              t.description AS task_description, t.status AS task_status,
              t.weight AS task_weight, t."dueDate" AS task_due_date,
              t."assigneeId" AS task_assignee_id, t."goalId" AS goal_id
       FROM "Tasks" t
       ORDER BY t.id`,
    );

    const activitiesRes = await db.query(
      `SELECT a.id AS activity_id, a."rollNo" AS activity_roll_no, a.title AS activity_title,
              a.description AS activity_description, a.status AS activity_status,
              a.weight AS activity_weight, a."dueDate" AS activity_due_date,
              a."metricType" AS activity_metric_type, a."targetMetric" AS activity_target_metric,
              a."currentMetric" AS activity_current_metric, a."previousMetric" AS activity_previous_metric,
              a."isDone" AS activity_is_done, a."quarterlyGoals" AS activity_quarterly_goals, a."taskId" AS task_id
       FROM "Activities" a
       ORDER BY a.id`,
    );

    const quartersRes = await db.query(
      `SELECT ar."activityId" AS activity_id, a.title AS activity_title, a."rollNo" AS activity_roll_no,
              ar."fiscalYear" AS fiscal_year, ar.quarter, ar."metricKey" AS metric_key,
              ar.value
       FROM "ActivityRecords" ar
       LEFT JOIN "Activities" a ON a.id = ar."activityId"
       WHERE ar.quarter IS NOT NULL
       ORDER BY ar."activityId", ar.quarter, ar."metricKey"`,
    );

    const activities = activitiesRes.rows.map((row) => ({
      ...row,
      activity_quarterly_goals: safeParseJson(row.activity_quarterly_goals),
    }));

    const activityQuarterlyGoalsRows = [];
    const currentYear = new Date().getFullYear();

    for (const activity of activities) {
      const quarterlyGoals = activity.activity_quarterly_goals || safeParseJson(activity.quarterlyGoals);
      if (quarterlyGoals && typeof quarterlyGoals === "object") {
        for (const [key, value] of Object.entries(quarterlyGoals)) {
          const match = /^q([1-4])$/i.exec(String(key).trim());
          if (!match) continue;
          activityQuarterlyGoalsRows.push({
            activity_id: activity.activity_id || null,
            activity_roll_no: activity.activity_roll_no || null,
            activity_title: activity.activity_title || null,
            planned: value,
            actual: null,
            remark: null,
            metric_key: `Q${match[1]}`,
            fiscal_year: currentYear,
            quarter: Number(match[1]),
          });
        }
      }
    }

    const quarters = quartersRes.rows
      .map((row) => {
        const key = String(row.metric_key || "");
        const match = key.match(/_(planned|actual|remark)$/i);
        const baseKey = match ? key.slice(0, -match[0].length) : key;
        return {
          activity_id: row.activity_id || null,
          activity_roll_no: row.activity_roll_no || null,
          fiscal_year: row.fiscal_year || null,
          quarter: row.quarter || null,
          metric_key: baseKey || null,
          planned: match && match[1].toLowerCase() === "planned" ? row.value : null,
          actual: match && match[1].toLowerCase() === "actual" ? row.value : null,
          remark: match && match[1].toLowerCase() === "remark" ? row.value : null,
        };
      })
      .concat(activityQuarterlyGoalsRows);

    const workbook = buildTemplateWorkbook({
      goals: goalsRes.rows,
      tasks: tasksRes.rows,
      activities,
      quarters,
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="bulk-import-template.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("downloadTemplate error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate template." });
  }
}

async function downloadErrorReport(req, res) {
  try {
    const { errors, format = "csv" } = req.body;
    if (!Array.isArray(errors) || errors.length === 0) {
      return res.status(400).json({ error: "No errors provided to export." });
    }

    if (format === "xlsx") {
      const workbook = buildErrorWorkbook(errors);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="import-errors.xlsx"`);
      await workbook.xlsx.write(res);
      res.end();
    } else {
      const csv = buildErrorCsv(errors);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="import-errors.csv"`);
      res.send(csv);
    }
  } catch (err) {
    console.error("downloadErrorReport error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate error report." });
  }
}

module.exports = {
  uploadImportFile,
  previewImport,
  executeImport,
  getImportHistory,
  getImportHistoryById,
  downloadTemplate,
  downloadErrorReport,
};
