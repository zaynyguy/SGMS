// src/api/dashboard.js
import { api } from "./auth";


/**
 * Build a querystring from an object, skipping null/undefined/empty values.
 * keys are encoded.
 */
const buildQs = (params = {}) => {
  const keys = Object.keys(params).filter(
    (k) => params[k] !== undefined && params[k] !== null && params[k] !== ""
  );
  if (!keys.length) return "";
  return (
    "?" +
    keys
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join("&")
  );
};

const asString = (v) => {
  if (v === null || v === undefined) return "0";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

/**
 * GET /api/dashboard/summary
 * Query params: groupId?, dateFrom?, dateTo?, status?
 * Returns a normalized object where counts/progress are strings for UI bindings.
 */
export const fetchDashboardSummary = async ({
  groupId = null,
  dateFrom = null,
  dateTo = null,
  status = null,
} = {}) => {
  const qs = buildQs({ groupId, dateFrom, dateTo, status });
  const res = await api(`/api/dashboard/summary${qs}`, "GET");

  // controller returns unread_notifications field (see controller),
  // and various numeric fields. Normalize them to strings for binding.
  return {
    overall_goal_progress: asString(res.overall_goal_progress ?? res.overall_goal_progress ?? "0"),
    overall_goal_delta: res.overall_goal_delta ?? null, // keep numeric if available
    overall_task_progress: asString(res.overall_task_progress ?? "0"),
    overall_activity_progress: asString(res.overall_activity_progress ?? "0"),
    pending_reports: asString(res.pending_reports ?? "0"),
    goals_count: asString(res.goals_count ?? "0"),
    tasks_count: asString(res.tasks_count ?? "0"),
    activities_count: asString(res.activities_count ?? "0"),
    // controller uses unread_notifications name
    unread: res.unread_notifications ?? res.unread ?? 0,
    // include raw payload for any extra fields
    _raw: res,
  };
};

/**
 * GET /api/dashboard/charts
 * Query params: type=group|task|reports|history, groupId?, dateFrom?, dateTo?, top?
 *
 * Normalizes common fields:
 *  - For type=group: returns [{ groupId, name, progress }] with progress as string
 *  - For type=task: returns [{ taskId, title, progress }] with progress string
 *  - For type=reports: controller returns an object {Pending: n, Approved: n, Rejected: n}
 *      — this helper returns an array [{ label, count }]
 */
export const fetchDashboardCharts = async ({
  type = "group",
  groupId = null,
  dateFrom = null,
  dateTo = null,
  top = null,
} = {}) => {
  const qs = buildQs({ type, groupId, dateFrom, dateTo, top });
  const res = await api(`/api/dashboard/charts${qs}`, "GET");

  // type-specific normalization
  if (type === "group") {
    if (!Array.isArray(res)) return [];
    return res.map((g) => ({
      groupId: g.groupId ?? g.id ?? null,
      name: g.name ?? g.label ?? "",
      progress: asString(g.progress ?? g.value ?? "0"),
    }));
  }

  if (type === "task") {
    if (!Array.isArray(res)) return [];
    return res.map((t) => ({
      taskId: t.taskId ?? t.id ?? null,
      label: t.title ?? t.label ?? t.name ?? "",
      progress: asString(t.progress ?? t.value ?? "0"),
    }));
  }

  if (type === "reports") {
    // controller returns an object like { Pending: n, Approved: n, Rejected: n }
    // some backends may return array of { label, count } — support both.
    if (Array.isArray(res)) {
      return res.map((r) => ({ label: r.label, count: Number(r.count ?? r.value ?? 0) }));
    }
    if (typeof res === "object" && res !== null) {
      const labels = Object.keys(res);
      return labels.map((lbl) => ({ label: lbl, count: Number(res[lbl] ?? 0) }));
    }
    return [];
  }

  // history and others: pass through
  return res;
};

/**
 * GET /api/dashboard/overdue
 * Query params: limit?, groupId?
 * Controller returns rows with fields like taskId, taskTitle, dueDate, days_overdue, assigneeName, groupName.
 */
export const fetchOverdueTasks = async ({ limit = 5, groupId = null } = {}) => {
  const qs = buildQs({ limit, groupId });
  const res = await api(`/api/dashboard/overdue${qs}`, "GET");

  if (!Array.isArray(res)) return [];
  return res.map((r) => ({
    id: r.taskId ?? r.id,
    taskTitle: r.taskTitle ?? r.title ?? "",
    dueDate: r.dueDate ?? r.due_date ?? null,
    daysOverdue: r.days_overdue ?? r.daysOverdue ?? 0,
    assigneeId: r.assigneeId ?? null,
    assigneeName: r.assigneeName ?? r.assignee_name ?? "",
    assigneeAvatar: r.assigneeAvatar ?? r.avatar ?? null,
    goalId: r.goalId ?? null,
    goalTitle: r.goalTitle ?? r.goal_title ?? "",
    groupId: r.groupId ?? null,
    groupName: r.groupName ?? r.group_name ?? "",
    _raw: r,
  }));
};

/**
 * GET /api/dashboard/notifications
 * Query params: limit?, userId?
 * Controller returns array of notifications.
 */
export const fetchNotifications = async ({ limit = 10, userId = null } = {}) => {
  const qs = buildQs({ limit, userId });
  const res = await api(`/api/dashboard/notifications${qs}`, "GET");
  if (!Array.isArray(res)) return res?.items ?? [];
  return res;
};

/**
 * GET /api/dashboard/audit
 * Query params: limit?
 * Requires manage_dashboard permission server-side; UI should hide audit panel unless permitted.
 */
export const fetchAuditLogs = async ({ limit = 25 } = {}) => {
  const qs = buildQs({ limit });
  const res = await api(`/api/dashboard/audit${qs}`, "GET");
  if (!Array.isArray(res)) return [];
  return res.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.userName ?? (r.user && r.user.name) ?? "",
    action: r.action,
    entity: r.entity,
    entityId: r.entityId ?? r._entityId,
    details: r.details ?? null,
    createdAt: r.createdAt ?? r.time ?? null,
    _raw: r,
  }));
};

/**
 * Optional drilldown helpers — the controller you posted doesn't include these endpoints,
 * but typical dashboard flows use them. If your backend exposes /api/goals, /api/tasks etc. keep them.
 */
export const fetchGoals = async (qsParams = {}) => {
  const qs = buildQs(qsParams);
  return await api(`/api/goals${qs}`, "GET");
};

export const fetchTasks = async (qsParams = {}) => {
  const qs = buildQs(qsParams);
  return await api(`/api/tasks${qs}`, "GET");
};

export const fetchActivities = async (qsParams = {}) => {
  const qs = buildQs(qsParams);
  return await api(`/api/activities${qs}`, "GET");
};

export const fetchReports = async (qsParams = {}) => {
  const qs = buildQs(qsParams);
  return await api(`/api/reports${qs}`, "GET");
};
