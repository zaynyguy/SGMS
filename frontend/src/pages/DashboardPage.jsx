// src/pages/DashboardPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  fetchDashboardSummary,
  fetchDashboardCharts,
  fetchOverdueTasks,
  fetchNotifications,
  fetchAuditLogs,
} from "../api/dashboard";
import { markAllNotificationsRead } from "../api/notifications";
import { api } from "../api/auth";
import TopBar from "../components/layout/TopBar";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";

/* ---------------------------
   Small UI helpers & modal
   --------------------------- */

const LoadingSkeleton = ({ className = "h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" }) => (
  <div className={className} aria-hidden />
);

const Modal = ({ open, onClose, children, title }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-auto bg-white dark:bg-gray-900 rounded-lg shadow-2xl p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};

/* Card: now clickable and keyboard accessible */
const Card = ({ title, children, onClick, className = "", ariaLabel }) => {
  const clickable = Boolean(onClick);
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={(e) => clickable && onClick(e)}
      onKeyDown={(e) => {
        if (!clickable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(e);
        }
      }}
      aria-label={ariaLabel || title}
      className={`text-left p-4 rounded-2xl bg-white dark:bg-gray-800 shadow-sm transition-transform transform ${clickable ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-400" : ""} ${className}`}
    >
      <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2">{title}</div>
      <div>{children}</div>
    </div>
  );
};

/* ---------------------------
   Small format helpers
   --------------------------- */
function formatDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  return dt.toLocaleDateString();
}

/* ---------------------------
   Charts (group, task, pie)
   --------------------------- */

const GroupBarChart = ({ data = [], height = 120, limit = null }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">No chart data</div>;
  }
  const display = limit ? data.slice(0, limit) : data;
  const values = display.map((d) => Number(d.value ?? d.progress ?? 0));
  const max = Math.max(1, ...values);
  const barWidth = Math.max(28, Math.floor(320 / Math.max(1, display.length)) - 2);
  const svgWidth = Math.max(display.length * barWidth, 240);
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${svgWidth} ${height + 40}`} className="w-full h-[200px]" preserveAspectRatio="xMidYMid meet" role="img">
        <line x1="0" y1={height} x2={svgWidth} y2={height} stroke="#E5E7EB" className="dark:stroke-gray-700" strokeWidth="1" />
        {display.map((d, i) => {
          const val = Number(d.value ?? d.progress ?? 0);
          const barH = Math.max(2, (val / max) * (height - 16));
          const x = i * barWidth + Math.floor(barWidth * 0.12);
          const w = Math.floor(barWidth * 0.76);
          const y = height - barH;
          const color = d.color || `hsl(${(i * 45) % 360}, 70%, 50%)`;
          const label = d.name ?? d.label ?? `#${i + 1}`;
          return (
            <g key={i} transform={`translate(${x},0)`}>
              <rect x={0} y={y} width={w} height={barH} rx="6" fill={color} />
              <text x={w / 2} y={height + 14} fontSize="11" textAnchor="middle" fill="#6B7280" className="text-xs dark:fill-gray-400" style={{ whiteSpace: "nowrap" }}>
                {label.length > 12 ? `${label.slice(0, 11)}…` : label}
              </text>
            </g>
          );
        })}
      </svg>
      {limit && data.length > limit && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">+{data.length - limit} more</div>
      )}
    </div>
  );
};

const GroupHorizontalModalView = ({ data = [] }) => {
  if (!data || !data.length) return <div className="text-sm text-gray-500 dark:text-gray-400">No groups</div>;
  const max = Math.max(1, ...data.map((d) => Number(d.value ?? d.progress ?? 0)));
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-6 items-end pb-4">
        {data.map((g, idx) => {
          const val = Number(g.value ?? g.progress ?? 0);
          const pct = Math.round((val / max) * 100);
          const color = g.color || `hsl(${(idx * 45) % 360},70%,50%)`;
          return (
            <div key={g.groupId ?? g.id ?? idx} className="flex flex-col items-center min-w-[84px]">
              <div className="w-12 h-32 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden flex items-end">
                <div style={{ height: `${Math.max(6, (pct / 100) * 100)}%`, background: color }} className="w-full transition-all" />
              </div>
              <div className="text-sm text-center text-gray-700 dark:text-gray-300 mt-2 truncate max-w-[88px]">{g.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{val}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TaskBarChart = ({ items = [], maxItems = 8 }) => {
  if (!items || !items.length) return <div className="text-sm text-gray-500 dark:text-gray-400">No tasks</div>;
  const display = items.slice(0, maxItems);
  return (
    <div className="space-y-3">
      {display.map((it, idx) => {
        const value = Math.max(0, Math.min(100, Math.round(Number(it.progress ?? it.value ?? 0))));
        const color = it.color || `hsl(${(idx * 50) % 360},70%,50%)`;
        return (
          <div key={idx} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{it.label}</div>
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 ml-2">{value}%</div>
              </div>

              <div className="mt-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={`${it.label} progress`}>
                <div title={`${it.label}: ${value}%`} style={{ width: `${value}%`, background: color }} className="h-3 rounded-full transition-all" />
              </div>
            </div>
          </div>
        );
      })}
      {items.length > maxItems && <div className="text-xs text-gray-500 dark:text-gray-400">+{items.length - maxItems} more</div>}
    </div>
  );
};

const PieChart = ({ slices = [], size = 220 }) => {
  if (!slices || !slices.length) return <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>;
  const total = slices.reduce((s, x) => s + Number(x.value ?? x.count ?? 0), 0) || 1;
  let angle = 0;
  const cx = size / 2, cy = size / 2, r = Math.min(60, size / 2 - 8);
  return (
    <div className="flex md:flex-col flex-row items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
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
          return <path key={i} d={d} fill={s.color || `hsl(${(i * 70) % 360}, 70%, 60%)`} stroke="#fff" className="dark:stroke-gray-800" strokeWidth="1" />;
        })}
        <circle cx={cx} cy={cy} r={r - 18} fill="#fff" className="dark:fill-gray-800" />
        <text x={cx} y={cy} textAnchor="middle" dy="6" fontSize="14" className="text-gray-900 dark:text-gray-100 font-semibold">{total}</text>
      </svg>

      <div className="flex-1 min-w-0">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-1">
          {slices.map((s, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span style={{ background: s.color || `hsl(${(i * 70) % 360}, 70%, 60%)` }} className="w-3 h-3 rounded-sm inline-block flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="truncate text-gray-700 dark:text-gray-300">{s.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 ml-2">({Math.round(((s.value ?? s.count ?? 0) / total) * 100)}%)</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ---------------------------
   Overdue / Notifications / Audit
   --------------------------- */

const OverdueTable = ({ rows = [], loading, t }) => {
  if (loading) return <LoadingSkeleton className="h-48 w-full" />;
  if (!rows.length) return <div className="p-4 text-sm text-gray-500 dark:text-gray-400">{t("dashboard.noOverdue")}</div>;
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="p-2">{t("dashboard.table.task")}</th>
            <th className="p-2">{t("dashboard.table.due")}</th>
            <th className="p-2">{t("dashboard.table.daysOverdue")}</th>
            <th className="p-2">{t("dashboard.table.assignee")}</th>
            <th className="p-2">{t("dashboard.table.goal")}</th>
            <th className="p-2">{t("dashboard.table.group")}</th>
            <th className="p-2">{t("dashboard.table.link")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="p-2 dark:text-gray-300">{r.taskTitle}</td>
              <td className="p-2 dark:text-gray-300">{formatDate(r.dueDate)}</td>
              <td className="p-2">
                <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-xs">{r.daysOverdue}</span>
              </td>
              <td className="p-2 flex items-center gap-2">
                {r.assigneeAvatar && <img src={r.assigneeAvatar} alt="" className="w-6 h-6 rounded-full" />}
                <span className="dark:text-gray-300">{r.assigneeName}</span>
              </td>
              <td className="p-2 dark:text-gray-300">{r.goalTitle}</td>
              <td className="p-2 dark:text-gray-300">{r.groupName}</td>
              <td className="p-2">
                <a
                  href={`/tasks/${r.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  {t("dashboard.open")}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const NotificationsPanel = ({ notifications = [], unread = 0, loading, onMarkAsRead, marking, t, navigate }) => {
  if (loading) return <LoadingSkeleton className="h-40 w-full" />;
  if (!notifications.length) return <div className="p-4 text-sm text-gray-500 dark:text-gray-400">{t("dashboard.noNotifications")}</div>;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white bg-red-500 px-2 py-0.5 rounded-full">{unread}</span>
          {unread > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onMarkAsRead(); }}
              disabled={marking}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
            >
              {marking ? t("dashboard.notifications.marking") : t("dashboard.notifications.markAll")}
            </button>
          )}
        </div>
      </div>
      <ul className="space-y-2">
        {notifications.map((n) => (
          <li key={n.id}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (n.url) {
                  window.location.href = n.url;
                } else {
                  navigate("/notification");
                }
              }}
              className={`w-full text-left p-3 rounded-lg border ${n.isRead ? "border-gray-200 dark:border-gray-700" : "border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30"} hover:shadow-sm transition`}
            >
              <div className="text-sm mb-1 dark:text-gray-300">{n.message || n.type}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">{new Date(n.createdAt || n.time || n._raw?.createdAt).toLocaleString()}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const AuditPanel = ({ logs = [], loading, auditPermDenied = false, t }) => {
  if (loading) return <LoadingSkeleton className="h-40 w-full" />;
  if (auditPermDenied) return <div className="p-4 text-sm text-gray-500 dark:text-gray-400">{t("dashboard.audit.noPermission")}</div>;
  if (!logs.length) return <div className="p-4 text-sm text-gray-500 dark:text-gray-400">{t("dashboard.audit.noLogs")}</div>;
  return (
    <div>
      <ul className="space-y-2">
        {logs.map((l) => (
          <li key={l.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-medium text-gray-900 dark:text-gray-300">{l.userName || `User ${l.userId}`}</span>
                <span className="text-gray-700 dark:text-gray-400"> {l.action} </span>
                <span className="text-gray-500 dark:text-gray-500"> {l.entity}</span>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{new Date(l.createdAt || l._raw?.createdAt).toLocaleString()}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* ---------------------------
   Main Dashboard Component
   --------------------------- */

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

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

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);

  const loadAll = useCallback(async () => {
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
        groupBars: groupRes.status === "fulfilled" ? (Array.isArray(groupRes.value) ? groupRes.value : []) : [],
        taskBars: taskRes.status === "fulfilled" ? (Array.isArray(taskRes.value) ? taskRes.value : []) : [],
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

      newData.groups = Array.isArray(newData.groupBars) ? newData.groupBars.map((g) => ({ groupId: g.groupId ?? g.id, name: g.name, value: g.progress ?? g.value ?? 0, color: g.color })) : [];

      if (auditRes.status === "rejected") {
        const reason = auditRes.reason;
        if (reason && reason.status === 403) setAuditPermDenied(true);
      }

      setDashboardData(newData);

      const errors = [
        summaryRes.status === "rejected" && t("dashboard.errors.summary"),
        groupRes.status === "rejected" && t("dashboard.errors.groupCharts"),
        taskRes.status === "rejected" && t("dashboard.errors.taskCharts"),
        reportsRes.status === "rejected" && t("dashboard.errors.reports"),
        overdueRes.status === "rejected" && t("dashboard.errors.overdue"),
        notifsRes.status === "rejected" && t("dashboard.errors.notifications"),
        auditRes.status === "rejected" && t("dashboard.errors.audit"),
      ].filter(Boolean);

      if (errors.length) setError(t("dashboard.failedLoadPrefix") + errors.join(", "));
    } catch (err) {
      console.error("Unexpected dashboard error", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRefresh = () => loadAll();

  const handleMarkNotificationsRead = async () => {
    setMarking(true);
    try {
      try {
        await markAllNotificationsRead();
      } catch (err) {
        console.warn("markAllNotificationsRead helper failed, falling back to api()", err);
        await api("/api/notifications/mark-all-read", "POST");
      }
      setDashboardData((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => ({ ...n, read: true })),
        summary: prev.summary ? { ...prev.summary, unread: 0 } : null,
      }));
    } catch (err) {
      console.error("❌ Failed to mark notifications read:", err);
    } finally {
      setMarking(false);
    }
  };

  const goalDelta = useMemo(() => {
    if (!dashboardData.summary) return null;
    const d = dashboardData.summary.overall_goal_delta ?? null;
    if (d == null) return null;
    const sign = d >= 0 ? "+" : "";
    return `${sign}${d}%`;
  }, [dashboardData.summary]);

  // navigation helpers for KPI cards
  const goToGoals = () => navigate("/project?tab=goals");
  const goToTasks = () => navigate("/project?tab=tasks");
  const goToActivities = () => navigate("/project?tab=activities");
  const goToPendingReports = () => navigate("/report?status=Pending");
  const goToNotifications = () => navigate("/notification");
  const goToAudit = () => navigate("/auditLog");

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gray-200 dark:bg-gray-900 min-h-screen transition-colors duration-300">
      {/* Header: title + TopBar on same line even on narrow screens */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center min-w-0 gap-4">
          <div className="p-3 rounded-lg bg-white dark:bg-gray-800">
                        <Home className="h-6 w-6 text-sky-600 dark:text-sky-300" />
                      </div>
          <div>
            <h1 className="flex text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white truncate">{t("dashboard.title")}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{t("dashboard.subtitle")}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
            aria-label={t("dashboard.aria.refresh")}
            disabled={loading}
          >
            <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">{t("dashboard.refresh")}</span>
          </button>

          <div className="flex items-center"><TopBar /></div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* BENTO GRID */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Top KPI cards (clickable) */}
        <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card title={t("dashboard.cards.goals.title")} onClick={goToGoals} ariaLabel={t("dashboard.cards.goals.aria")}>
            {loading ? (
              <LoadingSkeleton className="h-8 w-24" />
            ) : (
              <div>
                <div className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                  {dashboardData.summary?.overall_goal_progress ?? "-"}%
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {goalDelta ? <span className={goalDelta.startsWith("+") ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>{goalDelta} {t("dashboard.cards.goals.fromLast")}</span> : t("dashboard.cards.goals.noComparison")}
                </div>
              </div>
            )}
          </Card>

          <Card title={t("dashboard.cards.tasks.title")} onClick={goToTasks} ariaLabel={t("dashboard.cards.tasks.aria")}>
            {loading ? (
              <LoadingSkeleton className="h-8 w-24" />
            ) : (
              <div>
                <div className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                  {dashboardData.summary?.overall_task_progress ?? "-"}%
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("dashboard.cards.tasks.subtitle")}</div>
              </div>
            )}
          </Card>

          <Card title={t("dashboard.cards.activities.title")} onClick={goToActivities} ariaLabel={t("dashboard.cards.activities.aria")}>
            {loading ? (
              <LoadingSkeleton className="h-8 w-24" />
            ) : (
              <div>
                <div className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                  {dashboardData.summary?.overall_activity_progress ?? "-"}%
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("dashboard.cards.activities.subtitle")}</div>
              </div>
            )}
          </Card>

          <Card title={t("dashboard.cards.pendingReports.title")} onClick={goToPendingReports} ariaLabel={t("dashboard.cards.pendingReports.aria")}>
            {loading ? (
              <LoadingSkeleton className="h-8 w-24" />
            ) : (
              <div>
                <div className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                  {dashboardData.summary?.pending_reports ?? 0}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("dashboard.cards.pendingReports.subtitle")}</div>
              </div>
            )}
          </Card>
        </div>

        {/* Charts: group (click opens modal), top tasks (click opens modal), reports pie (CLICKABLE CARD now navigates to /report) */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card title={t("dashboard.groupProgress")} onClick={() => setShowGroupModal(true)} className="p-4">
            {loading ? <LoadingSkeleton className="h-28" /> : <GroupBarChart data={(dashboardData.groupBars || []).map((g) => ({ name: g.name, progress: g.progress, value: g.progress, color: g.color }))} limit={4} />}
          </Card>

          <Card title={t("dashboard.topTasks")} onClick={() => setShowTasksModal(true)} className="p-4">
            {loading ? (
              <LoadingSkeleton className="h-28" />
            ) : (
              <TaskBarChart items={(dashboardData.taskBars || []).map((x) => ({ label: x.label ?? x.name, progress: Number(x.progress ?? x.value ?? 0), color: x.color }))} maxItems={4} />
            )}
          </Card>

          {/* <-- Changed: reportsDistribution is now a clickable Card that navigates to /report */}
          <Card title={t("dashboard.reportsDistribution1")} onClick={() => navigate("/report")} className="p-4" ariaLabel={t("dashboard.reportsDistribution.aria")}>
            {loading ? <LoadingSkeleton className="h-28" /> : <div className="flex justify-center"><PieChart slices={(dashboardData.reportsPie || []).map((r) => ({ value: r.count, label: r.label, color: r.color }))} /></div>}
          </Card>
        </div>

        {/* Overdue + Notifications */}
        {/* Overdue (replace the previous Overdue Card block) */}
<div className="lg:col-span-8">
  <Card
    title={
      <div className="flex items-center justify-between h-6 min-w-0">
        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{t("dashboard.overdueTitle")}</span>
        <span className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded-full">
          {(dashboardData.overdueRows || []).length} {t("dashboard.tasks")}
        </span>
      </div>
    }
    headerActions={
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); goToTasks(); }}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {t("dashboard.openAll")}
        </button>
      </div>
    }
  >
    <OverdueTable rows={dashboardData.overdueRows} loading={loading} t={t} />
  </Card>
</div>


        <div className="lg:col-span-4">
          <Card title={t("dashboard.notifications.title")} onClick={goToNotifications}>
            <NotificationsPanel
              notifications={dashboardData.notifications}
              unread={dashboardData.summary?.unread || 0}
              loading={loading}
              onMarkAsRead={handleMarkNotificationsRead}
              marking={marking}
              t={t}
              navigate={navigate}
            />
          </Card>
        </div>

        {/* Audit panel */}
        <div className="lg:col-span-12">
          <Card title={t("dashboard.audit.title")} onClick={goToAudit}>
            <AuditPanel logs={dashboardData.auditLogs} loading={loading} auditPermDenied={auditPermDenied} t={t} />
          </Card>
        </div>
      </div>

      {/* Group Modal */}
      <Modal open={showGroupModal} onClose={() => setShowGroupModal(false)} title={t("dashboard.groupProgress")}>
        {loading ? <LoadingSkeleton className="h-40" /> : <GroupHorizontalModalView data={dashboardData.groups} />}
      </Modal>

      {/* Tasks Modal */}
      <Modal open={showTasksModal} onClose={() => setShowTasksModal(false)} title={t("dashboard.topTasks")}>
        {loading ? (
          <LoadingSkeleton className="h-40" />
        ) : (
          <div className="space-y-4">
            <TaskBarChart items={(dashboardData.taskBars || []).map((x) => ({ label: x.label ?? x.name, progress: Number(x.progress ?? x.value ?? 0), color: x.color }))} maxItems={dashboardData.taskBars.length || 1000} />
          </div>
        )}
      </Modal>

      <div aria-live="polite" className="sr-only">
        {loading ? t("dashboard.aria.loading") : t("dashboard.aria.loaded")}
      </div>
    </div>
  );
}
