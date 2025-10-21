// src/api/dashboard.js
import { api } from "./auth";

/**
 * Build a querystring from an object, skipping null/undefined/empty values.
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
 * Fetch dashboard summary.
 */
export const fetchDashboardSummary = async ({
  groupId = null,
  dateFrom = null,
  dateTo = null,
  status = null,
} = {}) => {
  const qs = buildQs({ groupId, dateFrom, dateTo, status });
  const res = await api(`/api/dashboard/summary${qs}`, "GET");

  // res may already be the summary object (or wrapped), so pass through raw into _raw
  // and map the exact keys your backend returns (and support common variants).
  return {
    overall_goal_progress: asString(res.overall_goal_progress ?? res.overallGoalProgress ?? "0"),
    overall_goal_delta: res.overall_goal_delta ?? res.overallGoalDelta ?? null,
    overall_task_progress: asString(res.overall_task_progress ?? res.overallTaskProgress ?? "0"),
    overall_activity_progress: asString(res.overall_activity_progress ?? res.overallActivityProgress ?? "0"),
    pending_reports: asString(res.pending_reports ?? res.pendingReports ?? "0"),

    // totals (exact keys from your JSON)
    goals_count: asString(res.goals_count ?? res.goalsCount ?? res.goals_total ?? "0"),
    tasks_count: asString(res.tasks_count ?? res.tasksCount ?? res.tasks_total ?? "0"),
    activities_count: asString(res.activities_count ?? res.activitiesCount ?? res.activities_total ?? "0"),

    // finished counts (these were missing before)
    goals_finished_count: asString(
      res.goals_finished_count ??
        res.goals_finished ??
        res.goalsFinished ??
        res.goalsFinishedCount ??
        "0"
    ),
    tasks_finished_count: asString(
      res.tasks_finished_count ??
        res.tasks_finished ??
        res.tasksFinished ??
        res.tasksFinishedCount ??
        "0"
    ),
    activities_finished_count: asString(
      res.activities_finished_count ??
        res.activities_finished ??
        res.activitiesFinished ??
        res.activitiesFinishedCount ??
        "0"
    ),

    // unread (common variants)
    unread: res.unread_notifications ?? res.unread ?? 0,

    // keep raw response for debugging
    _raw: res,
  };
};

/**
 * Fetch chart data.
 * IMPORTANT: when type === 'group', we normalize each item to:
 *   { groupId: string, name: string, progress: string }
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

  if (type === "group") {
    if (!Array.isArray(res)) return [];
    return res.map((item) => {
      const rawId = item.groupId ?? item.id ?? item.group_id ?? item.group ?? null;
      const groupIdStr = rawId !== null && rawId !== undefined ? String(rawId) : null;
      const name = item.name ?? item.label ?? item.groupName ?? "";
      const progress = asString(item.progress ?? item.value ?? 0);
      return {
        groupId: groupIdStr,
        name,
        progress,
        _raw: item,
      };
    });
  }

  if (type === "task") {
    if (!Array.isArray(res)) return [];
    return res.map((t) => ({
      taskId: t.taskId ?? t.id ?? null,
      label: t.title ?? t.label ?? t.name ?? "",
      progress: asString(t.progress ?? t.value ?? 0),
      _raw: t,
    }));
  }

  if (type === "reports") {
    // Support both: object { Pending: n } or array [{ label, count }]
    if (Array.isArray(res)) {
      return res.map((r) => ({ label: r.label, count: Number(r.count ?? r.value ?? 0), color: r.color }));
    }
    if (res && typeof res === "object") {
      return Object.keys(res).map((k) => ({ label: k, count: Number(res[k] ?? 0) }));
    }
    return [];
  }

  // history or other types: return as-is (caller expects array)
  return res;
};

/**
 * Fetch overdue tasks.
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
 * Notifications
 */
export const fetchNotifications = async ({ limit = 10, userId = null } = {}) => {
  const qs = buildQs({ limit, userId });
  const res = await api(`/api/dashboard/notifications${qs}`, "GET");
  return Array.isArray(res) ? res : res?.items ?? [];
};

/**
 * Mark notifications read (mark all or per-user)
 * NOTE: backend endpoint must exist. This calls POST /api/dashboard/notifications/mark-read
 */
export const markNotificationsRead = async ({ userId = null } = {}) => {
  const qs = buildQs({ userId });
  return api(`/api/dashboard/notifications/mark-read${qs}`, "POST");
};

/**
 * Audit logs (manager-only)
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
