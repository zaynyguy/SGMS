// Hardened controller: validate & coerce inputs to avoid PG type errors.
// MODIFIED: Added "previousMetric" to create and update actions.

const db = require("../db");
const notificationService = require("../services/notificationService");
const { logAudit } = require("../helpers/audit");
const EPS = 1e-9;

function toNumberOrNull(v) {
if (v === null || v === undefined || v === "") return null;
const n = Number(v);
return Number.isFinite(n) ? n : null;
}
function toIntOrNull(v) {
if (v === null || v === undefined || v === "") return null;
const n = parseInt(String(v), 10);
return Number.isInteger(n) ? n : null;
}
function toBoolean(v) {
if (v === true || v === false) return v;
if (typeof v === "string") {
const s = v.toLowerCase().trim();
if (s === "true") return true;
if (s === "false") return false;
}
return Boolean(v);
}
function safeParseJson(v) {
if (v === null || v === undefined) return null;
if (typeof v === "object") return v;
if (typeof v === "string") {
try {
return v.trim() === "" ? null : JSON.parse(v);
} catch {
// not JSON, return the raw string
return v;
}
}
return v;
}

// helper to convert empty-string -> null (and trim strings)
function nullIfEmpty(v) {
if (v === null || v === undefined) return null;
if (typeof v === "string") {
const t = v.trim();
return t === "" ? null : t;
}
return v;
}

exports.getActivitiesByTask = async (req, res) => {
const taskId = toIntOrNull(req.params.taskId);
if (!taskId) return res.status(400).json({ message: "Invalid taskId" });

try {
const isManager =
Array.isArray(req.user?.permissions) &&
req.user.permissions.includes("manage_gta");

const baseQ = `
SELECT a.*, t."goalId", gl."groupId", g.name AS "groupName"
FROM "Activities" a
JOIN "Tasks" t ON a."taskId" = t.id
JOIN "Goals" gl ON t."goalId" = gl.id
JOIN "Groups" g ON gl."groupId" = g.id
WHERE a."taskId" = $1
ORDER BY COALESCE(a."rollNo", 999999), a."createdAt" DESC
`;

if (isManager) {
const { rows } = await db.query(baseQ, [taskId]);
return res.json(rows);
}

const q = baseQ.replace("WHERE a.\"taskId\" = $1", `JOIN "UserGroups" ug ON ug."groupId" = g.id WHERE a."taskId" = $1 AND ug."userId" = $2`);
const { rows } = await db.query(q, [taskId, req.user.id]);
return res.json(rows);
} catch (err) {
console.error("getActivitiesByTask error:", err);
return res.status(500).json({ message: "Failed to fetch activities.", error: err.message });
}
};

exports.createActivity = async (req, res) => {
const taskId = toIntOrNull(req.params.taskId);
if (!taskId) return res.status(400).json({ message: "Invalid taskId" });

// MODIFIED: Added previousMetric
const { title, description, dueDate, weight, targetMetric, previousMetric, rollNo } = req.body;

if (!title || String(title).trim() === "") {
return res.status(400).json({ message: "Title is required." });
}

const parsedTargetMetric = safeParseJson(targetMetric);
// MODIFIED: Parse previousMetric
const parsedPreviousMetric = safeParseJson(previousMetric);

try {
const activity = await db.tx(async (client) => {
// lock task
const t = await client.query(
'SELECT id, weight FROM "Tasks" WHERE id=$1 FOR UPDATE',
[taskId]
);
if (!t.rows.length) {
const err = new Error("Task not found");
err.status = 404;
throw err;
}

const taskWeight = parseFloat(t.rows[0].weight) || 0;
const newWeight = toNumberOrNull(weight);
if (newWeight === null) {
const err = new Error("Activity weight must be a number");
err.status = 400;
throw err;
}
if (newWeight <= 0) {
const err = new Error("Activity weight must be > 0");
err.status = 400;
throw err;
}

const sumRes = await client.query(
'SELECT COALESCE(SUM(weight)::numeric,0) AS sum FROM "Activities" WHERE "taskId"=$1',
[taskId]
);
const sumOther = parseFloat(sumRes.rows[0].sum || 0);

if (newWeight + sumOther > taskWeight + EPS) {
const err = new Error(
`Cannot set activity weight to ${newWeight}. Task total is ${taskWeight} and ${sumOther} is already used.`
);
err.status = 400;
throw err;
}

// rollNo handling (optional)
let insertRes;
const rn = toIntOrNull(rollNo);
if (rn !== null) {
// uniqueness check per task
const dup = await client.query(
`SELECT id FROM "Activities" WHERE "taskId" = $1 AND "rollNo" = $2`,
[taskId, rn]
);
if (dup.rows.length) {
const err = new Error(`rollNo ${rn} is already in use for this task`);
err.status = 409;
throw err;
}

// MODIFIED: Added "previousMetric"
insertRes = await client.query(
`INSERT INTO "Activities"
("taskId", "rollNo", title, description, "dueDate", "weight", "targetMetric", "previousMetric", "createdAt", "updatedAt")
VALUES ($1,$2,$3,$4,$5,$6,$7, $8, NOW(), NOW())
RETURNING *`,
[
taskId,
rn,
String(title).trim(),
description?.trim() || null,
dueDate || null,
newWeight,
parsedTargetMetric ?? null,
parsedPreviousMetric ?? null, // MODIFIED
]
);
} else {
// MODIFIED: Added "previousMetric"
insertRes = await client.query(
`INSERT INTO "Activities"
("taskId", title, description, "dueDate", "weight", "targetMetric", "previousMetric", "createdAt", "updatedAt")
VALUES ($1,$2,$3,$4,$5,$6, $7, NOW(), NOW())
RETURNING *`,
[
taskId,
String(title).trim(),
description?.trim() || null,
dueDate || null,
newWeight,
parsedTargetMetric ?? null,
parsedPreviousMetric ?? null, // MODIFIED
]
);
}

if (!insertRes.rows || !insertRes.rows[0]) throw new Error("Failed to create activity");

const newActivity = insertRes.rows[0];

try {
await logAudit({
userId: req.user.id,
action: "ACTIVITY_CREATED",
entity: "Activity",
entityId: newActivity.id,
details: { title: newActivity.title, taskId: newActivity.taskId, rollNo: newActivity.rollNo },
client,
req,
});
} catch (e) {
console.error("ACTIVITY_CREATED audit failed (in-tx):", e);
}

return newActivity;
});

try {
await notificationService({
userId: req.user.id,
type: "activity_created",
message: `Activity "${activity.title}" created.`,
meta: { activityId: activity.id },
});
} catch (notifErr) {
console.error("createActivity: notification failed:", notifErr);
}

return res.status(201).json({ message: "Activity created successfully.", activity });
} catch (err) {
console.error("createActivity error:", err);
if (err && (err.status === 404 || err.status === 409)) return res.status(err.status).json({ message: err.message });
if (err && err.status === 400) return res.status(400).json({ message: err.message });
if (err && err.code === "23505") {
return res.status(409).json({ message: "rollNo conflict: that roll number is already in use for this task." });
}
return res.status(500).json({ message: "Failed to create activity.", error: err.message });
}
};

exports.updateActivity = async (req, res) => {
const activityId = toIntOrNull(req.params.activityId);
if (!activityId) return res.status(400).json({ message: "Invalid activityId" });

// MODIFIED: Added previousMetric
const {
title,
description,
status,
dueDate,
weight,
targetMetric,
previousMetric, // MODIFIED
isDone,
rollNo,
} = req.body;

// fetch before snapshot (for audit)
const bRes = await db.query('SELECT * FROM "Activities" WHERE id=$1', [activityId]);
const beforeActivity = bRes.rows[0] || null;

try {
const activity = await db.tx(async (client) => {
const c = await client.query(
'SELECT * FROM "Activities" WHERE id=$1 FOR UPDATE',
[activityId]
);
if (!c.rows.length) {
const e = new Error("Activity not found");
e.status = 404;
throw e;
}

const existing = c.rows[0];

// rollNo uniqueness (if provided)
const rn = toIntOrNull(rollNo);
if (rollNo !== undefined && rollNo !== null && String(rollNo).trim() !== "") {
if (rn === null) {
const err = new Error("rollNo must be a positive integer");
err.status = 400;
throw err;
}
const dup = await client.query(
`SELECT id FROM "Activities" WHERE "taskId" = $1 AND "rollNo" = $2 AND id <> $3`,
[existing.taskId, rn, activityId]
);
if (dup.rows.length) {
const err = new Error(`rollNo ${rn} is already in use for this task`);
err.status = 409;
throw err;
}
}

let newWeight = toNumberOrNull(weight ?? existing.weight);
if (newWeight === null) {
const err = new Error("Activity weight must be a number");
err.status = 400;
throw err;
}
if (newWeight <= 0) {
const err = new Error("Activity weight must be > 0");
err.status = 400;
throw err;
}

// get task weight locked
const tRes = await client.query(
'SELECT weight FROM "Tasks" WHERE id=$1 FOR UPDATE',
[existing.taskId]
);
if (!tRes.rows.length) {
const err = new Error("Parent task not found");
err.status = 404;
throw err;
}
const taskWeight = parseFloat(tRes.rows[0].weight) || 0;

const sumRes = await client.query(
'SELECT COALESCE(SUM(weight)::numeric,0) AS sum FROM "Activities" WHERE "taskId"=$1 AND id<>$2',
[existing.taskId, activityId]
);
const sumOther = parseFloat(sumRes.rows[0].sum || 0);

if (newWeight + sumOther > taskWeight + EPS) {
const err = new Error(
`Cannot set activity weight to ${newWeight}. Task total is ${taskWeight} and ${sumOther} is already used.`
);
err.status = 400;
throw err;
}

const parsedTargetMetric = safeParseJson(targetMetric);
// MODIFIED: Parse previousMetric
const parsedPreviousMetric = safeParseJson(previousMetric);

// sanitize incoming strings: convert empty string -> null, trim where appropriate
const safeTitle = nullIfEmpty(title) ? String(nullIfEmpty(title)).trim() : null;
const safeDescription = nullIfEmpty(description) ? String(nullIfEmpty(description)).trim() : null;
const safeStatus = nullIfEmpty(status);
const safeDueDate = nullIfEmpty(dueDate); // empty string => null (this fixes DateTimeParseError)
const safeIsDone = (isDone === undefined ? null : toBoolean(isDone));

// MODIFIED: Added "previousMetric" = COALESCE($10, "previousMetric")
const r = await client.query(
`UPDATE "Activities"
SET "rollNo" = COALESCE($1, "rollNo"),
title=$2, description=$3, status=COALESCE($4, status),
"dueDate"=$5, "weight"=$6,
"targetMetric"=COALESCE($7, "targetMetric"),
"isDone"=COALESCE($8, "isDone"), "updatedAt"=NOW(),
"previousMetric"=COALESCE($10, "previousMetric")
WHERE id=$9
RETURNING *`,
[
rn !== null ? rn : null,
safeTitle ?? null,
safeDescription ?? null,
safeStatus ?? null,
safeDueDate, // <--- safe (null if empty string)
newWeight,
parsedTargetMetric ?? null,
safeIsDone,
activityId,
parsedPreviousMetric ?? null, // MODIFIED
]
);

if (!r.rows || !r.rows[0]) throw new Error("Failed to update activity");

const updatedActivity = r.rows[0];

try {
await logAudit({
userId: req.user.id,
action: "ACTIVITY_UPDATED",
entity: "Activity",
entityId: updatedActivity.id,
before: beforeActivity,
after: updatedActivity,
client,
req,
});
} catch (e) {
console.error("ACTIVITY_UPDATED audit failed (in-tx):", e);
}

return updatedActivity;
});

try {
await notificationService({
userId: req.user.id,
type: "activity_updated",
message: `Activity "${activity.title}" updated.`,
meta: { activityId: activity.id },
});
} catch (notifErr) {
console.error("updateActivity: notification failed:", notifErr);
}

return res.json({ message: "Activity updated successfully.", activity });
} catch (err) {
console.error("updateActivity error:", err);
if (err && (err.status === 404 || err.status === 409)) return res.status(err.status).json({ message: err.message });
if (err && err.status === 400) return res.status(400).json({ message: err.message });
if (err && err.code === "22P02") {
// Postgres invalid_text_representation (coercion failure)
return res.status(400).json({ message: "Invalid input type provided." });
}
return res.status(500).json({ message: "Failed to update activity.", error: err.message });
}
};

exports.deleteActivity = async (req, res) => {
const activityId = toIntOrNull(req.params.activityId);
if (!activityId) return res.status(400).json({ message: "Invalid activityId" });

try {
const deleted = await db.tx(async (client) => {
const a = await client.query('SELECT * FROM "Activities" WHERE id=$1', [activityId]);
if (!a.rows.length) {
const e = new Error("Activity not found");
e.status = 404;
throw e;
}

const toDelete = a.rows[0];

const r = await client.query('DELETE FROM "Activities" WHERE id=$1 RETURNING *', [activityId]);
const deletedRow = r.rows && r.rows[0] ? r.rows[0] : null;

try {
await logAudit({
userId: req.user.id,
action: "ACTIVITY_DELETED",
entity: "Activity",
entityId: activityId,
before: toDelete,
client,
req,
});
} catch (e) {
console.error("ACTIVITY_DELETED audit failed (in-tx):", e);
}

return deletedRow;
});

try {
await notificationService({
userId: req.user.id,
type: "activity_deleted",
message: deleted ? `Activity "${deleted.title}" deleted.` : `Activity ${activityId} deleted.`,
meta: { activityId },
});
} catch (notifErr) {
console.error("deleteActivity: notification failed:", notifErr);
}

return res.json({ message: "Activity deleted successfully." });
} catch (err) {
console.error("deleteActivity error:", err);
if (err && err.status === 404) return res.status(404).json({ message: err.message });
return res.status(500).json({ message: "Failed to delete activity.", error: err.message });
}
};
