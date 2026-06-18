const fs = require("fs");
const path = require("path");
const db = require("../db");
const { UPLOAD_DIR } = require("../middleware/uploadMiddleware");
const {
  parseWorkbook,
  getMetricKeyFromActivityRow,
  EXPLICIT_EMPTY,
} = require("../helpers/excelParser");
const { validateImportData } = require("../helpers/importValidator");
const { buildImportPreview } = require("../helpers/importPreviewGenerator");
const {
  buildErrorWorkbook,
  buildErrorCsv,
} = require("../helpers/importErrorReporter");
const { buildTemplateWorkbook } = require("../scripts/templateGenerator");
const {
  buildQuarterlyRecordsMap,
  getPrimaryMetricKey,
} = require("../helpers/quarterlyRecords");

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

// Helper: Parse string value, distinguishing between "not provided" and "explicitly empty"
// Returns: { value: string|null, isExplicitEmpty: boolean }
function parseStringWithEmptyMarker(value) {
  if (value === EXPLICIT_EMPTY) {
    return { value: null, isExplicitEmpty: true };
  }
  if (value === null || value === undefined) {
    return { value: null, isExplicitEmpty: false };
  }
  const text = String(value).trim();
  return text === ""
    ? { value: null, isExplicitEmpty: false }
    : { value: text, isExplicitEmpty: false };
}

function parseString(value) {
  const parsed = parseStringWithEmptyMarker(value);
  return parsed.value;
}

function parseNumeric(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value === EXPLICIT_EMPTY) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseQuarterlyGoalsFromActivityRow(row) {
  const quarterlyGoals = {};
  let hasAny = false;
  for (let q = 1; q <= 4; q += 1) {
    const value = parseNumeric(row[`q${q}_goal`] ?? row[`activity_q${q}_goal`]);
    if (value !== null) {
      quarterlyGoals[`q${q}`] = value;
      hasAny = true;
    }
  }
  return hasAny ? quarterlyGoals : null;
}

function parseQuarterlyRecordsFromActivityRow(row) {
  const quarterlyRecords = {};
  let hasAny = false;
  for (let q = 1; q <= 4; q += 1) {
    const rawValue =
      row[`q${q}_record`] ??
      row[`q${q}_actual`] ??
      row[`activity_q${q}_record`] ??
      row[`activity_q${q}_actual`];
    if (
      rawValue === null ||
      rawValue === undefined ||
      String(rawValue).trim() === ""
    ) {
      console.log(
        `[DEBUG parseQuarterlyRecordsFromActivityRow] q${q}: no value (null/undefined/empty)`,
      );
      continue;
    }
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      console.log(
        `[DEBUG parseQuarterlyRecordsFromActivityRow] q${q}: invalid number - rawValue=${rawValue}, Number(rawValue)=${value}`,
      );
      continue;
    }
    quarterlyRecords[`q${q}`] = value;
    console.log(
      `[DEBUG parseQuarterlyRecordsFromActivityRow] q${q}: found value=${value}`,
    );
    hasAny = true;
  }
  const result = hasAny ? quarterlyRecords : null;
  console.log(
    "[DEBUG parseQuarterlyRecordsFromActivityRow] final result:",
    result,
  );
  return result;
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
  if (["in progress", "inprogress", "in-progress"].includes(normalized))
    return "In Progress";
  if (["done", "completed", "complete"].includes(normalized)) return "Done";
  if (["not started", "notstarted", "not-started"].includes(normalized))
    return "Not Started";
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
    if (
      req.files.file &&
      Array.isArray(req.files.file) &&
      req.files.file.length > 0
    )
      return req.files.file[0];
    const firstKey = Object.keys(req.files)[0];
    if (
      firstKey &&
      Array.isArray(req.files[firstKey]) &&
      req.files[firstKey].length > 0
    )
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
    return res
      .status(500)
      .json({ error: err.message || "Failed to preview import." });
  }
}

async function saveImportHistory(
  client,
  { fileName, originalName, uploadedBy, summary, status, errors },
) {
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
  const requestedFileName = req.body.fileName
    ? path.basename(req.body.fileName)
    : null;
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
        originalName:
          req.body.originalName || uploadedFile?.originalname || null,
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
        originalName:
          req.body.originalName || uploadedFile?.originalname || null,
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
        originalName:
          req.body.originalName || uploadedFile?.originalname || null,
        uploadedBy: req.user?.id || null,
        summary: importSummary || {},
        status: "failed",
        errors: [{ message: err.message || "Import failed." }],
      });
    } catch (historyErr) {
      console.error("Failed to save import history after error:", historyErr);
    }
    return res
      .status(500)
      .json({ error: err.message || "Import failed.", historyId });
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
      const { id, action } = await upsertGoal(
        client,
        row,
        goalLookup,
        groupLookup,
      );
      goalIdByRow.set(index, id);
      if (action === "created") results.goals_created += 1;
      else if (action === "updated") results.goals_updated += 1;
    } catch (err) {
      results.errors.push({
        row: index + 2,
        type: "goal",
        message: err.message,
      });
    }
  }

  for (let index = 0; index < parsed.tasks.length; index += 1) {
    const row = parsed.tasks[index];
    try {
      const goalId = await resolveGoalIdForTask(
        client,
        row,
        goalLookup,
        groupLookup,
        goalIdByRow,
        parsed.goals,
      );
      const { id, action } = await upsertTask(client, row, goalId, taskLookup);
      taskIdByRow.set(index, id);
      if (action === "created") results.tasks_created += 1;
      else if (action === "updated") results.tasks_updated += 1;
    } catch (err) {
      results.errors.push({
        row: index + 2,
        type: "task",
        message: err.message,
      });
    }
  }

  for (let index = 0; index < parsed.activities.length; index += 1) {
    const row = parsed.activities[index];
    try {
      const taskId = await resolveTaskIdForActivity(
        client,
        row,
        taskLookup,
        parsed.tasks,
      );
      const { action } = await upsertActivity(
        client,
        row,
        taskId,
        activityLookup,
        userId,
      );
      if (action === "created") results.activities_created += 1;
      else if (action === "updated") results.activities_updated += 1;
    } catch (err) {
      results.errors.push({
        row: index + 2,
        type: "activity",
        message: err.message,
      });
    }
  }

  for (const quarterRow of parsed.quarters) {
    try {
      const activityId = await resolveActivityIdForQuarter(
        client,
        quarterRow,
        activityLookup,
        parsed.activities,
      );
      if (!activityId) {
        results.errors.push({
          row: quarterRow.rowNumber,
          type: "quarter",
          message: "Activity could not be resolved.",
        });
        continue;
      }
      const { action } = await upsertQuarterlyRecord(
        client,
        quarterRow,
        activityId,
        userId,
      );
      if (action === "created") results.quarterly_records_created += 1;
      else if (action === "updated") results.quarterly_records_updated += 1;
    } catch (err) {
      results.errors.push({
        row: quarterRow.rowNumber,
        type: "quarter",
        message: err.message,
      });
    }
  }

  return { summary: results, errors: results.errors };
}

async function loadExistingGoals(client) {
  const { rows } = await client.query(
    `SELECT id, title, "groupId", "rollNo" FROM "Goals"`,
  );
  return rows;
}

async function loadExistingTasks(client) {
  const { rows } = await client.query(
    `SELECT id, title, "goalId", "rollNo" FROM "Tasks"`,
  );
  return rows;
}

async function loadExistingActivities(client) {
  const { rows } = await client.query(
    `SELECT id, title, "taskId", "rollNo" FROM "Activities"`,
  );
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
    title: parseString(
      row.goal_title || row.goal_name || row.title || row.name,
    ),
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
    if (updatedGoal.rollNo)
      goalLookup.set(`rollno:${updatedGoal.rollNo}`, updatedGoal);
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

async function resolveGoalIdForTask(
  client,
  row,
  goalLookup,
  groupLookup,
  goalIdByRow,
  goalsRows,
) {
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
    if (
      normalizeString(uploaded.goal_title || uploaded.goal_name) ===
      normalizeString(row.goal_title || row.goal_name)
    ) {
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
    title: parseString(
      row.task_title || row.task_name || row.title || row.name,
    ),
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
    if (
      err.code === "23505" &&
      err.constraint === "ux_tasks_goal_roll" &&
      values.rollNo
    ) {
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
        if (rowTask.rollNo)
          taskLookup.set(`rollno:${rowTask.rollNo}|${goalId}`, rowTask);
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
  if (rowTask.rollNo)
    taskLookup.set(`rollno:${rowTask.rollNo}|${goalId}`, rowTask);
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
      taskLookup.get(
        `rollno:${row.task_roll_no}|${Number(row.goal_id) || 0}`,
      ) || taskLookup.get(`rollno:${row.task_roll_no}`);
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
    if (
      normalizeString(taskRow.task_title || taskRow.task_name) ===
      normalizeString(row.task_title || row.task_name)
    ) {
      const explicitId = Number(taskRow.task_id || taskRow.taskId || null);
      if (explicitId && taskLookup.get(`id:${explicitId}`)) return explicitId;
    }
  }

  throw new Error("Unable to resolve parent Task for Activity.");
}

async function upsertActivity(client, row, taskId, activityLookup, userId) {
  let existingActivity = null;
  if (row.activity_id)
    existingActivity = activityLookup.get(`id:${Number(row.activity_id)}`);
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

  // Parse title and description with empty-cell detection
  const titleParsed = parseStringWithEmptyMarker(
    row.activity_title || row.activity_name || row.title || row.name,
  );
  const descParsed = parseStringWithEmptyMarker(
    row.activity_description ||
      row.activity_desc ||
      row.description ||
      row.desc,
  );

  const values = {
    rollNo: parseNumeric(row.activity_roll_no),
    title: titleParsed.value,
    titleIsExplicitEmpty: titleParsed.isExplicitEmpty,
    description: descParsed.value,
    descriptionIsExplicitEmpty: descParsed.isExplicitEmpty,
    status: parsedStatus,
    weight: parseNumeric(row.activity_weight),
    dueDate: row.activity_due_date || null,
    metricType: normalizeMetricType(
      row.activity_metric_type || row.metric_type || row.metricType,
    ),
    targetMetric:
      row.activity_target_metric ||
      row.target_metric ||
      row.current_metric ||
      row.currentMetric ||
      null,
    currentMetric:
      row.activity_current_metric ||
      row.current_metric ||
      row.currentMetric ||
      null,
    previousMetric:
      row.activity_previous_metric ||
      row.previous_metric ||
      row.previousMetric ||
      null,
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
    quarterlyRecords: parseQuarterlyRecordsFromActivityRow(row),
    isDone:
      explicitIsDone !== null
        ? explicitIsDone
        : parsedStatus === "Done"
          ? true
          : null,
    taskId,
  };

  console.log(
    "[DEBUG upsertActivity] Incoming row:",
    JSON.stringify({
      activity_id: row.activity_id,
      activity_title: row.activity_title,
      activity_description: row.activity_description,
      activity_target_metric: row.activity_target_metric,
      q1_record: row.q1_record,
      q2_record: row.q2_record,
      q3_record: row.q3_record,
      q4_record: row.q4_record,
    }),
  );
  console.log(
    "[DEBUG upsertActivity] Parsed values.title:",
    values.title,
    "| titleIsExplicitEmpty:",
    values.titleIsExplicitEmpty,
  );
  console.log(
    "[DEBUG upsertActivity] Parsed values.description:",
    values.description,
    "| descIsExplicitEmpty:",
    values.descriptionIsExplicitEmpty,
  );
  console.log(
    "[DEBUG upsertActivity] Parsed values.quarterlyRecords:",
    values.quarterlyRecords,
  );
  console.log("[DEBUG upsertActivity] Parsed values.isDone:", values.isDone);
  console.log(
    "[DEBUG upsertActivity] Existing activity:",
    existingActivity
      ? {
          id: existingActivity.id,
          title: existingActivity.title,
          isDone: existingActivity.isDone,
        }
      : "none (will create)",
  );

  if (existingActivity) {
    console.log(
      "[DEBUG upsertActivity] UPDATE: activity_id =",
      existingActivity.id,
      "| title param =",
      values.title,
      "| titleIsExplicitEmpty:",
      values.titleIsExplicitEmpty,
      "| desc param =",
      values.description,
      "| descIsExplicitEmpty:",
      values.descriptionIsExplicitEmpty,
    );

    // Detect if isDone is changing
    const isDoneChanged =
      values.isDone !== null && values.isDone !== existingActivity.isDone;
    console.log(
      "[DEBUG upsertActivity] isDone changed?",
      isDoneChanged,
      "(existing:",
      existingActivity.isDone,
      ", new:",
      values.isDone,
      ")",
    );

    const updateRes = await client.query(
      `UPDATE "Activities"
         SET "rollNo" = COALESCE($1, "rollNo"),
             title = CASE WHEN $14::boolean THEN $2::text ELSE COALESCE($2::text, title) END,
             description = CASE WHEN $15::boolean THEN $3::text ELSE COALESCE($3::text, description) END,
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
       WHERE id = $13 RETURNING *`,
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
        values.titleIsExplicitEmpty,
        values.descriptionIsExplicitEmpty,
      ],
    );
    const updatedActivity = updateRes.rows[0];
    console.log(
      "[DEBUG upsertActivity] UPDATE result: title returned =",
      updatedActivity.title,
      "| isDone returned =",
      updatedActivity.isDone,
    );

    const activityId = updatedActivity.id;

    // Apply quarterly records and recalculate progress
    if (values.quarterlyRecords) {
      console.log(
        "[DEBUG upsertActivity] Calling applyActivityQuarterlyRecords with:",
        values.quarterlyRecords,
      );
      await applyActivityQuarterlyRecords(
        client,
        activityId,
        values.quarterlyRecords,
        userId,
      );
    }

    // Trigger progress cascade if isDone changed
    if (isDoneChanged) {
      console.log(
        "[DEBUG upsertActivity] isDone changed, triggering accumulate_metrics",
      );
      const metricForProgress = updatedActivity.currentMetric || {};
      await client.query(
        `SELECT accumulate_metrics($1::int, $2::jsonb, $3::int, NULL)`,
        [activityId, metricForProgress, userId],
      );
    }

    // Always refresh task and goal progress after activity update
    if (updatedActivity.taskId) {
      console.log(
        "[DEBUG upsertActivity] Calling refreshTaskAndGoalProgress for taskId:",
        updatedActivity.taskId,
      );
      await refreshTaskAndGoalProgress(client, updatedActivity.taskId);
    }

    const title = normalizeString(updatedActivity.title);
    const resultActivity = {
      id: updatedActivity.id,
      rollNo: updatedActivity.rollNo,
      title: updatedActivity.title,
      taskId,
    };
    activityLookup.set(`id:${resultActivity.id}`, resultActivity);
    activityLookup.set(`${title}|${taskId}`, resultActivity);
    activityLookup.set(title, resultActivity);
    if (resultActivity.rollNo)
      activityLookup.set(
        `rollno:${resultActivity.rollNo}|${taskId}`,
        resultActivity,
      );
    if (resultActivity.rollNo)
      activityLookup.set(`rollno:${resultActivity.rollNo}`, resultActivity);
    return { id: resultActivity.id, action: "updated" };
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
    if (
      err.code === "23505" &&
      err.constraint === "ux_activities_task_roll" &&
      values.rollNo
    ) {
      const existing = await client.query(
        `SELECT id FROM "Activities" WHERE "taskId" = $1 AND "rollNo" = $2 LIMIT 1`,
        [values.taskId, values.rollNo],
      );
      if (existing.rows.length) {
        // Detect if isDone is changing
        const existingActivityRes = await client.query(
          `SELECT "isDone" FROM "Activities" WHERE id = $1`,
          [existing.rows[0].id],
        );
        const existingIsDone = existingActivityRes.rows[0]?.isDone || false;
        const isDoneChanged =
          values.isDone !== null && values.isDone !== existingIsDone;
        console.log(
          "[DEBUG upsertActivity-duplicate] isDone changed?",
          isDoneChanged,
          "(existing:",
          existingIsDone,
          ", new:",
          values.isDone,
          ")",
        );

        const updateRes = await client.query(
          `UPDATE "Activities"
             SET title = CASE WHEN $13::boolean THEN $1::text ELSE COALESCE($1::text, title) END,
                 description = CASE WHEN $14::boolean THEN $2::text ELSE COALESCE($2::text, description) END,
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
           WHERE id = $12 RETURNING *`,
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
            values.titleIsExplicitEmpty,
            values.descriptionIsExplicitEmpty,
          ],
        );
        const updatedActivity = updateRes.rows[0];
        const activityId = updatedActivity.id;

        // Apply quarterly records and recalculate progress
        if (values.quarterlyRecords) {
          console.log(
            "[DEBUG upsertActivity-duplicate] Calling applyActivityQuarterlyRecords with:",
            values.quarterlyRecords,
          );
          await applyActivityQuarterlyRecords(
            client,
            activityId,
            values.quarterlyRecords,
            userId,
          );
        }

        // Trigger progress cascade if isDone changed
        if (isDoneChanged) {
          console.log(
            "[DEBUG upsertActivity-duplicate] isDone changed, triggering accumulate_metrics",
          );
          const metricForProgress = updatedActivity.currentMetric || {};
          await client.query(
            `SELECT accumulate_metrics($1::int, $2::jsonb, $3::int, NULL)`,
            [activityId, metricForProgress, userId],
          );
        }

        // Always refresh task and goal progress after activity update
        if (updatedActivity.taskId) {
          console.log(
            "[DEBUG upsertActivity-duplicate] Calling refreshTaskAndGoalProgress for taskId:",
            updatedActivity.taskId,
          );
          await refreshTaskAndGoalProgress(client, updatedActivity.taskId);
        }

        const title = normalizeString(updatedActivity.title);
        const resultActivity = {
          id: updatedActivity.id,
          rollNo: updatedActivity.rollNo,
          title: updatedActivity.title,
          taskId,
        };
        activityLookup.set(`id:${resultActivity.id}`, resultActivity);
        activityLookup.set(`${title}|${taskId}`, resultActivity);
        activityLookup.set(title, resultActivity);
        if (resultActivity.rollNo)
          activityLookup.set(
            `rollno:${resultActivity.rollNo}|${taskId}`,
            resultActivity,
          );
        if (resultActivity.rollNo)
          activityLookup.set(`rollno:${resultActivity.rollNo}`, resultActivity);
        return { id: resultActivity.id, action: "updated" };
      }
    }
    throw err;
  }

  const id = insertRes.rows[0].id;
  if (values.quarterlyRecords) {
    console.log(
      "[DEBUG upsertActivity-create] Calling applyActivityQuarterlyRecords with:",
      values.quarterlyRecords,
    );
    await applyActivityQuarterlyRecords(
      client,
      id,
      values.quarterlyRecords,
      userId,
    );
  }
  // Always refresh task and goal progress after activity creation
  if (taskId) {
    console.log(
      "[DEBUG upsertActivity-create] Calling refreshTaskAndGoalProgress for taskId:",
      taskId,
    );
    await refreshTaskAndGoalProgress(client, taskId);
  }
  const title = normalizeString(values.title);
  const titleKey = `${title}|${taskId}`;
  const activityRecord = { id, ...values, taskId };
  activityLookup.set(`id:${id}`, activityRecord);
  activityLookup.set(titleKey, activityRecord);
  activityLookup.set(title, activityRecord);
  if (values.rollNo)
    activityLookup.set(`rollno:${values.rollNo}|${taskId}`, activityRecord);
  if (values.rollNo)
    activityLookup.set(`rollno:${values.rollNo}`, activityRecord);
  return { id, action: "created" };
}

async function applyActivityQuarterlyRecords(
  client,
  activityId,
  quarterlyRecords,
  userId,
) {
  if (!quarterlyRecords || typeof quarterlyRecords !== "object") {
    console.log(
      "[DEBUG applyActivityQuarterlyRecords] No quarterlyRecords provided",
    );
    return;
  }

  console.log(
    "[DEBUG applyActivityQuarterlyRecords] Starting for activityId:",
    activityId,
    "with records:",
    quarterlyRecords,
  );

  const activityRes = await client.query(
    `SELECT "targetMetric", "metricType", "previousMetric" FROM "Activities" WHERE id = $1`,
    [activityId],
  );
  if (!activityRes.rows.length) {
    throw new Error("Activity not found for quarterly record import.");
  }

  const activity = activityRes.rows[0];
  const targetMetric = activity.targetMetric || activity.target_metric || {};
  const parsedTargetMetric =
    typeof targetMetric === "string"
      ? safeParseJson(targetMetric)
      : targetMetric;
  const metricKey = Object.keys(parsedTargetMetric || {})[0] || "value";
  const metricType = activity.metricType || "Plus";
  const previousMetric =
    activity.previousMetric || activity.previous_metric || {};

  console.log(
    "[DEBUG applyActivityQuarterlyRecords] Activity found: metricKey =",
    metricKey,
    "| metricType =",
    metricType,
  );

  const fiscalRes = await client.query(
    `SELECT * FROM calc_fiscal_period(CURRENT_DATE)`,
  );
  const fiscalYear = fiscalRes.rows[0]?.fiscal_year || new Date().getFullYear();

  console.log("[DEBUG applyActivityQuarterlyRecords] Fiscal year:", fiscalYear);

  for (const [quarter, value] of Object.entries(quarterlyRecords)) {
    const qNum = parseInt(String(quarter).replace(/^q/i, ""), 10);
    if (qNum < 1 || qNum > 4) continue;
    if (value === null || value === undefined || String(value).trim() === "") {
      console.log(
        `[DEBUG applyActivityQuarterlyRecords] Skipping q${qNum}: value is null/empty`,
      );
      continue;
    }
    const numVal = Number(value);
    if (!Number.isFinite(numVal)) {
      console.log(
        `[DEBUG applyActivityQuarterlyRecords] Skipping q${qNum}: not a number (value=${value}, numVal=${numVal})`,
      );
      continue;
    }

    console.log(
      `[DEBUG applyActivityQuarterlyRecords] Upserting q${qNum}: value=${numVal}`,
    );

    await client.query(
      `INSERT INTO "ActivityRecords"
         ("activityId", "fiscalYear", quarter, "metricKey", value, source, "createdBy", "updatedBy", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'import',$6,$6,NOW(),NOW())
       ON CONFLICT ("activityId", "fiscalYear", quarter, "metricKey") WHERE "quarter" IS NOT NULL
       DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = NOW()`,
      [activityId, fiscalYear, qNum, metricKey, numVal, userId],
    );
  }

  const recordsRes = await client.query(
    `SELECT "quarter", "value"
       FROM "ActivityRecords"
       WHERE "activityId" = $1
         AND "fiscalYear" = $2
         AND "quarter" IS NOT NULL
         AND "metricKey" = $3
       ORDER BY "quarter"`,
    [activityId, fiscalYear, metricKey],
  );

  const rows = recordsRes.rows || [];
  let recalculatedValue = 0;
  if (metricType === "Plus" || metricType === "Minus") {
    recalculatedValue = rows.reduce((sum, rec) => {
      const num = Number(rec.value);
      return sum + (Number.isFinite(num) ? num : 0);
    }, 0);
  } else {
    if (rows.length > 0) {
      const lastValue = Number(rows[rows.length - 1].value);
      recalculatedValue = Number.isFinite(lastValue) ? lastValue : 0;
    }
  }

  console.log(
    "[DEBUG applyActivityQuarterlyRecords] Recalculated value:",
    recalculatedValue,
  );

  const targetVal = Number(
    (parsedTargetMetric && parsedTargetMetric[metricKey]) ?? null,
  );
  const previousVal = Number(
    (previousMetric && previousMetric[metricKey]) ?? null,
  );
  const safeTarget = Number.isFinite(targetVal) ? targetVal : 0;
  const safePrevious = Number.isFinite(previousVal) ? previousVal : 0;

  let newProgress = 0;
  if (metricType === "Plus" || metricType === "Minus") {
    newProgress =
      safeTarget > 0
        ? Math.min(100, Math.round((recalculatedValue / safeTarget) * 100))
        : recalculatedValue > 0
          ? 100
          : 0;
  } else if (metricType === "Increase") {
    const diffTarget = safeTarget - safePrevious;
    newProgress =
      diffTarget > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(
                ((recalculatedValue - safePrevious) / diffTarget) * 100,
              ),
            ),
          )
        : 100;
  } else if (metricType === "Decrease") {
    const diffTarget = safePrevious - safeTarget;
    newProgress =
      diffTarget > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(
                ((safePrevious - recalculatedValue) / diffTarget) * 100,
              ),
            ),
          )
        : 100;
  } else if (metricType === "Maintain") {
    newProgress = 100;
  }

  console.log(
    "[DEBUG applyActivityQuarterlyRecords] Updating activity: currentMetric =",
    { [metricKey]: recalculatedValue },
    "| progress =",
    newProgress,
  );

  const newCurrentMetric = { [metricKey]: recalculatedValue };
  await client.query(
    `UPDATE "Activities"
       SET "currentMetric" = $1, "progress" = $2, "updatedAt" = NOW()
       WHERE id = $3`,
    [newCurrentMetric, newProgress, activityId],
  );
}

// Helper function to refresh task and goal progress after activity changes
async function refreshTaskAndGoalProgress(client, taskId) {
  if (!taskId) return;

  console.log(
    "[DEBUG refreshTaskAndGoalProgress] Refreshing progress for taskId:",
    taskId,
  );

  await client.query(
    `WITH task_data AS (
       SELECT COALESCE(ROUND(SUM(a."progress" * a.weight) / NULLIF(SUM(a.weight), 0))::int, 0) AS computed_progress
       FROM "Activities" a
       WHERE a."taskId" = $1
     )
     UPDATE "Tasks"
     SET progress = task_data.computed_progress,
         status = CASE
           WHEN task_data.computed_progress >= 100 THEN 'Done'::task_status
           WHEN status = 'Blocked' THEN 'Blocked'::task_status
           WHEN task_data.computed_progress > 0 THEN 'In Progress'::task_status
           ELSE 'To Do'::task_status
         END,
         "updatedAt" = NOW()
     FROM task_data
     WHERE id = $1`,
    [taskId],
  );

  await client.query(
    `WITH goal_data AS (
       SELECT COALESCE(ROUND(SUM(t."progress" * t.weight) / NULLIF(SUM(t.weight), 0))::int, 0) AS computed_goal_progress,
              g.id AS goal_id
       FROM "Tasks" t
       JOIN "Goals" g ON g.id = t."goalId"
       WHERE t."goalId" = (SELECT "goalId" FROM "Tasks" WHERE id = $1)
       GROUP BY g.id
     )
     UPDATE "Goals"
     SET progress = goal_data.computed_goal_progress,
         status = CASE
           WHEN goal_data.computed_goal_progress >= 100 THEN 'Completed'::goal_status
           WHEN status = 'On Hold' THEN 'On Hold'::goal_status
           WHEN goal_data.computed_goal_progress > 0 THEN 'In Progress'::goal_status
           ELSE 'Not Started'::goal_status
         END,
         "updatedAt" = NOW()
     FROM goal_data
     WHERE id = goal_data.goal_id`,
    [taskId],
  );

  console.log("[DEBUG refreshTaskAndGoalProgress] Complete");
}

async function resolveActivityIdForQuarter(
  client,
  row,
  activityLookup,
  activitiesRows,
) {
  if (row.activity_id) {
    const explicitActivity = activityLookup.get(
      `id:${Number(row.activity_id)}`,
    );
    if (explicitActivity) return explicitActivity.id;
  }

  if (row.activity_roll_no) {
    const activity =
      activityLookup.get(
        `rollno:${row.activity_roll_no}|${Number(row.task_id) || 0}`,
      ) || activityLookup.get(`rollno:${row.activity_roll_no}`);
    if (activity) return activity.id;
  }

  const titleKey = `${normalizeString(row.activity_title || row.activity_name)}|${Number(row.task_id) || 0}`;
  let found = activityLookup.get(titleKey);
  if (found) return found.id;

  if (row.activity_title || row.activity_name) {
    found = activityLookup.get(
      normalizeString(row.activity_title || row.activity_name),
    );
    if (found) return found.id;
  }

  for (const activityRow of activitiesRows) {
    if (
      normalizeString(
        activityRow.activity_title || activityRow.activity_name,
      ) === normalizeString(row.activity_title || row.activity_name)
    ) {
      const explicitId = Number(
        activityRow.activity_id || activityRow.activityId || null,
      );
      if (explicitId && activityLookup.get(`id:${explicitId}`))
        return explicitId;
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
  const activityRes = await client.query(
    `SELECT "targetMetric" FROM "Activities" WHERE id = $1 LIMIT 1`,
    [activityId],
  );
  const activity = activityRes.rows[0] || {};
  const activityMetricKey = getPrimaryMetricKey(activity);
  const rowMetricKey = row.metric_key ? String(row.metric_key).trim() : null;
  const metricKey =
    rowMetricKey ||
    activityMetricKey ||
    getMetricKeyFromActivityRow(row) ||
    "quarterlyGoals";
  const planned =
    row.planned === null ||
    row.planned === undefined ||
    String(row.planned).trim() === ""
      ? null
      : Number(row.planned);
  const actual =
    row.actual === null ||
    row.actual === undefined ||
    String(row.actual).trim() === ""
      ? null
      : Number(row.actual);
  const remark =
    row.remark === null ||
    row.remark === undefined ||
    String(row.remark).trim() === ""
      ? null
      : String(row.remark).trim();

  if (Number.isFinite(planned)) {
    await client.query(
      `INSERT INTO "ActivityRecords"
         ("activityId", "fiscalYear", quarter, "metricKey", value, source, "createdBy", "updatedBy", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'import',$6,$6,NOW(),NOW())
       ON CONFLICT ("activityId", "fiscalYear", quarter, "metricKey") WHERE "quarter" IS NOT NULL
       DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = NOW()`,
      [
        activityId,
        fiscalYear,
        quarter,
        `${metricKey}_planned`,
        planned,
        userId,
      ],
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
    const { rows } = await db.query(
      `SELECT * FROM "${IMPORT_HISTORY_TABLE}" ORDER BY "importDate" DESC LIMIT 100`,
    );
    return res.json({ rows });
  } catch (err) {
    console.error("getImportHistory error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to load import history." });
  }
}

async function getImportHistoryById(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT * FROM "${IMPORT_HISTORY_TABLE}" WHERE id = $1`,
      [id],
    );
    if (!rows[0])
      return res.status(404).json({ error: "Import history not found." });
    return res.json(rows[0]);
  } catch (err) {
    console.error("getImportHistoryById error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to load history record." });
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

    const fiscalRes = await db.query(
      `SELECT * FROM calc_fiscal_period(CURRENT_DATE)`,
    );
    const currentFiscalYear =
      fiscalRes.rows[0]?.fiscal_year || new Date().getFullYear();
    console.log(
      "[DEBUG downloadTemplate] Current fiscal year:",
      currentFiscalYear,
    );

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

    console.log(
      "[DEBUG downloadTemplate] Found",
      quartersRes.rows.length,
      "quarterly records",
    );
    console.log(
      "[DEBUG downloadTemplate] Sample quarters (first 5):",
      quartersRes.rows.slice(0, 5),
    );

    const activities = activitiesRes.rows.map((row) => ({
      ...row,
      targetMetric: row.activity_target_metric || row.target_metric || null,
      currentMetric: row.activity_current_metric || row.current_metric || null,
      previousMetric:
        row.activity_previous_metric || row.previous_metric || null,
      quarterlyGoals: row.activity_quarterly_goals || null,
      activity_quarterly_goals: safeParseJson(row.activity_quarterly_goals),
    }));

    const quarterlyMap = buildQuarterlyRecordsMap(
      activities,
      quartersRes.rows,
      null,
    );
    console.log(
      "[DEBUG downloadTemplate] quarterlyMap keys:",
      Object.keys(quarterlyMap).slice(0, 10),
    );
    console.log(
      "[DEBUG downloadTemplate] Sample quarterlyMap entry:",
      Object.entries(quarterlyMap)
        .slice(0, 3)
        .map(([k, v]) => ({ activityId: k, data: v })),
    );

    const activityQuarterlyGoalsRows = [];
    for (const activity of activities) {
      const quarterlyGoals =
        activity.activity_quarterly_goals ||
        safeParseJson(activity.quarterlyGoals);
      const metricKey = getPrimaryMetricKey(activity) || "quarterlyGoals";
      for (let quarter = 1; quarter <= 4; quarter += 1) {
        const planned =
          quarterlyGoals && typeof quarterlyGoals === "object"
            ? quarterlyGoals[`q${quarter}`]
            : null;
        const actual =
          quarterlyMap[activity.activity_id]?.[`q${quarter}`] ?? null;

        activityQuarterlyGoalsRows.push({
          activity_id: activity.activity_id || null,
          activity_roll_no: activity.activity_roll_no || null,
          activity_title: activity.activity_title || null,
          fiscal_year: currentFiscalYear,
          quarter,
          metric_key: metricKey,
          planned: planned !== undefined ? planned : null,
          actual,
          remark: null,
        });
      }
    }

    console.log(
      "[DEBUG downloadTemplate] Generated",
      activityQuarterlyGoalsRows.length,
      "quarterly goals rows",
    );
    console.log(
      "[DEBUG downloadTemplate] Sample rows with actual values:",
      activityQuarterlyGoalsRows.filter((r) => r.actual !== null).slice(0, 5),
    );

    const quarters = activityQuarterlyGoalsRows;

    const workbook = buildTemplateWorkbook({
      goals: goalsRes.rows,
      tasks: tasksRes.rows,
      activities,
      quarters,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="bulk-import-template.xlsx"`,
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("downloadTemplate error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to generate template." });
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
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="import-errors.xlsx"`,
      );
      await workbook.xlsx.write(res);
      res.end();
    } else {
      const csv = buildErrorCsv(errors);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="import-errors.csv"`,
      );
      res.send(csv);
    }
  } catch (err) {
    console.error("downloadErrorReport error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to generate error report." });
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
  // Exposed for tests
  performImport,
  upsertGoal,
  upsertTask,
  upsertActivity,
  upsertQuarterlyRecord,
  applyActivityQuarterlyRecords,
};
