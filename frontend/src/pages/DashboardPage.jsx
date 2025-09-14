// src/pages/DashboardPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  fetchDashboardSummary,
  fetchDashboardCharts,
  fetchOverdueTasks,
  fetchNotifications,
  fetchAuditLogs,
} from "../api/dashboard";
import { markAllNotificationsRead } from "../api/notifications";

// --- Small UI helpers ---
const LoadingSkeleton = ({ className = "h-6 bg-gray-200 rounded animate-pulse" }) => (
  <div className={className} aria-hidden />
);

const Card = ({ title, children, onClick, className = "" }) => (
  <button
    onClick={onClick}
    className={`text-left p-4 rounded-2xl shadow-sm bg-white hover:shadow-md focus:shadow-outline focus:outline-none ${className}`}
    aria-label={title}
  >
    <div className="text-sm text-gray-500 mb-2">{title}</div>
    <div>{children}</div>
  </button>
);

function formatDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  return dt.toLocaleDateString();
}

const GroupBarChart = ({ data = [], height = 120 }) => {
  if (!data.length) return <div className="text-sm text-gray-500">No chart data</div>;
  const max = Math.max(...data.map((d) => Number(d.value ?? d.progress ?? 0)), 1);
  const barWidth = Math.max(12, Math.floor(300 / Math.max(1, data.length)));
  return (
    <svg viewBox={`0 0 ${data.length * barWidth} ${height}`} className="w-full h-32">
      {data.map((d, i) => {
        const val = Number(d.value ?? d.progress ?? 0);
        const h = (val / max) * (height - 20);
        const x = i * barWidth + 4;
        const y = height - h - 8;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth - 8} height={h} rx="4" fill="currentColor" className="text-indigo-500" />
            <text
              x={x + (barWidth - 8) / 2}
              y={height - 2}
              fontSize="10"
              textAnchor="middle"
              fill="currentColor"
              className="text-gray-600"
            >
              {d.name ?? d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const PieChart = ({ slices = [] }) => {
  if (!slices.length) return <div className="text-sm text-gray-500">No data</div>;
  const total = slices.reduce((s, x) => s + Number(x.value ?? x.count ?? 0), 0) || 1;
  let angle = 0;
  const cx = 60, cy = 60, r = 50;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      {slices.map((s, i) => {
        const portion = Number(s.value ?? s.count ?? 0) / total;
        const startAngle = angle;
        const endAngle = angle + portion * Math.PI * 2;
        angle = endAngle;
        const large = endAngle - startAngle > Math.PI ? 1 : 0;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
        return <path key={i} d={d} fill={s.color || `hsl(${(i * 70) % 360}, 70%, 60%)`} stroke="#fff" strokeWidth="1" />;
      })}
    </svg>
  );
};

// --- Table / Panels ---
const OverdueTable = ({ rows = [], loading }) => {
  if (loading) return <LoadingSkeleton className="h-48 w-full" />;
  if (!rows.length) return <div className="p-4 text-sm text-gray-500">No overdue tasks.</div>;
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-gray-500 bg-gray-50">
          <tr>
            <th className="p-2">Task</th>
            <th className="p-2">Due</th>
            <th className="p-2">Days overdue</th>
            <th className="p-2">Assignee</th>
            <th className="p-2">Goal</th>
            <th className="p-2">Group</th>
            <th className="p-2">Link</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t hover:bg-gray-50">
              <td className="p-2">{r.taskTitle}</td>
              <td className="p-2">{formatDate(r.dueDate)}</td>
              <td className="p-2">
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">{r.daysOverdue}</span>
              </td>
              <td className="p-2 flex items-center gap-2">
                {r.assigneeAvatar && <img src={r.assigneeAvatar} alt="" className="w-6 h-6 rounded-full" />}
                <span>{r.assigneeName}</span>
              </td>
              <td className="p-2">{r.goalTitle}</td>
              <td className="p-2">{r.groupName}</td>
              <td className="p-2">
                <a href={`/tasks/${r.id}`} className="text-indigo-600 hover:underline font-medium">Open</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const NotificationsPanel = ({ notifications = [], unread = 0, loading, onMarkAsRead, marking }) => {
  if (loading) return <LoadingSkeleton className="h-40 w-full" />;
  if (!notifications.length) return <div className="p-4 text-sm text-gray-500">No notifications</div>;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold">Recent Notifications</h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white bg-red-500 px-2 py-0.5 rounded-full">{unread}</span>
          {unread > 0 && (
            <button 
  onClick={onMarkAsRead}
  disabled={marking}
  className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
>
  {marking ? "Marking..." : "Mark all read"}
</button>

          )}
        </div>
      </div>
      <ul className="space-y-2">
        {notifications.map((n) => (
          <li key={n.id} className={`p-3 rounded-lg border ${n.isRead ? "border-gray-200" : "border-indigo-200 bg-indigo-50"}`}>
            <div className="text-sm mb-1">{n.message || n.type}</div>
            <div className="text-xs text-gray-400">{new Date(n.createdAt || n.time || n._raw?.createdAt).toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};

const AuditPanel = ({ logs = [], loading, auditPermDenied = false }) => {
  if (loading) return <LoadingSkeleton className="h-40 w-full" />;
  if (auditPermDenied) return <div className="p-4 text-sm text-gray-500">You do not have permission to view audit logs.</div>;
  if (!logs.length) return <div className="p-4 text-sm text-gray-500">No audit logs.</div>;
  return (
    <div>
      <h4 className="font-semibold mb-3">Recent Audit</h4>
      <ul className="space-y-2">
        {logs.map((l) => (
          <li key={l.id} className="p-3 bg-white rounded-lg border border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-medium text-gray-900">{l.userName || `User ${l.userId}`}</span>
                <span className="text-gray-700"> {l.action} </span>
                <span className="text-gray-500">{l.entity}</span>
              </div>
              <div className="text-xs text-gray-400 whitespace-nowrap">{new Date(l.createdAt || l._raw?.createdAt).toLocaleString()}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

// --- Main Dashboard Component ---
export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState({
    summary: null,
    groupBars: [],
    taskBars: [],
    reportsPie: [],
    overdueRows: [],
    notifications: [],
    auditLogs: [],
    groups: [],
  });

  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ group: "", dateFrom: "", dateTo: "", status: "" });
  const [error, setError] = useState(null);
  const [auditPermDenied, setAuditPermDenied] = useState(false);
  const [marking, setMarking] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    setAuditPermDenied(false);

    try {
      const results = await Promise.allSettled([
        fetchDashboardSummary({ groupId: filters.group, dateFrom: filters.dateFrom, dateTo: filters.dateTo, status: filters.status }),
        fetchDashboardCharts({ type: "group", groupId: filters.group, dateFrom: filters.dateFrom, dateTo: filters.dateTo }),
        fetchDashboardCharts({ type: "task", groupId: filters.group, top: 8 }),
        fetchDashboardCharts({ type: "reports", groupId: filters.group }),
        fetchOverdueTasks({ limit: 10, groupId: filters.group }),
        fetchNotifications({ limit: 5 }),
        fetchAuditLogs({ limit: 5 }),
      ]);

      const [summaryRes, groupRes, taskRes, reportsRes, overdueRes, notifsRes, auditRes] = results;

      const newData = {
        summary: summaryRes.status === "fulfilled" ? summaryRes.value : null,
        groupBars: groupRes.status === "fulfilled" ? groupRes.value : [],
        taskBars: taskRes.status === "fulfilled" ? taskRes.value : [],
        reportsPie:
          reportsRes.status === "fulfilled"
            ? Array.isArray(reportsRes.value)
              ? reportsRes.value.map((x) => ({ label: x.label, count: Number(x.count ?? x.value ?? 0), color: x.color }))
              : Object.keys(reportsRes.value || {}).map((k) => ({ label: k, count: Number(reportsRes.value[k] ?? 0) }))
            : [],
        overdueRows: overdueRes.status === "fulfilled" ? overdueRes.value : [],
        notifications: notifsRes.status === "fulfilled" ? notifsRes.value : [],
        auditLogs: auditRes.status === "fulfilled" ? auditRes.value : [],
      };

      newData.groups = Array.isArray(newData.groupBars) ? newData.groupBars.map((g) => ({ groupId: g.groupId ?? g.id, name: g.name })) : [];

      if (auditRes.status === "rejected") {
        const reason = auditRes.reason;
        if (reason && reason.status === 403) setAuditPermDenied(true);
        else console.warn("Audit fetch failed", reason);
      }

      setDashboardData(newData);

      const errors = [
        summaryRes.status === "rejected" && "Summary data",
        groupRes.status === "rejected" && "Group charts",
        taskRes.status === "rejected" && "Task charts",
        reportsRes.status === "rejected" && "Reports data",
        overdueRes.status === "rejected" && "Overdue tasks",
        notifsRes.status === "rejected" && "Notifications",
        auditRes.status === "rejected" && "Audit logs",
      ].filter(Boolean);

      if (errors.length) setError(`Failed to load: ${errors.join(", ")}`);
    } catch (err) {
      console.error("Unexpected dashboard error", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleRefresh = () => loadAll();

const handleMarkNotificationsRead = async () => {
  try {
    await markAllNotificationsRead();
    setDashboardData((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
      summary: prev.summary ? { ...prev.summary, unread: 0 } : null,
    }));
  } catch (err) {
    console.error("❌ Failed to mark notifications read:", err);
  }
};

  const goalDelta = useMemo(() => {
    if (!dashboardData.summary) return null;
    const d = dashboardData.summary.overall_goal_delta ?? null;
    if (d == null) return null;
    const sign = d >= 0 ? "+" : "";
    return `${sign}${d}%`;
  }, [dashboardData.summary]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <div className="flex gap-2 items-center">
            <button
              onClick={handleRefresh}
              className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 shadow-sm hover:bg-gray-50 flex items-center gap-2"
              aria-label="Refresh dashboard"
              disabled={loading}
            >
              <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* BENTO GRID */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Top cards */}
        <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card title="Goals progress">
            {loading ? (
              <LoadingSkeleton className="h-8 w-24" />
            ) : (
              <div>
                <div className="text-3xl font-bold text-gray-900">{dashboardData.summary?.overall_goal_progress ?? "-"}%</div>
                <div className="text-sm text-gray-500 mt-1">{goalDelta ? <span className={goalDelta.startsWith("+") ? "text-green-600" : "text-red-600"}>{goalDelta} from last month</span> : "No comparison data"}</div>
              </div>
            )}
          </Card>

          <Card title="Tasks progress">
            {loading ? (
              <LoadingSkeleton className="h-8 w-24" />
            ) : (
              <div>
                <div className="text-3xl font-bold text-gray-900">{dashboardData.summary?.overall_task_progress ?? "-"}%</div>
                <div className="text-sm text-gray-500">Tasks completed</div>
              </div>
            )}
          </Card>

          <Card title="Activities progress">
            {loading ? (
              <LoadingSkeleton className="h-8 w-24" />
            ) : (
              <div>
                <div className="text-3xl font-bold text-gray-900">{dashboardData.summary?.overall_activity_progress ?? "-"}%</div>
                <div className="text-sm text-gray-500">Activity health</div>
              </div>
            )}
          </Card>

          <Card title="Pending Reports">
            {loading ? (
              <LoadingSkeleton className="h-8 w-24" />
            ) : (
              <div>
                <div className="text-3xl font-bold text-gray-900">{dashboardData.summary?.pending_reports ?? 0}</div>
                <div className="text-sm text-gray-500">Click to open reports</div>
              </div>
            )}
          </Card>
        </div>

        {/* Charts */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-white shadow-sm border border-gray-100">
            <div className="text-sm text-gray-500 mb-3 font-medium">Group progress</div>
            {loading ? <LoadingSkeleton className="h-28" /> : <GroupBarChart data={(dashboardData.groupBars || []).map((g) => ({ name: g.name, progress: g.progress }))} />}
          </div>

          <div className="p-5 rounded-2xl bg-white shadow-sm border border-gray-100">
            <div className="text-sm text-gray-500 mb-3 font-medium">Top tasks</div>
            {loading ? (
              <LoadingSkeleton className="h-28" />
            ) : (
              <ul className="space-y-3">
                {(dashboardData.taskBars || []).slice(0, 6).map((t, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <div className="text-sm text-gray-700 truncate max-w-[70%]">{t.label}</div>
                    <div className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-700 rounded-full">{t.progress}%</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-white shadow-sm border border-gray-100">
            <div className="text-sm text-gray-500 mb-3 font-medium">Reports distribution</div>
            {loading ? <LoadingSkeleton className="h-28" /> : <div className="flex justify-center"><PieChart slices={(dashboardData.reportsPie || []).map((r) => ({ value: r.count, label: r.label, color: r.color }))} /></div>}
          </div>
        </div>

        {/* Overdue + Notifications */}
        <div className="lg:col-span-8">
          <div className="p-5 rounded-2xl bg-white shadow-sm border border-gray-100 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Overdue tasks</h3>
              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">{dashboardData.overdueRows.length} tasks</span>
            </div>
            <OverdueTable rows={dashboardData.overdueRows} loading={loading} />
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="p-5 rounded-2xl bg-white shadow-sm border border-gray-100 h-full">
            <NotificationsPanel
  notifications={dashboardData.notifications}
  unread={dashboardData.summary?.unread || 0}
  loading={loading}
  onMarkAsRead={handleMarkNotificationsRead}
  marking={marking}
/>
          </div>
        </div>

        {/* Audit panel (always visible; backend enforces permission) */}
        <div className="lg:col-span-12">
          <div className="p-5 rounded-2xl bg-white shadow-sm border border-gray-100">
            <AuditPanel logs={dashboardData.auditLogs} loading={loading} auditPermDenied={auditPermDenied} />
          </div>
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {loading ? "Loading dashboard data" : "Dashboard data loaded"}
      </div>
    </div>
  );
}
