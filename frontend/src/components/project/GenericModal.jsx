import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader } from "lucide-react";

/**
* A generic modal for creating and editing Goals, Tasks, and Activities.
* It derives its behavior from the `modal.type` prop.
* It can be pre-populated with data from `modal.data`.
*
* MODIFIED: Added "previousMetric" fields and logic.
*/
export default function GenericModal({
modal,
setModal,
groups = [],
tasks = {}, // Expected: { [goalId]: [task1, task2] } or an array of tasks
goals = [],
activities = {}, // Expected: { [taskId]: [act1, act2] } or an array of activities
onCreateGoal = async () => {},
onUpdateGoal = async () => {},
onCreateTask = async () => {},
onUpdateTask = async () => {},
onCreateActivity = async () => {},
onUpdateActivity = async () => {},
isSubmitting = false,
t = (s) => s, // Translation function fallback
}) {
const [local, setLocal] = useState({});
const [jsonError, setJsonError] = useState(null);
const [inlineError, setInlineError] = useState(null);

const firstFieldRef = useRef(null);

// Helper to generate a unique ID for new metric rows
const generateId = () => {
if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
return crypto.randomUUID();
}
return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

/**
* Normalizes various shapes of `modal.data` into a consistent
* { goalId, taskId, id } object.
* 'id' is always the ID of the item being edited (e.g., activityId or taskId).
*/
const resolveIds = useCallback((data = {}) => {
const d = data || {};
const goalId =
d.goalId ??
d.goal_id ??
d.goal ??
(d.goal && (d.goal.id ?? d.goal)) ??
null;
const taskId =
d.taskId ??
d.task_id ??
d.task ??
(d.task && (d.task.id ?? d.task)) ??
null;

// 'id' is the ID of the primary item (Goal, Task, or Activity)
// It correctly prioritizes activityId, then falls back.
const id =
d.id ??
d.activityId ??
d.activity_id ??
(d.activity && (d.activity.id ?? d.activity)) ??
d.taskId ?? // Fallback for task-only data
(d.task && (d.task.id ?? d.task)) ?? // Fallback for task-only data
null;

// convert numeric-looking strings to numbers where appropriate
const tryNum = (v) => {
if (v === null || v === undefined || v === "") return null;
const n = Number(v);
return Number.isFinite(n) ? n : v;
};

return {
goalId: tryNum(goalId),
taskId: tryNum(taskId),
id: tryNum(id),
raw: d,
};
}, []);

// Helper to parse metric data from various formats (string, object, array)
const parseMetricData = (metricData) => {
try {
const tm = metricData;
if (!tm) return [{ id: generateId(), key: "", value: "" }];
if (typeof tm === "string") {
const parsed = JSON.parse(tm);
if (Array.isArray(parsed)) {
return parsed.map((m) => ({ id: generateId(), key: m?.key ?? "", value: m?.value ?? "" }));
}
return Object.keys(parsed || {}).map((k) => ({ id: generateId(), key: k, value: String(parsed[k]) }));
}
if (Array.isArray(tm)) {
return tm.map((m) => ({ id: generateId(), key: m?.key ?? "", value: m?.value ?? "" }));
}
return Object.keys(tm || {}).map((k) => ({ id: generateId(), key: k, value: String(tm[k]) }));
} catch {
return [{ id: generateId(), key: "", value: "" }];
}
};

/**
* This effect populates the local form state (`local`) whenever the modal is opened.
*
* Behavior:
* - For "create*" modals: ignore non-ID fields in modal.data to avoid accidental pre-fill
* from previously-open objects. Only use IDs (goalId/taskId/groupId) if present.
* - For "edit*" modals: prefer the full object from modal.data; if it's only IDs,
* attempt to resolve the full object from `tasks` / `activities` props.
*/
useEffect(() => {
if (!modal?.isOpen) return;

const initial = modal.data || {};
setInlineError(null);
setJsonError(null);

const initRoll = (val) => {
if (val === null || val === undefined) return "";
const n = Number(val);
return Number.isFinite(n) && String(n).trim() !== "" ? Math.floor(n) : "";
};

const { goalId, taskId, id } = resolveIds(initial);

// helper to find task object from props (if not passed in modal.data)
const findTask = (gId, tId) => {
if (!tId) return null;
// tasks might be an array or an object keyed by goalId
if (Array.isArray(tasks)) {
return tasks.find((x) => String(x.id) === String(tId) || x.id === tId) || null;
}
const list = tasks && tasks[gId] ? tasks[gId] : [];
return (Array.isArray(list) ? list : []).find((x) => String(x.id) === String(tId) || x.id === tId) || null;
};

// helper to find activity object from props (if not passed in modal.data)
const findActivity = (tId, aId) => {
if (!aId) return null;
if (Array.isArray(activities)) {
return activities.find((x) => String(x.id) === String(aId) || x.id === aId) || null;
}
const list = activities && activities[tId] ? activities[tId] : [];
return (Array.isArray(list) ? list : []).find((x) => String(x.id) === String(aId) || x.id === aId) || null;
};

// Decide source object used to populate fields.
// For create modals: only use IDs; do not take other fields from modal.data.
// For edit modals: prefer modal.data full object; if only IDs provided, try to look up full object.
let source = {};
const isCreate = typeof modal.type === "string" && modal.type.startsWith("create");

if (isCreate) {
// Only carry over IDs (goalId/taskId/groupId) for create modals.
// This prevents accidental population from stale full objects.
source = {};
if (goalId) source.goalId = goalId;
if (taskId) source.taskId = taskId;
if (initial.groupId) source.groupId = initial.groupId;
// Don't copy over title/description/weight/status/rollNo/etc.
} else {
// For edit modals (or unknown types), prefer the full object passed in modal.data.
// But if modal.data lacks details (only IDs), try to resolve from tasks/activities.
source = initial || {};

if ((modal.type === "editTask" || modal.type === "editActivity") && (!source || !source.title)) {
// attempt resolution
if (modal.type === "editTask") {
const found = findTask(goalId, id);
if (found) source = found;
} else if (modal.type === "editActivity") {
const found = findActivity(taskId || source.taskId, id);
if (found) source = found;
}
}
}

// Now populate form state according to modal.type
if (modal.type === "createActivity" || modal.type === "editActivity") {
// If creating, allow taskId/goalId to be shown elsewhere but form fields remain empty defaults.
setLocal({
title: source.title || "",
description: source.description || "",
dueDate: source.dueDate || source.endDate || "",
weight: source.weight ?? 1,
status: source.status || "To Do",
isDone: source.isDone ?? false,
rollNo: initRoll(source.rollNo),
// MODIFIED: Added previousMetrics
previousMetrics: parseMetricData(source.previousMetric ?? source.previousMetrics),
targetMetrics: parseMetricData(source.targetMetric ?? source.targetMetrics),
});
} else if (modal.type === "createTask" || modal.type === "editTask") {
setLocal({
title: source.title || "",
description: source.description || "",
dueDate: source.dueDate || source.endDate || "",
weight: source.weight ?? 1,
status: source.status || "To Do",
rollNo: initRoll(source.rollNo),
});
} else if (modal.type === "createGoal" || modal.type === "editGoal") {
setLocal({
title: source.title || "",
description: source.description || "",
groupId: source.groupId ? String(source.groupId) : "",
startDate: source.startDate || "",
endDate: source.endDate || "",
weight: source.weight ?? 1,
status: source.status || "Not Started",
rollNo: initRoll(source.rollNo),
});
} else {
setLocal({});
}

// focus first field
setTimeout(() => {
if (firstFieldRef.current) firstFieldRef.current.focus?.();
}, 50);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [modal?.isOpen, modal?.type, modal?.data, tasks, activities, resolveIds, goals]);

// --- Standard Modal boilerplate ---
useEffect(() => {
if (modal?.isOpen) {
const prev = document.body.style.overflow;
document.body.style.overflow = "hidden";
return () => {
document.body.style.overflow = prev;
};
}
return undefined;
}, [modal?.isOpen]);

useEffect(() => {
const onKey = (e) => {
if (e.key === "Escape" && modal?.isOpen) setModal({ isOpen: false, type: null, data: null });
};
window.addEventListener("keydown", onKey);
return () => window.removeEventListener("keydown", onKey);
}, [modal?.isOpen, setModal]);

const onLocalChange = (e) => {
const { name, value, type, checked } = e.target;
const nextVal =
type === "checkbox" ? checked : type === "number" ? (value === "" ? "" : Number(value)) : value;
setLocal((p) => ({ ...p, [name]: nextVal }));
if (name === "targetMetric" && jsonError) setJsonError(null);
if (inlineError) setInlineError(null);
};

// --- Target Metric form helpers ---
const updateMetricRow = (idx, field, value) =>
setLocal((p) => {
const next = { ...(p || {}) };
const arr = Array.isArray(next.targetMetrics) ? [...next.targetMetrics] : [];
const existing = arr[idx] || { id: generateId(), key: "", value: "" };
arr[idx] = { ...existing, [field]: value };
next.targetMetrics = arr;
return next;
});

const addMetricRow = () =>
setLocal((p) => {
const next = { ...(p || {}) };
const arr = Array.isArray(next.targetMetrics) ? [...next.targetMetrics] : [];
arr.push({ id: generateId(), key: "", value: "" });
next.targetMetrics = arr;
return next;
});

const removeMetricRow = (idx) =>
setLocal((p) => {
const next = { ...(p || {}) };
const arr = Array.isArray(next.targetMetrics) ? [...next.targetMetrics] : [];
const filtered = arr.filter((_, i) => i !== idx);
next.targetMetrics = filtered.length ? filtered : [{ id: generateId(), key: "", value: "" }];
return next;
});

// --- MODIFIED: Previous Metric form helpers ---
const updatePreviousMetricRow = (idx, field, value) =>
setLocal((p) => {
const next = { ...(p || {}) };
const arr = Array.isArray(next.previousMetrics) ? [...next.previousMetrics] : [];
const existing = arr[idx] || { id: generateId(), key: "", value: "" };
arr[idx] = { ...existing, [field]: value };
next.previousMetrics = arr;
return next;
});

const addPreviousMetricRow = () =>
setLocal((p) => {
const next = { ...(p || {}) };
const arr = Array.isArray(next.previousMetrics) ? [...next.previousMetrics] : [];
arr.push({ id: generateId(), key: "", value: "" });
next.previousMetrics = arr;
return next;
});

const removePreviousMetricRow = (idx) =>
setLocal((p) => {
const next = { ...(p || {}) };
const arr = Array.isArray(next.previousMetrics) ? [...next.previousMetrics] : [];
const filtered = arr.filter((_, i) => i !== idx);
next.previousMetrics = filtered.length ? filtered : [{ id: generateId(), key: "", value: "" }];
return next;
});


// --- Weight calculation helpers ---
const parseNum = useCallback((v, fallback = 0) => {
const n = parseFloat(String(v));
return Number.isNaN(n) ? fallback : n;
}, []);

const computeGoalWeightAvailable = useCallback(
(goalId, excludeTaskId = null) => {
const g = goals.find((x) => String(x.id) === String(goalId) || x.id === goalId);
const goalWeight = parseNum(g?.weight, 0);
const list = tasks[goalId] || [];
const sumOther = (Array.isArray(list) ? list : []).reduce((s, t) => {
if (excludeTaskId && String(t.id) === String(excludeTaskId)) return s;
return s + parseNum(t.weight, 0);
}, 0);
return { goalWeight, used: sumOther, available: Math.max(0, goalWeight - sumOther) };
},
[goals, tasks, parseNum]
);

const computeTaskWeightAvailable = useCallback(
(taskId, excludeActivityId = null) => {
const allTasksLists = Array.isArray(tasks) ? tasks : Object.values(tasks).flat();
const taskObj = (Array.isArray(allTasksLists) ? allTasksLists : []).find((t) => String(t.id) === String(taskId) || t.id === taskId);
const taskWeight = parseNum(taskObj?.weight, 0);
const list = activities[taskId] || [];
const sumOther = (Array.isArray(list) ? list : []).reduce((s, a) => {
if (excludeActivityId && String(a.id) === String(excludeActivityId)) return s;
return s + parseNum(a.weight, 0);
}, 0);
return { taskWeight, used: sumOther, available: Math.max(0, taskWeight - sumOther) };
},
[tasks, activities, parseNum]
);

const computeSystemWeightAvailable = useCallback(
(excludeGoalId = null) => {
const sumOther = (goals || []).reduce((s, g) => {
if (excludeGoalId && String(g.id) === String(excludeGoalId)) return s;
return s + parseNum(g.weight, 0);
}, 0);
const used = sumOther;
const available = Math.max(0, 100 - used);
return { used, available };
},
[goals, parseNum]
);

/**
* Helper to call submission handlers (onCreate, onUpdate) with
* different possible function signatures.
*/
const callHandler = async (fn, argsOptions = []) => {
if (typeof fn !== "function") throw new Error("Handler not provided");
const len = fn.length;
const tryList = argsOptions.slice();
const idx = tryList.findIndex((a) => a.length === len);
if (idx >= 0) {
try {
return await fn(...tryList[idx]);
} catch (e) {
// fallback to trying others
}
}
for (const args of tryList) {
try {
return await fn(...args);
} catch (e) {
// continue
}
}
return await fn(...(argsOptions[0] || []));
};

/**
* Main form submission handler.
* Validates data and calls the appropriate handler from props.
*/
const submitLocal = async (e) => {
if (e && typeof e.preventDefault === "function") e.preventDefault();
try {
setInlineError(null);

// rollNo validation
const rollVal = local.rollNo;
if (rollVal !== "" && rollVal !== undefined && rollVal !== null) {
const asNum = Number(rollVal);
if (!Number.isFinite(asNum) || !Number.isInteger(asNum) || asNum <= 0) {
setInlineError(t("project.errors.rollNoPositive") || "Roll number must be a positive integer");
return;
}
}

// Task weight validations
if (modal.type === "createTask" || modal.type === "editTask") {
const { goalId, id } = resolveIds(modal.data || {}); // `id` is taskId here
if (!goalId) {
setInlineError(t("project.errors.missingGoalId") || "Missing goal id");
return;
}
const newWeight = parseNum(local.weight, 0);
const excludeTaskId = modal.type === "editTask" ? id : null;
const { goalWeight, used, available } = computeGoalWeightAvailable(goalId, excludeTaskId);

if (newWeight <= 0) {
setInlineError(t("project.errors.weightPositive") || "Weight must be > 0");
return;
}
if (newWeight > available) {
setInlineError(t("project.errors.weightExceeds", { newWeight, goalWeight, used, available }) || `Weight ${newWeight} exceeds available ${available}`);
return;
}
}

// Activity weight validations
if (modal.type === "createActivity" || modal.type === "editActivity") {
const { taskId, id } = resolveIds(modal.data || {}); // `id` is activityId here
if (!taskId) {
setInlineError(t("project.errors.missingTaskId") || "Missing task id");
return;
}
const newWeight = parseNum(local.weight, 0);
const excludeActivityId = modal.type === "editActivity" ? id : null;
const { taskWeight, used, available } = computeTaskWeightAvailable(taskId, excludeActivityId);

if (newWeight <= 0) {
setInlineError(t("project.errors.weightPositive") || "Weight must be > 0");
return;
}
if (newWeight > available) {
setInlineError(t("project.errors.weightExceedsTask", { newWeight, taskWeight, used, available }) || `Weight ${newWeight} exceeds available ${available}`);
return;
}
}

// Goal weight validations
if (modal.type === "createGoal" || modal.type === "editGoal") {
const newWeight = parseNum(local.weight, 0);
if (newWeight <= 0) {
setInlineError(t("project.errors.weightPositive") || "Weight must be > 0");
return;
}
const excludeGoalId = modal.type === "editGoal" ? modal.data?.id : null;
const { used, available } = computeSystemWeightAvailable(excludeGoalId);
if (newWeight > available) {
setInlineError(t("project.errors.weightExceedsSystem", { newWeight, used, available }) || `Cannot set weight to ${newWeight}. System used ${used}, available ${available}.`);
return;
}
}

// --- Perform actions ---

// CREATE GOAL
if (modal.type === "createGoal") {
const payload = { ...local, groupId: local.groupId === "" ? null : Number(local.groupId) };
if (payload.rollNo === "") delete payload.rollNo;
await callHandler(onCreateGoal, [[payload]]);
return;
}

// EDIT GOAL
if (modal.type === "editGoal") {
const { id } = modal.data || {}; // `id` is goalId
const payload = { ...local, groupId: local.groupId === "" ? null : Number(local.groupId) };
if (payload.rollNo === "") delete payload.rollNo;
await callHandler(onUpdateGoal, [[id, payload], [payload]]);
return;
}

// CREATE TASK
if (modal.type === "createTask") {
const { goalId } = resolveIds(modal.data || {});
const payload = { ...local };
if (payload.rollNo === "") delete payload.rollNo;
await callHandler(onCreateTask, [[goalId, payload], [payload, goalId]]);
return;
}

// EDIT TASK
if (modal.type === "editTask") {
const { goalId, id } = resolveIds(modal.data || {});
if (!goalId || !id) {
setInlineError(t("project.errors.invalidIds") || "Invalid goal or task id");
return;
}
const payload = { ...local };
if (payload.rollNo === "") delete payload.rollNo;
await callHandler(onUpdateTask, [[goalId, id, payload], [id, payload], [payload, goalId, id]]);
return;
}

// Helper to convert array of {key, value} to object
const metricsToObject = (metricsArray) => {
const obj = {};
if (Array.isArray(metricsArray)) {
metricsArray.forEach((m) => {
if (m && String(m.key).trim() !== "") {
obj[String(m.key).trim()] = m.value ?? "";
}
});
}
return obj;
};

// CREATE ACTIVITY
if (modal.type === "createActivity") {
const { goalId, taskId } = resolveIds(modal.data || {});
const payload = { ...local };
// MODIFIED: Convert both metric arrays to objects
payload.targetMetric = metricsToObject(local.targetMetrics);
payload.previousMetric = metricsToObject(local.previousMetrics);
delete payload.targetMetrics;
delete payload.previousMetrics; // MODIFIED
if (payload.rollNo === "") delete payload.rollNo;
await callHandler(onCreateActivity, [[goalId, taskId, payload], [taskId, payload], [payload, taskId, goalId]]);
return;
}

// EDIT ACTIVITY
if (modal.type === "editActivity") {
const { goalId, taskId, id } = resolveIds(modal.data || {});
if (!taskId || !id) {
setInlineError(t("project.errors.missingTaskId") || "Missing task or activity id");
return;
}
const payload = { ...local };
// MODIFIED: Convert both metric arrays to objects
payload.targetMetric = metricsToObject(local.targetMetrics);
payload.previousMetric = metricsToObject(local.previousMetrics);
delete payload.targetMetrics;
delete payload.previousMetrics; // MODIFIED
if (payload.rollNo === "") delete payload.rollNo;
await callHandler(onUpdateActivity, [
[taskId, id, payload],
[goalId, taskId, id, payload],
[id, payload],
]);
return;
}
} catch (err) {
console.error("modal submit error", err);
setInlineError(err?.message || t("project.errors.modalSubmit") || "Submit failed");
}
};

if (!modal?.isOpen) return null;

const systemHint =
modal.type === "createGoal" || modal.type === "editGoal"
? (() => {
const excludeGoalId = modal.type === "editGoal" ? modal.data?.id : null;
const { used, available } = computeSystemWeightAvailable(excludeGoalId);
return { used, available };
})()
: null;

return (
<div
className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
role="dialog"
aria-modal="true"
aria-labelledby="generic-modal-title"
>
<div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded shadow-lg overflow-auto max-h-[90vh]">
<div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
<h3 id="generic-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
{modal.type === "createGoal" && t("project.modal.createGoal")}
{modal.type === "editGoal" && t("project.modal.editGoal")}
{modal.type === "createTask" && t("project.modal.createTask")}
{modal.type === "editTask" && t("project.modal.editTask")}
{modal.type === "createActivity" && t("project.modal.createActivity")}
{modal.type === "editActivity" && t("project.modal.editActivity")}
</h3>
<button
type="button"
onClick={() => setModal({ isOpen: false, type: null, data: null })}
className="text-gray-400 hover:text-gray-600"
aria-label={t("project.actions.close")}
>
×
</button>
</div>

<form onSubmit={submitLocal} className="px-4 py-4 space-y-3">
{(modal.type === "createActivity" || modal.type === "editActivity") && (
<>
<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.title")} *</label>
<input
ref={firstFieldRef}
name="title"
value={local.title || ""}
onChange={onLocalChange}
required
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>

<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.description")}</label>
<textarea
name="description"
value={local.description || ""}
onChange={onLocalChange}
rows="3"
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>

<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
<div>
<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.dueDate")}</label>
<input
name="dueDate"
value={local.dueDate || ""}
onChange={onLocalChange}
type="date"
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>
</div>
<div>
<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.weight")}</label>
<input
name="weight"
value={local.weight ?? 1}
onChange={onLocalChange}
type="number"
min="0.01"
step="any"
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>
</div>
</div>

<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.status")}</label>
<select
name="status"
value={local.status || "To Do"}
onChange={onLocalChange}
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
>
<option value="To Do">{t("project.status.toDo") || "To Do"}</option>
<option value="In Progress">{t("project.status.inProgress") || "In Progress"}</option>
<option value="Done">{t("project.status.completed") || "Done"}</option>
</select>

<div className="mt-2">
<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.labels.rollLabel")}</label>
<input
name="rollNo"
value={local.rollNo === "" ? "" : (local.rollNo ?? "")}
onChange={onLocalChange}
type="number"
min="1"
step="1"
placeholder={t("project.placeholders.rollNo") || "Leave empty to auto-assign"}
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>
<div className="text-xs text-gray-500 mb-1">{t("project.hints.hint")}</div>
</div>

{modal.data?.taskId && (
<div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
{(() => {
const resolved = resolveIds(modal.data || {});
const { taskWeight, used, available } = computeTaskWeightAvailable(resolved.taskId, modal.type === "editActivity" ? resolved.id : null);
return t("project.hints.taskWeight", { taskWeight, used, available });
})()}
</div>
)}

{/* --- MODIFIED: Added Previous Metrics Section --- */}
<div>
<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.labels.previousMetrics", "Previous Metrics")}</label>
<div className="mt-2 space-y-2">
{(Array.isArray(local.previousMetrics) ? local.previousMetrics : [{ id: "empty-prev-0", key: "", value: "" }]).map((m, idx) => (
<div key={m.id} className="flex gap-2">
<input
placeholder={t("project.placeholders.metricKey")}
value={m?.key || ""}
onChange={(e) => updatePreviousMetricRow(idx, "key", e.target.value)}
className="flex-1 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
/>
<input
type="number"
min={0}
placeholder={t("project.placeholders.metricValue")}
value={m?.value || ""}
onChange={(e) => updatePreviousMetricRow(idx, "value", e.target.value)}
className="flex-1 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
/>
<button
type="button"
onClick={() => removePreviousMetricRow(idx)}
className="px-2 py-1 bg-red-500 text-white rounded text-xs"
aria-label={t("project.actions.remove")}
>
{t("project.actions.removeShort")}
</button>
</div>
))}
</div>
<button type="button" onClick={addPreviousMetricRow} className="mt-2 px-2 py-1 bg-green-600 text-white rounded text-xs">
+ {t("project.actions.addMetric")}
</button>
</div>

{/* --- Target Metrics Section --- */}
<div>
<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.labels.targetMetrics")}</label>
<div className="mt-2 space-y-2">
{(Array.isArray(local.targetMetrics) ? local.targetMetrics : [{ id: "empty-0", key: "", value: "" }]).map((m, idx) => (
<div key={m.id} className="flex gap-2">
<input
placeholder={t("project.placeholders.metricKey")}
value={m?.key || ""}
onChange={(e) => updateMetricRow(idx, "key", e.target.value)}
className="flex-1 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
/>
<input
type="number"
min={0}
placeholder={t("project.placeholders.metricValue")}
value={m?.value || ""}
onChange={(e) => updateMetricRow(idx, "value", e.target.value)}
className="flex-1 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
/>
<button
type="button"
onClick={() => removeMetricRow(idx)}
className="px-2 py-1 bg-red-500 text-white rounded text-xs"
aria-label={t("project.actions.remove")}
>
{t("project.actions.removeShort")}
</button>
</div>
))}
</div>
<button type="button" onClick={addMetricRow} className="mt-2 px-2 py-1 bg-green-600 text-white rounded text-xs">
+ {t("project.actions.addMetric")}
</button>
{jsonError && <div className="text-xs text-red-500 mt-1">{jsonError}</div>}
</div>
</>
)}

{(modal.type === "createTask" || modal.type === "editTask") && (
<>
<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.title")} *</label>
<input
ref={firstFieldRef}
name="title"
value={local.title || ""}
onChange={onLocalChange}
required
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>

<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.description")}</label>
<textarea
name="description"
value={local.description || ""}
onChange={onLocalChange}
rows="3"
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>

<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.dueDate")}</label>
<input
name="dueDate"
value={local.dueDate || ""}
onChange={onLocalChange}
type="date"
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>

<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.labels.rollLabel")}</label>
<input
name="rollNo"
value={local.rollNo === "" ? "" : (local.rollNo ?? "")}
onChange={onLocalChange}
type="number"
min="1"
step="1"
placeholder={t("project.placeholders.rollNo") || "Leave empty to auto-assign"}
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>
<div className="text-xs text-gray-500 mb-1">{t("project.hints.hint")}</div>

<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.weight")}</label>
<input
name="weight"
value={local.weight ?? 1}
onChange={onLocalChange}
type="number"
min="0.01"
step="any"
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>

{/* ADDED: Task Status Dropdown */}
<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.status")}</label>
<select
name="status"
value={local.status || "To Do"}
onChange={onLocalChange}
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
>
<option value="To Do">{t("project.status.toDo") || "To Do"}</option>
<option value="In Progress">{t("project.status.inProgress") || "In Progress"}</option>
<option value="Done">{t("project.status.completed") || "Done"}</option>
<option value="Blocked">{t("project.status.blocked") || "Blocked"}</option>
</select>

{modal.data?.goalId && (
<div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
{(() => {
const { goalId, id } = resolveIds(modal.data || {});
const excludeTaskId = modal.type === "editTask" ? id : null;
const { goalWeight, used, available } = computeGoalWeightAvailable(modal.data.goalId, excludeTaskId);
return t("project.hints.goalWeight", { goalWeight, used, available });
})()}
</div>
)}
</>
)}

{(modal.type === "createGoal" || modal.type === "editGoal") && (
<>
<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.title")} *</label>
<input
ref={firstFieldRef}
name="title"
value={local.title || ""}
onChange={onLocalChange}
required
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>

<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.description")}</label>
<textarea
name="description"
value={local.description || ""}
onChange={onLocalChange}
rows="3"
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>

<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.assignGroup")}</label>
<select
name="groupId"
value={local.groupId ?? ""}
onChange={onLocalChange}
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
>
<option value="">{t("project.unassigned")}</option>
{groups.map((g) => (
<option key={g.id} value={String(g.id)}>
{g.name}
</option>
))}
</select>

<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
<div>
<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.startDate")}</label>
<input
name="startDate"
value={local.startDate || ""}
onChange={onLocalChange}
type="date"
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>
</div>
<div>
<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.endDate")}</label>
<input
name="endDate"
value={local.endDate || ""}
onChange={onLocalChange}
type="date"
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>
</div>
</div>

{/* ADDED: Goal Status Dropdown */}
<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.status")}</label>
<select
name="status"
value={local.status || "Not Started"}
onChange={onLocalChange}
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
>
<option value="Not Started">{t("project.status.notStarted") || "Not Started"}</option>
<option value="In Progress">{t("project.status.inProgress") || "In Progress"}</option>
<option value="On Hold">{t("project.status.onHold") || "On Hold"}</option>
<option value="Completed">{t("project.status.completed") || "Completed"}</option>
</select>

<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.labels.rollLabel")}</label>
<input
name="rollNo"
value={local.rollNo === "" ? "" : (local.rollNo ?? "")}
onChange={onLocalChange}
type="number"
min="1"
step="1"
placeholder={t("project.placeholders.rollNo") || "Leave empty to auto-assign"}
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>
<div className="text-xs text-gray-500 mb-1">{t("project.hints.hint")}</div>

<label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.weight")}</label>
<input
name="weight"
value={local.weight ?? 1}
onChange={onLocalChange}
type="number"
min="0.01"
step="any"
max="100"
className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>

{systemHint && (
<div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
{t("project.hints.systemWeight", { used: systemHint.used, available: systemHint.available }) ||
`System used: ${systemHint.used}, available: ${systemHint.available}`}
</div>
)}
</>
)}

{inlineError && <div className="text-sm text-red-600 dark:text-red-400">{inlineError}</div>}

<div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2 bg-white dark:bg-gray-800 sticky bottom-0">
<button
type="button"
onClick={() => setModal({ isOpen: false, type: null, data: null })}
className="px-3 py-2 rounded border bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
>
{t("project.actions.cancel")}
</button>
<button type="submit" disabled={isSubmitting} className="px-3 py-2 rounded bg-blue-600 text-white flex items-center disabled:opacity-50">
{isSubmitting ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
{modal.type && modal.type.startsWith("edit") ? t("project.actions.save") : t("project.actions.create")}
</button>
</div>
</form>
</div>
</div>
);
}
