// src/api/dashboard.js
import { api } from "./auth";

export const fetchDashboardSummary = async (groupId = null) => {
  const qs = groupId ? `?groupId=${encodeURIComponent(groupId)}` : "";
  const res = await api(`/api/dashboard/summary${qs}`, "GET");
  // ensure all values are strings
  return {
    overall_goal_progress: res.overall_goal_progress ?? "0",
    overall_task_progress: res.overall_task_progress ?? "0",
    overall_activity_progress: res.overall_activity_progress ?? "0",
    pending_reports: res.pending_reports ?? "0",
    goals_count: res.goals_count ?? "0",
    tasks_count: res.tasks_count ?? "0",
    activities_count: res.activities_count ?? "0"
  };
};

export const fetchDashboardCharts = async (type = "group", groupId = null) => {
  const qs = `?type=${encodeURIComponent(type)}${groupId ? `&groupId=${encodeURIComponent(groupId)}` : ""}`;
  const res = await api(`/api/dashboard/charts${qs}`, "GET");
  // ensure progress is string
  return res.map(item => ({
    ...item,
    progress: item.progress ?? "0"
  }));
};

export const fetchOverdueTasks = async (limit = 5, groupId = null) => {
  const qs = `?limit=${limit}${groupId ? `&groupId=${encodeURIComponent(groupId)}` : ""}`;
  return await api(`/api/dashboard/overdue${qs}`, "GET");
};
