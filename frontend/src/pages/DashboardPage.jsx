// src/pages/DashboardPage.jsx
import React, { useEffect, useMemo, useState } from "react";
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

// --- Small UI helpers ---
const LoadingSkeleton = ({ className = "h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" }) => (
  <div className={className} aria-hidden />
);

const Card = ({ title, children, onClick, className = "" }) => (
  <button
    onClick={onClick}
    className={`text-left p-4 rounded-2xl shadow-sm bg-white dark:bg-gray-800 hover:shadow-md focus:shadow-outline focus:outline-none ${className}`}
    aria-label={title}
  >
    <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{title}</div>
    <div>{children}</div>
  </button>
);

function formatDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  return dt.toLocaleDateString();
}

/* ---------------------------
   Group bar chart (vertical) - enhanced
---------------------------- */
const GroupBarChart = ({ data = [], height = 120, maxOverride = null }) => {
  if (!data || !data.length) return <div className="text-sm text-gray-500 dark:text-gray-400">No chart data</div>;

  const values = data.map((d) => Number(d.value ?? d.progress ?? 0));
  const max = Number(maxOverride ?? Math.max(...values, 1));
  const barWidth = Math.max(28, Math.floor(360 / Math.max(1, data.length)));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${data.length * barWidth} ${height + 1}`} className="w-full h-[180px]">
        <line x1="0" y1={height} x2={data.length * barWidth} y2={height} stroke="#E5E7EB" className="dark:stroke-gray-700" strokeWidth="1" />
        {data.map((d, i) => {
          const val = Number(d.value ?? d.progress ?? 0);
          const barH = Math.max(2, (val / max) * (height - 10));
          const x = i * barWidth + 8;
          const w = barWidth - 16;
          const y = height - barH;
          const color = d.color || `hsl(${(i * 45) % 360}, 70%, 50%)`;

          return (
            <g key={i} transform={`translate(${x},0)`}>
              <rect
                x={0}
                y={y}
                width={w}
                height={barH}
                rx="6"
                fill={color}
                style={{ transition: "height 600ms ease, y 600ms ease" }}
                role="img"
                aria-label={`${d.name ?? d.label}: ${val}`}
              />
              <text
                x={w / 2}
                y={height + 14}
                fontSize="10"
                textAnchor="middle"
                fill="#6B7280"
                className="text-xs dark:fill-gray-400"
                style={{ transformOrigin: "center", whiteSpace: "nowrap" }}
              >
                {d.name ?? d.label}
              </text>
              <text
                x={w / 2}
                y={y - 6}
                fontSize="10"
                textAnchor="middle"
                fill="#111827"
                className="text-xs font-medium dark:fill-gray-200"
              >
                {String(val)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/* ---------------------------
   TaskBarChart (horizontal)
---------------------------- */
const TaskBarChart = ({ items = [], maxItems = 8 }) => {
  if (!items || !items.length) return <div className="text-sm text-gray-500 dark:text-gray-400">No tasks</div>;
  const display = items.slice(0, maxItems);

  return (
    <div className="space-y-3">
      {display.map((it, idx) => {
        const value = Number(it.progress ?? it.value ?? 0);
        const pct = Math.max(0, Math.min(100, value));
        const color = it.color || `hsl(${(idx * 50) % 360}, 70%, 50%)`;
        return (
          <div key={idx} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700 dark:text-gray-300 truncate">{it.label}</div>
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 ml-2">{pct}%</div>
              </div>

              <div className="mt-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${it.label} progress`}>
                <div
                  title={`${it.label}: ${pct}%`}
                  style={{ width: `${pct}%`, background: color, transition: "width 700ms ease" }}
                  className="h-3 rounded-full"
                />
              </div>
            </div>
          </div>
        );
      })}

      {items.length > maxItems && <div className="text-xs text-gray-500 dark:text-gray-400">+{items.length - maxItems} more</div>}
    </div>
  );
};

/* ---------------------------
   Pie chart with legend
---------------------------- */
const PieChart = ({ slices = [], size = 140 }) => {
  if (!slices || !slices.length) return <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>;
  const total = slices.reduce((s, x) => s + Number(x.value ?? x.count ?? 0), 0) || 1;
  let angle = 0;
  const cx = size / 2, cy = size / 2, r = Math.min(60, size / 2 - 8);

  return (
    <div className="flex items-center gap-4">
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
        <text x={cx} y={cy} textAnchor="middle" dy="6" fontSize="12" className="text-gray-700 dark:text-gray-300 font-semibold">{total}</text>
      </svg>

      <div className="flex flex-col gap-2">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span style={{ background: s.color || `hsl(${(i * 70) % 360}, 70%, 60%)` }} className="w-3 h-3 rounded-sm inline-block" />
            <span className="text-gray-700 dark:text-gray-300 truncate max-w-[140px]">{s.label}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">({Math.round(((s.value ?? s.count ?? 0) / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------------------------
   Overdue Table, Notifications, AuditPanel (unchanged)
---------------------------- */
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
                <a href={`/tasks/${r.id}`} className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">{t("dashboard.open")}</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const NotificationsPanel = ({ notifications = [], unread = 0, loading, onMarkAsRead, marking, t }) => {
  if (loading) return <LoadingSkeleton className="h-40 w-full" />;
  if (!notifications.length) return <div className="p-4 text-sm text-gray-500 dark:text-gray-400">{t("dashboard.noNotifications")}</div>;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold dark:text-gray-300">{t("dashboard.notifications.title")}</h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white bg-red-500 px-2 py-0.5 rounded-full">{unread}</span>
          {unread > 0 && (
            <button
              onClick={onMarkAsRead}
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
          <li key={n.id} className={`p-3 rounded-lg border ${n.isRead ? "border-gray-200 dark:border-gray-700" : "border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30"}`}>
            <div className="text-sm mb-1 dark:text-gray-300">{n.message || n.type}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500">{new Date(n.createdAt || n.time || n._raw?.createdAt).toLocaleString()}</div>
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
      <h4 className="font-semibold mb-3 dark:text-gray-300">{t("dashboard.audit.title")}</h4>
      <ul className="space-y-2">
        {logs.map((l) => (
          <li key={l.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-medium text-gray-900 dark:text-gray-300">{l.userName || `User ${l.userId}`}</span>
                <span className="text-gray-700 dark:text-gray-400"> {l.action} </span>
                <span className="text-gray-500 dark:text-gray-500">{l.entity}</span>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{new Date(l.createdAt || l._raw?.createdAt).toLocaleString()}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

// --- Main Dashboard Component ---
export default function DashboardPage() {
  const { t } = useTranslation();

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
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

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

  return (
    <div className="p-6 bg-gray-200 dark:bg-gray-900 min-h-screen transition-colors duration-300">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("dashboard.title")}</h1>
          <div className="flex gap-2 items-center">
            <button
              onClick={handleRefresh}
              className="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors duration-300"
              aria-label={t("dashboard.aria.refresh")}
              disabled={loading}
            >
              <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t("dashboard.refresh")}
            </button>
<TopBar className="flex-col items-center"/>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* BENTO GRID */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Top cards */}
        <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card title={t("dashboard.cards.goals.title")}>
            {loading ? (
              <LoadingSkeleton className="h-8 w-24" />
            ) : (
              <div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">{dashboardData.summary?.overall_goal_progress ?? "-"}%</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{goalDelta ? <span className={goalDelta.startsWith("+") ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>{goalDelta} {t("dashboard.cards.goals.fromLast")}</span> : t("dashboard.cards.goals.noComparison")}</div>
              </div>
            )}
          </Card>

          <Card title={t("dashboard.cards.tasks.title")}>
            {loading ? (
              <LoadingSkeleton className="h-8 w-24" />
            ) : (
              <div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">{dashboardData.summary?.overall_task_progress ?? "-"}%</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{t("dashboard.cards.tasks.subtitle")}</div>
              </div>
            )}
          </Card>

          <Card title={t("dashboard.cards.activities.title")}>
            {loading ? (
              <LoadingSkeleton className="h-8 w-24" />
            ) : (
              <div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">{dashboardData.summary?.overall_activity_progress ?? "-"}%</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{t("dashboard.cards.activities.subtitle")}</div>
              </div>
            )}
          </Card>

          <Card title={t("dashboard.cards.pendingReports.title")}>
            {loading ? (
              <LoadingSkeleton className="h-8 w-24" />
            ) : (
              <div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">{dashboardData.summary?.pending_reports ?? 0}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{t("dashboard.cards.pendingReports.subtitle")}</div>
              </div>
            )}
          </Card>
        </div>

        {/* Charts */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-3 font-medium">{t("dashboard.groupProgress")}</div>
            {loading ? <LoadingSkeleton className="h-28" /> : <GroupBarChart data={(dashboardData.groupBars || []).map((g) => ({ name: g.name, progress: g.progress, value: g.progress }))} />}
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-3 font-medium">{t("dashboard.topTasks")}</div>
            {loading ? (
              <LoadingSkeleton className="h-28" />
            ) : (
              <TaskBarChart items={(dashboardData.taskBars || []).map((x) => ({ label: x.label ?? x.name, progress: Number(x.progress ?? x.value ?? 0), color: x.color }))} maxItems={6} />
            )}
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-3 font-medium">{t("dashboard.reportsDistribution")}</div>
            {loading ? <LoadingSkeleton className="h-28" /> : <div className="flex justify-center"><PieChart slices={(dashboardData.reportsPie || []).map((r) => ({ value: r.count, label: r.label, color: r.color }))} /></div>}
          </div>
        </div>

        {/* Overdue + Notifications */}
        <div className="lg:col-span-8">
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 h-full transition-colors duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t("dashboard.overdueTitle")}</h3>
              <span className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded-full">{dashboardData.overdueRows.length} {t("dashboard.tasks")}</span>
            </div>
            <OverdueTable rows={dashboardData.overdueRows} loading={loading} t={t} />
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 h-full transition-colors duration-300">
            <NotificationsPanel
              notifications={dashboardData.notifications}
              unread={dashboardData.summary?.unread || 0}
              loading={loading}
              onMarkAsRead={handleMarkNotificationsRead}
              marking={marking}
              t={t}
            />
          </div>
        </div>

        {/* Audit panel (always visible; backend enforces permission) */}
        <div className="lg:col-span-12">
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
            <AuditPanel logs={dashboardData.auditLogs} loading={loading} auditPermDenied={auditPermDenied} t={t} />
          </div>
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {loading ? t("dashboard.aria.loading") : t("dashboard.aria.loaded")}
      </div>
    </div>
  );
}
