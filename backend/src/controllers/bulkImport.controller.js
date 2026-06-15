const fs = require("fs");
const path = require("path");
const db = require("../db");
const { UPLOAD_DIR } = require("../middleware/uploadMiddleware");
const { parseWorkbook } = require("../helpers/excelParser");
const { validateImportData } = require("../helpers/importValidator");
const { buildImportPreview } = require("../helpers/importPreviewGenerator");
const { buildErrorWorkbook, buildErrorCsv } = require("../helpers/importErrorReporter");
const { buildTemplateWorkbook } = require("../scripts/templateGenerator");
const { buildQuarterlyRecordsMap } = require("../helpers/quarterlyRecords");

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

function parseString(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function parseNumeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseQuarterlyGoalsFromActivityRow(row) {
  const quarterlyGoals = {};
  let hasAny = false;
  for (let q = 1; q <= 4; q += 1) {
    const value = parseNumeric(row[`q${q}_goal`]);
    if (value !== null) {
      quarterlyGoals[`q${q}`] = value;
      hasAny = true;
    }
  }
  return hasAny ? quarterlyGoals : null;
}

function mergeQuarterlyGoals(existingGoals, explicitGoals) {
  const merged = {};
  if (typeof existingGoals === "object" && existingGoals !== null) {
    Object.assign(merged, existingGoals);
  }
  if (typeof explicitGoals === "object" && explicitGoals !== null) {
    for (const [key, value] of Object.entries(explicitGoals)) {
      if (value !== null && value !== undefined) {
        merged[key] = value;
      }
    }
  }
  return Object.keys(merged).length ? merged : null;
}

function parseBoolean(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "t"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "f"].includes(normalized)) return false;
  return null;
}

function normalizeStatus(value) {
  const input = parseString(value);
  if (!input) return null;
  const normalized = input.toLowerCase();
  if (["to do", "todo", "to-do"].includes(normalized)) return "To Do";
  if (["in progress", "inprogress", "in-progress"].includes(normalized)) return "In Progress";
  if (["done", "completed", "complete"].includes(normalized)) return "Done";
  if (["not started", "notstarted", "not-started"].includes(normalized)) return "Not Started";
  if (["on hold", "onhold", "on-hold"].includes(normalized)) return "On Hold";
  return input;
}

function normalizeMetricType(value) {
  const input = parseString(value);
  if (!input) return null;
  const normalized = input.toLowerCase();
  if (["plus", "+"].includes(normalized)) return "Plus";
  if (["minus", "-"].includes(normalized)) return "Minus";
  if (["increase", "inc"].includes(normalized)) return "Increase";
  if (["decrease", "dec"].includes(normalized)) return "Decrease";
  if (["maintain", "stable"].includes(normalized)) return "Maintain";
  return input;
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

async function saveImportHistory(client, { fileName, originalName, uploadedBy, summary, status, errors }) {
  const historyRes = await client.query(
    `INSERT INTO "${IMPORT_HISTORY_TABLE}" (
       "fileName", "originalName", "uploadedBy", "summary", "status", "errors"
       ) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [
      fileName,
      originalName || null,
      uploadedBy || null,
      summary || {},
      status,
      JSON.stringify(errors || []),
    ],
  );
  return historyRes.rows[0].id;
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
    await ensureImportHistoryTable(client);

    const parsed = await parseWorkbook(filePath);
    const validation = validateImportData(parsed);
    if (validation.errors.length) {
      historyId = await saveImportHistory(client, {
        fileName: fileNameToUse,
        originalName: req.body.originalName || uploadedFile?.originalname || null,
        uploadedBy: req.user?.id || null,
        summary: validation.summary || {},
        status: "failed",
        errors: validation.errors,
      });
      return res.status(400).json({
        message: "Validation failed.",
        historyId,
        validation,
      });
    }

    const preview = await buildImportPreview(db, parsed);

    await client.query("BEGIN");

    const importResult = await performImport(client, parsed, req.user?.id);
    importSummary = importResult.summary;
    importErrors = importResult.errors;

    if (importErrors.length) {
      await client.query("ROLLBACK");
      historyId = await saveImportHistory(client, {
        fileName: fileNameToUse,
        originalName: req.body.originalName || uploadedFile?.originalname || null,
        uploadedBy: req.user?.id || null,
        summary: importSummary,
        status: "failed",
        errors: importErrors,
      });
      return res.status(400).json({
        message: "Import failed.",
        historyId,
        summary: importSummary,
        errors: importErrors,
      });
    }

    await client.query("COMMIT");

    historyId = await saveImportHistory(client, {
      fileName: fileNameToUse,
      originalName: req.body.originalName || uploadedFile?.originalname || null,
      uploadedBy: req.user?.id || null,
      summary: importSummary,
      status: "completed",
      errors: importErrors,
    });

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
    try {
      historyId = await saveImportHistory(client, {
        fileName: fileNameToUse,
        originalName: req.body.originalName || uploadedFile?.originalname || null,
        uploadedBy: req.user?.id || null,
        summary: importSummary || {},
        status: "failed",
        errors: [{ message: err.message || "Import failed." }],
      });
    } catch (historyErr) {
      console.error("Failed to save import history after error:", historyErr);
    }
    return res.status(500).json({ error: err.message || "Import failed.", historyId });
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
    const title = String(goal.title).trim().toLowerCase();
    const titleKey = `${title}|${goal.groupId || 0}`;
    map.set(titleKey, goal);
    map.set(title, goal);
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
    const title = String(task.title).trim().toLowerCase();
    const titleKey = `${title}|${task.goalId}`;
    map.set(titleKey, task);
    map.set(title, task);
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
    const title = String(activity.title).trim().toLowerCase();
    const titleKey = `${title}|${activity.taskId}`;
    map.set(titleKey, activity);
    map.set(title, activity);
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

async function resolveGroupId(client, row, groupLookup) {
  if (row.goal_group_id) {
    const group = groupLookup.get(`id:${Number(row.goal_group_id)}`);
    if (group) return group.id;
  }

  if (!row.goal_group_name) return null;

  const normalizedName = normalizeString(row.goal_group_name);
  let group = groupLookup.get(normalizedName);
  if (group) return group.id;

  const insertRes = await client.query(
    `INSERT INTO "Groups" (name, "createdAt", "updatedAt") VALUES ($1, NOW(), NOW()) RETURNING id`,
    [parseString(row.goal_group_name)],
  );
  const id = insertRes.rows[0].id;
  const savedGroup = { id, name: parseString(row.goal_group_name) };
  groupLookup.set(normalizedName, savedGroup);
  groupLookup.set(`id:${id}`, savedGroup);
  return id;
}

async function upsertGoal(client, row, goalLookup, groupLookup) {
  const groupId = await resolveGroupId(client, row, groupLookup);

  let existingGoal = null;
  if (row.goal_id) existingGoal = goalLookup.get(`id:${Number(row.goal_id)}`);
  if (!existingGoal) {
    const titleKey = `${normalizeString(row.goal_title)}|${groupId || 0}`;
    existingGoal = goalLookup.get(titleKey);
  }

  const values = {
    rollNo: parseNumeric(row.goal_roll_no),
    title: parseString(row.goal_title || row.goal_name || row.title || row.name),
    description: parseString(row.goal_description || row.description),
    status: normalizeStatus(row.goal_status),
    weight: parseNumeric(row.goal_weight),
    startDate: row.goal_start_date || null,
    endDate: row.goal_end_date || null,
    groupId,
  };

  if (existingGoal) {
    const updateRes = await client.query(
      `UPDATE "Goals"
        SET "rollNo" = COALESCE($1, "rollNo"),
            title = COALESCE($2, title),
            description = COALESCE($3, description),
            status = COALESCE($4::goal_status, status),
            weight = COALESCE($5::numeric, weight),
            "startDate" = COALESCE($6, "startDate"),
            "endDate" = COALESCE($7, "endDate"),
            "groupId" = COALESCE($8, "groupId"),
            "updatedAt" = NOW()
       WHERE id = $9 RETURNING id, "rollNo", title, "groupId"`,
      [
        values.rollNo,
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
    const updatedGoal = {
      id: updateRes.rows[0].id,
      rollNo: updateRes.rows[0].rollNo,
      title: updateRes.rows[0].title,
      groupId: updateRes.rows[0].groupId,
    };
    const title = normalizeString(updatedGoal.title);
    goalLookup.set(`id:${updatedGoal.id}`, updatedGoal);
    if (updatedGoal.rollNo) goalLookup.set(`rollno:${updatedGoal.rollNo}`, updatedGoal);
    goalLookup.set(`${title}|${updatedGoal.groupId || 0}`, updatedGoal);
    goalLookup.set(title, updatedGoal);
    return { id: updatedGoal.id, action: "updated" };
  }

  const insertRes = await client.query(
    `INSERT INTO "Goals"
       ("rollNo", title, description, "groupId", status, weight, "startDate", "endDate", "createdAt", "updatedAt")
       VALUES (COALESCE($1, nextval('goals_rollno_seq')),$2,$3,$4,$5,COALESCE($6::numeric,100),$7,$8,NOW(),NOW())
       RETURNING id`,
    [
      values.rollNo,
      values.title,
      values.description,
      values.groupId,
      values.status || "Not Started",
      values.weight,
      values.startDate,
      values.endDate,
    ],
  );
  const rowGoal = {
    id: insertRes.rows[0].id,
    rollNo: values.rollNo,
    title: values.title,
    groupId,
  };
  const title = normalizeString(values.title);
  goalLookup.set(`id:${rowGoal.id}`, rowGoal);
  if (rowGoal.rollNo) goalLookup.set(`rollno:${rowGoal.rollNo}`, rowGoal);
  goalLookup.set(`${title}|${groupId || 0}`, rowGoal);
  goalLookup.set(title, rowGoal);
  return { id: rowGoal.id, action: "created" };
}

async function resolveGoalIdForTask(client, row, goalLookup, groupLookup, goalIdByRow, goalsRows) {
  if (row.goal_id) {
    const explicitGoal = goalLookup.get(`id:${Number(row.goal_id)}`);
    if (explicitGoal) return explicitGoal.id;
  }

  if (row.goal_roll_no) {
    const goal = goalLookup.get(`rollno:${row.goal_roll_no}`);
    if (goal) return goal.id;
  }

  let groupId = null;
  if (row.goal_group_id) {
    const group = groupLookup.get(`id:${Number(row.goal_group_id)}`);
    if (group) groupId = group.id;
  }
  if (groupId === null && row.goal_group_name) {
    const group = groupLookup.get(normalizeString(row.goal_group_name));
    groupId = group?.id || null;
  }

  const titleKey = `${normalizeString(row.goal_title || row.goal_name)}|${groupId || 0}`;
  const goal = goalLookup.get(titleKey);
  if (goal) return goal.id;

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
  if (!existingTask && row.task_roll_no) {
    existingTask =
      taskLookup.get(`rollno:${row.task_roll_no}|${goalId}`) ||
      taskLookup.get(`rollno:${row.task_roll_no}`);
  }
  if (!existingTask) {
    const titleKey = `${normalizeString(row.task_title || row.task_name)}|${goalId}`;
    existingTask = taskLookup.get(titleKey);
  }

  const values = {
    rollNo: parseNumeric(row.task_roll_no),
    title: parseString(row.task_title || row.task_name || row.title || row.name),
    description: parseString(row.task_description || row.description),
    status: normalizeStatus(row.task_status),
    weight: parseNumeric(row.task_weight),
    dueDate: row.task_due_date || null,
    assigneeId: row.task_assignee_id || null,
    goalId,
  };

  if (existingTask) {
    const updateRes = await client.query(
      `UPDATE "Tasks"
         SET "rollNo" = COALESCE($1, "rollNo"),
             title = COALESCE($2, title),
             description = COALESCE($3, description),
             status = COALESCE($4::task_status, status),
             weight = COALESCE($5::numeric, weight),
             "dueDate" = COALESCE($6, "dueDate"),
             "assigneeId" = COALESCE($7, "assigneeId"),
             "updatedAt" = NOW()
       WHERE id = $8 RETURNING id`,
      [
        values.rollNo,
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

  let insertRes;
  try {
    insertRes = await client.query(
      `INSERT INTO "Tasks"
         ("goalId", "rollNo", title, description, status, weight, "dueDate", "assigneeId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3,$4,$5,COALESCE($6::numeric,0),$7,$8,NOW(),NOW())
         RETURNING id`,
      [
        values.goalId,
        values.rollNo,
        values.title,
        values.description,
        values.status || "To Do",
        values.weight,
        values.dueDate,
        values.assigneeId,
      ],
    );
  } catch (err) {
    if (err.code === "23505" && err.constraint === "ux_tasks_goal_roll" && values.rollNo) {
      const existing = await client.query(
        `SELECT id FROM "Tasks" WHERE "goalId" = $1 AND "rollNo" = $2 LIMIT 1`,
        [values.goalId, values.rollNo],
      );
      if (existing.rows.length) {
        const updateRes = await client.query(
          `UPDATE "Tasks"
             SET title = COALESCE($1, title),
                 description = COALESCE($2, description),
                 status = COALESCE($3::task_status, status),
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
            existing.rows[0].id,
          ],
        );
        const updatedId = updateRes.rows[0].id;
        const rowTask = {
          id: updatedId,
          rollNo: values.rollNo,
          title: values.title,
          goalId,
        };
        const title = normalizeString(values.title);
        taskLookup.set(`id:${rowTask.id}`, rowTask);
        taskLookup.set(`${title}|${goalId}`, rowTask);
        taskLookup.set(title, rowTask);
        if (rowTask.rollNo) taskLookup.set(`rollno:${rowTask.rollNo}|${goalId}`, rowTask);
        if (rowTask.rollNo) taskLookup.set(`rollno:${rowTask.rollNo}`, rowTask);
        return { id: rowTask.id, action: "updated" };
      }
    }
    throw err;
  }

  const rowTask = {
    id: insertRes.rows[0].id,
    rollNo: values.rollNo,
    title: values.title,
    goalId,
  };
  const title = normalizeString(values.title);
  taskLookup.set(`id:${rowTask.id}`, rowTask);
  taskLookup.set(`${title}|${goalId}`, rowTask);
  taskLookup.set(title, rowTask);
  if (rowTask.rollNo) taskLookup.set(`rollno:${rowTask.rollNo}|${goalId}`, rowTask);
  if (rowTask.rollNo) taskLookup.set(`rollno:${rowTask.rollNo}`, rowTask);
  return { id: rowTask.id, action: "created" };
}

async function resolveTaskIdForActivity(client, row, taskLookup, tasksRows) {
  if (row.task_id) {
    const explicitTask = taskLookup.get(`id:${Number(row.task_id)}`);
    if (explicitTask) return explicitTask.id;
  }

  if (row.task_roll_no) {
    const task =
      taskLookup.get(`rollno:${row.task_roll_no}|${Number(row.goal_id) || 0}`) ||
      taskLookup.get(`rollno:${row.task_roll_no}`);
    if (task) return task.id;
  }

  const titleKey = `${normalizeString(row.task_title || row.task_name)}|${Number(row.goal_id) || 0}`;
  let task = taskLookup.get(titleKey);
  if (task) return task.id;

  if (row.task_title || row.task_name) {
    task = taskLookup.get(normalizeString(row.task_title || row.task_name));
    if (task) return task.id;
  }

  for (const taskRow of tasksRows) {
    if (normalizeString(taskRow.task_title || taskRow.task_name) === normalizeString(row.task_title || row.task_name)) {
      const explicitId = Number(taskRow.task_id || taskRow.taskId || null);
      if (explicitId && taskLookup.get(`id:${explicitId}`)) return explicitId;
    }
  }

  throw new Error("Unable to resolve parent Task for Activity.");
}

async function upsertActivity(client, row, taskId, activityLookup) {
  let existingActivity = null;
  if (row.activity_id) existingActivity = activityLookup.get(`id:${Number(row.activity_id)}`);
  if (!existingActivity && row.activity_roll_no) {
    existingActivity =
      activityLookup.get(`rollno:${row.activity_roll_no}|${taskId}`) ||
      activityLookup.get(`rollno:${row.activity_roll_no}`);
  }
  if (!existingActivity) {
    const titleKey = `${normalizeString(row.activity_title || row.activity_name)}|${taskId}`;
    existingActivity = activityLookup.get(titleKey);
  }

  const parsedStatus = normalizeStatus(row.activity_status);
  const explicitIsDone = parseBoolean(row.activity_is_done);
  const values = {
    rollNo: parseNumeric(row.activity_roll_no),
    title: parseString(row.activity_title || row.activity_name || row.title || row.name),
    description: parseString(
      row.activity_description || row.activity_desc || row.description || row.desc,
    ),
    status: parsedStatus,
    weight: parseNumeric(row.activity_weight),
    dueDate: row.activity_due_date || null,
    metricType: normalizeMetricType(
      row.activity_metric_type || row.metric_type || row.metricType,
    ),
    targetMetric:
      row.activity_target_metric || row.target_metric || row.current_metric || row.currentMetric || null,
    currentMetric:
      row.activity_current_metric || row.current_metric || row.currentMetric || null,
    previousMetric:
      row.activity_previous_metric || row.previous_metric || row.previousMetric || null,
    quarterlyGoals: mergeQuarterlyGoals(
      safeParseJson(
        row.activity_quarterly_goals ||
          row.activity_quarterlyGoals ||
          row.quarterly_goals ||
          row.quarterlyGoals ||
          null,
      ),
      parseQuarterlyGoalsFromActivityRow(row),
    ),
    isDone:
      explicitIsDone !== null
        ? explicitIsDone
        : parsedStatus === "Done"
        ? true
        : null,
    taskId,
  };

  if (existingActivity) {
    const updateRes = await client.query(
      `UPDATE "Activities"
         SET "rollNo" = COALESCE($1, "rollNo"),
             title = COALESCE($2::text, title),
             description = COALESCE($3::text, description),
             status = COALESCE($4::activity_status, status),
             weight = COALESCE($5::numeric, weight),
             "dueDate" = COALESCE($6::date, "dueDate"),
             "metricType" = COALESCE($7::metric_type, "metricType"),
             "targetMetric" = COALESCE($8::jsonb, "targetMetric"),
             "currentMetric" = COALESCE($9::jsonb, "currentMetric"),
             "previousMetric" = COALESCE($10::jsonb, "previousMetric"),
             "isDone" = COALESCE($11::boolean, "isDone"),
             "quarterlyGoals" = COALESCE($12::jsonb, "quarterlyGoals"),
             "updatedAt" = NOW()
       WHERE id = $13 RETURNING id, "rollNo", title, "taskId"`,
      [
        values.rollNo,
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
    const updatedActivity = {
      id: updateRes.rows[0].id,
      rollNo: updateRes.rows[0].rollNo,
      title: updateRes.rows[0].title,
      taskId,
    };
    const title = normalizeString(updatedActivity.title);
    activityLookup.set(`id:${updatedActivity.id}`, updatedActivity);
    activityLookup.set(`${title}|${taskId}`, updatedActivity);
    activityLookup.set(title, updatedActivity);
    if (updatedActivity.rollNo) activityLookup.set(`rollno:${updatedActivity.rollNo}|${taskId}`, updatedActivity);
    if (updatedActivity.rollNo) activityLookup.set(`rollno:${updatedActivity.rollNo}`, updatedActivity);
    return { id: updatedActivity.id, action: "updated" };
  }

  let insertRes;
  try {
    insertRes = await client.query(
      `INSERT INTO "Activities"
         ("taskId", "rollNo", title, description, status, weight, "dueDate", "metricType", "targetMetric", "currentMetric", "previousMetric", "isDone", "quarterlyGoals", "createdAt", "updatedAt")
         VALUES ($1,$2,$3::text,$4::text,$5::activity_status,COALESCE($6::numeric,0),$7::date,COALESCE($8::metric_type,'Plus'),$9::jsonb,$10::jsonb,$11::jsonb,$12::boolean,$13::jsonb,NOW(),NOW())
         RETURNING id`,
      [
        values.taskId,
        values.rollNo,
        values.title,
        values.description,
        values.status || "To Do",
        values.weight,
        values.dueDate,
        values.metricType || "Plus",
        values.targetMetric,
        values.currentMetric,
        values.previousMetric,
        values.isDone || false,
        values.quarterlyGoals,
      ],
    );
  } catch (err) {
    if (err.code === "23505" && err.constraint === "ux_activities_task_roll" && values.rollNo) {
      const existing = await client.query(
        `SELECT id FROM "Activities" WHERE "taskId" = $1 AND "rollNo" = $2 LIMIT 1`,
        [values.taskId, values.rollNo],
      );
      if (existing.rows.length) {
        const updateRes = await client.query(
          `UPDATE "Activities"
             SET title = COALESCE($1::text, title),
                 description = COALESCE($2::text, description),
                 status = COALESCE($3::activity_status, status),
                 weight = COALESCE($4::numeric, weight),
                 "dueDate" = COALESCE($5::date, "dueDate"),
                 "metricType" = COALESCE($6::metric_type, "metricType"),
                 "targetMetric" = COALESCE($7::jsonb, "targetMetric"),
                 "currentMetric" = COALESCE($8::jsonb, "currentMetric"),
                 "previousMetric" = COALESCE($9::jsonb, "previousMetric"),
                 "isDone" = COALESCE($10::boolean, "isDone"),
                 "quarterlyGoals" = COALESCE($11::jsonb, "quarterlyGoals"),
                 "updatedAt" = NOW()
           WHERE id = $12 RETURNING id, "rollNo", title, "taskId"`,
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
            existing.rows[0].id,
          ],
        );
        const updatedActivity = {
          id: updateRes.rows[0].id,
          rollNo: updateRes.rows[0].rollNo,
          title: updateRes.rows[0].title,
          taskId,
        };
        const title = normalizeString(updatedActivity.title);
        activityLookup.set(`id:${updatedActivity.id}`, updatedActivity);
        activityLookup.set(`${title}|${taskId}`, updatedActivity);
        activityLookup.set(title, updatedActivity);
        if (updatedActivity.rollNo) activityLookup.set(`rollno:${updatedActivity.rollNo}|${taskId}`, updatedActivity);
        if (updatedActivity.rollNo) activityLookup.set(`rollno:${updatedActivity.rollNo}`, updatedActivity);
        return { id: updatedActivity.id, action: "updated" };
      }
    }
    throw err;
  }

  const id = insertRes.rows[0].id;
  const title = normalizeString(values.title);
  const titleKey = `${title}|${taskId}`;
  const activityRecord = { id, ...values, taskId };
  activityLookup.set(`id:${id}`, activityRecord);
  activityLookup.set(titleKey, activityRecord);
  activityLookup.set(title, activityRecord);
  if (values.rollNo) activityLookup.set(`rollno:${values.rollNo}|${taskId}`, activityRecord);
  if (values.rollNo) activityLookup.set(`rollno:${values.rollNo}`, activityRecord);
  return { id, action: "created" };
}

async function resolveActivityIdForQuarter(client, row, activityLookup, activitiesRows) {
  if (row.activity_id) {
    const explicitActivity = activityLookup.get(`id:${Number(row.activity_id)}`);
    if (explicitActivity) return explicitActivity.id;
  }

  if (row.activity_roll_no) {
    const activity =
      activityLookup.get(`rollno:${row.activity_roll_no}|${Number(row.task_id) || 0}`) ||
      activityLookup.get(`rollno:${row.activity_roll_no}`);
    if (activity) return activity.id;
  }

  const titleKey = `${normalizeString(row.activity_title || row.activity_name)}|${Number(row.task_id) || 0}`;
  let found = activityLookup.get(titleKey);
  if (found) return found.id;

  if (row.activity_title || row.activity_name) {
    found = activityLookup.get(normalizeString(row.activity_title || row.activity_name));
    if (found) return found.id;
  }

  for (const activityRow of activitiesRows) {
    if (normalizeString(activityRow.activity_title || activityRow.activity_name) === normalizeString(row.activity_title || row.activity_name)) {
      const explicitId = Number(activityRow.activity_id || activityRow.activityId || null);
      if (explicitId && activityLookup.get(`id:${explicitId}`)) return explicitId;
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
      [activityId, fiscalYear, quarter, metricKey, actual, userId],
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
              t."assigneeId" AS task_assignee_id, t."goalId" AS goal_id,
              g.title AS goal_title, gr.name AS goal_group_name
       FROM "Tasks" t
       LEFT JOIN "Goals" g ON t."goalId" = g.id
       LEFT JOIN "Groups" gr ON g."groupId" = gr.id
       ORDER BY t.id`,
    );

    const activitiesRes = await db.query(
      `SELECT a.id AS activity_id, a."rollNo" AS activity_roll_no, a.title AS activity_title,
              a.description AS activity_description, a.status AS activity_status,
              a.weight AS activity_weight, a."dueDate" AS activity_due_date,
              a."metricType" AS activity_metric_type, a."targetMetric" AS activity_target_metric,
              a."currentMetric" AS activity_current_metric, a."previousMetric" AS activity_previous_metric,
              a."isDone" AS activity_is_done, a."quarterlyGoals" AS activity_quarterly_goals,
              a."taskId" AS task_id, t.title AS task_title, t."rollNo" AS task_roll_no,
              g.id AS goal_id, g.title AS goal_title, gr.name AS goal_group_name
       FROM "Activities" a
       LEFT JOIN "Tasks" t ON a."taskId" = t.id
       LEFT JOIN "Goals" g ON t."goalId" = g.id
       LEFT JOIN "Groups" gr ON g."groupId" = gr.id
       ORDER BY a.id`,
    );

    const fiscalRes = await db.query(`SELECT * FROM calc_fiscal_period(CURRENT_DATE)`);
    const currentFiscalYear = fiscalRes.rows[0]?.fiscal_year || new Date().getFullYear();
    const quartersRes = await db.query(
      `SELECT ar."activityId" AS activity_id, a.title AS activity_title, a."rollNo" AS activity_roll_no,
              ar."fiscalYear" AS fiscal_year, ar.quarter, ar."metricKey" AS metric_key,
              ar.value
       FROM "ActivityRecords" ar
       LEFT JOIN "Activities" a ON a.id = ar."activityId"
       WHERE ar.quarter IS NOT NULL AND ar."fiscalYear" = $1
       ORDER BY ar."activityId", ar.quarter, ar."metricKey"`,
      [currentFiscalYear],
    );

    const activities = activitiesRes.rows.map((row) => ({
      ...row,
      targetMetric: row.activity_target_metric || row.target_metric || null,
      currentMetric: row.activity_current_metric || row.current_metric || null,
      previousMetric: row.activity_previous_metric || row.previous_metric || null,
      quarterlyGoals: row.activity_quarterly_goals || null,
      activity_quarterly_goals: safeParseJson(row.activity_quarterly_goals),
    }));

    const quarterlyMap = buildQuarterlyRecordsMap(activities, quartersRes.rows, null);

    const activityQuarterlyGoalsRows = [];
    for (const activity of activities) {
      const quarterlyGoals = activity.activity_quarterly_goals || safeParseJson(activity.quarterlyGoals);
      for (let quarter = 1; quarter <= 4; quarter += 1) {
        const planned = quarterlyGoals && typeof quarterlyGoals === "object" ? quarterlyGoals[`q${quarter}`] : null;
        const actual = quarterlyMap[activity.activity_id]?.[`q${quarter}`] ?? null;

        activityQuarterlyGoalsRows.push({
          activity_id: activity.activity_id || null,
          activity_roll_no: activity.activity_roll_no || null,
          activity_title: activity.activity_title || null,
          fiscal_year: currentFiscalYear,
          quarter,
          metric_key: `quarterlyGoals`,
          planned: planned !== undefined ? planned : null,
          actual,
          remark: null,
        });
      }
    }

    const quarters = activityQuarterlyGoalsRows;

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
