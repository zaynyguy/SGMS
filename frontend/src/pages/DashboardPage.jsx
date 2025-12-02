import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
import { useAuth } from "../context/AuthContext";
import useProjectApi from "../hooks/useProjectApi";

/* small helpers */
const LoadingSkeleton = ({ className = "h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" }) => (
  <div className={`${className} transition-all duration-500 ease-out`} aria-hidden />
);

const Modal = ({ open, onClose, children, title }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);
    } else {
      setIsAnimating(true);
      setTimeout(() => {
        setIsVisible(false);
        setIsAnimating(false);
      }, 300);
    }
  }, [open]);
  
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  
  if (!isVisible) return null;
  
  return (
    <div 
      role="dialog" 
      aria-modal="true" 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ease-out ${
        open ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div 
        className={`absolute inset-0 bg-black/40 transition-all duration-500 ease-out ${
          open ? 'opacity-100' : 'opacity-0'
        }`} 
        onClick={onClose} 
      />
      <div 
        className={`relative z-10 w-full max-w-4xl max-h-[90vh] overflow-auto bg-white rounded-xl shadow-lg border border-outline/20 p-4 transform transition-all duration-500 ease-out ${
          open && !isAnimating ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-bold text-on-surface transition-all duration-300">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-on-surface-variant hover:bg-surface-container-highest rounded-full p-1 transition-all duration-300 transform hover:scale-125"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="transition-all duration-500">{children}</div>
      </div>
    </div>
  );
};

const Card = ({ title, children, onClick, className = "", ariaLabel, headerActions }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const clickable = Boolean(onClick);
  
  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);
  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);
  
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
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      aria-label={ariaLabel || title}
      className={`text-left p-4 rounded-xl bg-surface-container-low shadow-sm transition-all duration-300 ${
        clickable ? `hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 ${
          isHovered ? 'shadow-md -translate-y-0.5' : ''
        } ${isPressed ? 'scale-[0.98]' : ''}` : ""
      } ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-on-surface-variant transition-all duration-300">
          {title}
        </div>
        {headerActions}
      </div>
      <div className="transition-all duration-500 ease-out">{children}</div>
    </div>
  );
};

function formatDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  return dt.toLocaleDateString();
}

/* --- Charts (enhanced with animations) --- */
/* GroupBarChart - large rounded bars, gridlines, compact ticks, drop-in */
const GroupBarChart = ({ data = [], height = 320, limit = null, barWidth = 72, gap = 28, yLabel = "Population" }) => {
  const [animated, setAnimated] = useState(false);
  
  useEffect(() => {
    // trigger animation on data change
    setAnimated(false);
    const t = setTimeout(() => setAnimated(true), 40);
    return () => clearTimeout(t);
  }, [data]);
  
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="text-sm text-on-surface-variant">No chart data</div>;
  }
  
  const display = limit ? data.slice(0, limit) : data;
  const values = display.map((d) => Math.max(0, Number(d.value ?? d.progress ?? d.count ?? 0)));
  const maxValue = Math.max(1, ...values);
  const itemCount = display.length;
  const chartPadding = { top: 28, right: 20, bottom: 56, left: 64 }; // left gives room for y axis labels
  const chartWidth = itemCount * (barWidth + gap) - gap; // total bars width
  const svgWidth = Math.max(chartPadding.left + chartWidth + chartPadding.right, 300);
  const svgHeight = chartPadding.top + height + chartPadding.bottom;
  const innerHeight = height; // usable vertical area for bars
  const maxBarRectH = innerHeight; // we'll draw full-height rect and scaleY
  
  // y-axis ticks (5 ticks including 0)
  const ticks = 5;
  const tickValues = new Array(ticks).fill(0).map((_, i) => Math.round((maxValue * (ticks - 1 - i)) / (ticks - 1)));
  
  const formatCompact = (n) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
    return String(n);
  };
  
  // Material 3 color scheme
  const barColor = "#6750A4"; // Primary 40
  
  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={`${yLabel} bar chart`}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        aria-hidden={false}
      >
        <defs>
          {/* subtle drop shadow */}
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#6750A4" floodOpacity="0.12" />
          </filter>
        </defs>
        
        {/* horizontal gridlines and y-axis labels */}
        {tickValues.map((tv, i) => {
          const y = chartPadding.top + (innerHeight * i) / (ticks - 1);
          const isZero = tv === 0;
          return (
            <g key={i}>
              <line
                x1={chartPadding.left}
                x2={svgWidth - chartPadding.right}
                y1={y}
                y2={y}
                stroke={isZero ? "#79747E" : "#E6E0E9"}
                strokeWidth={isZero ? 1.5 : 1}
              />
              <text
                x={chartPadding.left - 12}
                y={y + 4}
                fontSize="12"
                textAnchor="end"
                fill="#49454F"
                style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
              >
                {formatCompact(tv)}
              </text>
            </g>
          );
        })}
        
        {/* left vertical axis label rotated */}
        <text
          x={12}
          y={chartPadding.top + innerHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 12 ${chartPadding.top + innerHeight / 2})`}
          fontSize="12"
          fill="#1C1B1F"
          style={{ fontWeight: 500 }}
        >
          {yLabel}
        </text>
        
        {/* bars group */}
        <g transform={`translate(${chartPadding.left}, ${chartPadding.top})`}>
          {display.map((d, i) => {
            const val = values[i];
            const x = i * (barWidth + gap);
            // scale value to [0..1]
            const proportion = val / maxValue;
            // we will use transform: scaleY to animate
            const scaleY = Math.max(0.004, proportion); // avoid zero to keep transform origin working
            const rectHeight = maxBarRectH;
            const rectY = innerHeight - rectHeight; // rect drawn from top of full-height box
            const rx = Math.min(14, Math.floor(barWidth / 6));
            const label = d.name ?? d.label ?? d.title ?? `#${i + 1}`;
            return (
              <g key={i} transform={`translate(${x},0)`}>
                {/* shadowed rounded rect (we draw full box and scaleY from bottom) */}
                <rect
                  x={0}
                  y={rectY}
                  width={barWidth}
                  height={rectHeight}
                  rx={rx}
                  fill={barColor}
                  filter="url(#shadow)"
                  style={{
                    transformOrigin: `center ${rectY + rectHeight}px`, // origin at bottom of the rect
                    transform: animated ? `scaleY(${scaleY})` : "scaleY(0.01)",
                    transition: `transform 900ms cubic-bezier(.2,.9,.2,1) ${i * 90}ms`,
                  }}
                />
                {/* value label above bar */}
                <text
                  x={barWidth / 2}
                  y={Math.max(8, rectY + rectHeight - rectHeight * scaleY - 10)}
                  fontSize="12"
                  textAnchor="middle"
                  fill="#1C1B1F"
                  style={{ fontWeight: 600 }}
                >
                  {formatCompact(val)}
                </text>
                {/* x-axis labels */}
                <text
                  x={barWidth / 2}
                  y={innerHeight + 20}
                  fontSize="12"
                  textAnchor="middle"
                  fill="#49454F"
                  style={{ transformOrigin: "center", whiteSpace: "pre-line" }}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

/* TaskBarChart */
const TaskBarChart = ({ items = [], maxItems = 6 }) => {
  const [animated, setAnimated] = useState(false);
  
  useEffect(() => {
    setAnimated(true);
    const timer = setTimeout(() => setAnimated(false), 1200);
    return () => clearTimeout(timer);
  }, [items]);
  
  if (!items || !items.length) return <div className="text-sm text-on-surface-variant">No tasks</div>;
  const display = items.slice(0, maxItems);
  
  return (
    <div className="space-y-3">
      {display.map((it, idx) => {
        const value = Math.max(0, Math.min(100, Math.round(Number(it.progress ?? it.value ?? 0))));
        const color = it.color || "#6750A4"; // Primary 40
        return (
          <div 
            key={idx} 
            className="flex items-center gap-3 transition-all duration-300 hover:translate-x-1"
            style={{
              animationDelay: `${idx * 100}ms`,
              transitionDelay: `${idx * 50}ms`
            }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium text-on-surface truncate">
                  {it.label}
                </div>
                <div className="text-sm font-medium text-on-surface-variant ml-1.5">
                  {value}%
                </div>
              </div>
              <div
                className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden"
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${it.label} progress`}
              >
                <div 
                  title={`${it.label}: ${value}%`} 
                  style={{ width: animated ? `${value}%` : '0%', background: color }} 
                  className="h-2 rounded-full transition-all duration-1000 ease-out" 
                />
              </div>
            </div>
          </div>
        );
      })}
      {items.length > maxItems && <div className="text-sm text-on-surface-variant">+{items.length - maxItems} more</div>}
    </div>
  );
};

/* PieChart */
const PieChart = ({ slices = [], size = 180 }) => {
  const [animated, setAnimated] = useState(false);
  const { t } = useTranslation();
  
  useEffect(() => {
    setAnimated(true);
    const timer = setTimeout(() => setAnimated(false), 1500);
    return () => clearTimeout(timer);
  }, [slices]);
  
  const items = Array.isArray(slices) ? slices : [];
  const total = items.reduce((s, x) => s + Number(x.value ?? x.count ?? 0), 0);
  
  const getColorFor = (s, i) => {
    if (s.color) return s.color;
    const key = (s.label ?? s.status ?? s.name ?? "").toString().toLowerCase().trim();
    if (key.includes("approve") || key.includes("approved") || key === "approved") return "#1A9E75"; // M3 green
    if (key.includes("reject") || key.includes("rejected") || key === "rejected") return "#B3261E"; // M3 error
    if (key.includes("pending") || key === "pending") return "#944F01"; // M3 amber
    return `hsl(${(i * 70) % 360}, 70%, 60%)`;
  };
  
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-sm text-on-surface-variant">{t("reports.noReports3")}</div>
      </div>
    );
  }
  
  const nonZero = items.filter((x) => Number(x.value ?? x.count ?? 0) > 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = Math.min(50, size / 2 - 6);
  const innerR = Math.max(3, r - 14);
  
  if (nonZero.length === 1) {
    const s = nonZero[0];
    const fill = getColorFor(s, items.indexOf(s));
    return (
      <div className="flex md:flex-col flex-row items-center gap-4">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="transition-all duration-1000 transform hover:scale-110">
          <circle cx={cx} cy={cy} r={r} fill={fill} stroke="none" className="transition-all duration-500" />
          <circle cx={cx} cy={cy} r={innerR} fill="white" className="transition-all duration-500" />
          <text x={cx} y={cy} textAnchor="middle" dy="5" fontSize="16" className="fill-current text-on-surface font-bold">
            {total}
          </text>
        </svg>
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-1 gap-2">
            {items.map((it, i) => {
              const val = Number(it.value ?? it.count ?? 0);
              const pct = Math.round((val / total) * 100);
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span style={{ background: getColorFor(it, i) }} className="w-3 h-3 rounded-full inline-block flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="truncate text-on-surface">{it.label}</div>
                      <div className="text-sm text-on-surface-variant ml-1.5">({pct}%)</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
  
  let angle = 0;
  return (
    <div className="flex md:flex-col flex-row items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="transition-all duration-1000 transform hover:scale-110">
        {items.map((s, i) => {
          const val = Number(s.value ?? s.count ?? 0);
          const portion = val / total;
          const startAngle = angle;
          const endAngle = angle + portion * Math.PI * 2;
          angle = endAngle;
          const large = endAngle - startAngle > Math.PI ? 1 : 0;
          const x1 = cx + r * Math.cos(startAngle);
          const y1 = cy + r * Math.sin(startAngle);
          const x2 = cx + r * Math.cos(endAngle);
          const y2 = cy + r * Math.sin(endAngle);
          const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
          return (
            <path 
              key={i} 
              d={d} 
              fill={getColorFor(s, i)} 
              stroke="none"
              className="transition-all duration-1000" 
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                transform: animated ? 'scale(0)' : 'scale(1)',
                transition: `transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 200}ms`
              }}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={innerR} fill="white" className="transition-all duration-500" />
        <text x={cx} y={cy} textAnchor="middle" dy="5" fontSize="16" className="fill-current text-on-surface font-bold">
          {total}
        </text>
      </svg>
      <div className="flex-1 min-w-0">
        <div className="grid grid-cols-1 gap-2">
          {items.map((it, i) => {
            const val = Number(it.value ?? it.count ?? 0);
            const pct = Math.round((val / total) * 100);
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span style={{ background: getColorFor(it, i) }} className="w-3 h-3 rounded-full inline-block flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="truncate text-on-surface">{it.label}</div>
                    <div className="text-sm text-on-surface-variant ml-1.5">({pct}%)</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* Overdue / Notifications / Audit panels (enhanced) */
const OverdueTable = ({ rows = [], loading, t }) => {
  if (loading) return <LoadingSkeleton className="h-40 w-full" />;
  if (!rows.length) return <div className="p-3 text-sm text-on-surface-variant">{t("dashboard.noOverdue")}</div>;
  
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-on-surface-variant bg-surface-container">
          <tr>
            <th className="p-2">{t("dashboard.table.task")}</th>
            <th className="p-2">{t("dashboard.table.due")}</th>
            <th className="p-2">{t("dashboard.table.daysOverdue")}</th>
            <th className="p-2">{t("dashboard.table.goal")}</th>
            <th className="p-2">{t("dashboard.table.group")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, index) => (
            <tr 
              key={r.id || r.taskId} 
              className="border-b border-outline/20 hover:bg-surface-container-highest transition-all duration-300"
              style={{
                animationDelay: `${index * 50}ms`,
                transitionDelay: `${index * 30}ms`
              }}
            >
              <td className="p-2 text-on-surface">{r.taskTitle}</td>
              <td className="p-2 text-on-surface">{formatDate(r.dueDate)}</td>
              <td className="p-2">
                <span className="px-2 py-0.5 bg-error-container text-on-error-container rounded-full text-xs font-medium">
                  {r.days_overdue ?? r.daysOverdue ?? 0}
                </span>
              </td>
              <td className="p-2 text-on-surface">{r.goalTitle}</td>
              <td className="p-2 text-on-surface">{r.groupName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const NotificationsPanel = ({ notifications = [], unread = 0, loading, onMarkAsRead, marking, t, navigate }) => {
  if (loading) return <LoadingSkeleton className="h-32 w-full" />;
  if (!notifications.length) return <div className="p-3 text-sm text-on-surface-variant">{t("dashboard.noNotifications")}</div>;
  
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-on-surface">Unread notifications</span>
          <span className="text-xs font-medium bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full">
            {unread}
          </span>
          {unread > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead();
              }}
              disabled={marking}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              {marking ? t("dashboard.notifications.marking") : t("dashboard.notifications.markAll")}
            </button>
          )}
        </div>
      </div>
      <ul className="space-y-2">
        {notifications.map((n, index) => (
          <li key={n.id} className="transition-all duration-300">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (n.url) {
                  window.location.href = n.url;
                } else {
                  navigate("/notification");
                }
              }}
              className={`w-full text-left p-3 rounded-xl border transition-all duration-300 ${
                n.isRead ? "border-outline/20 bg-surface" : "border-primary/30 bg-primary-container"
              } hover:shadow-md`}
              style={{
                animationDelay: `${index * 100}ms`,
                transitionDelay: `${index * 50}ms`
              }}
            >
              <div className="text-sm font-medium text-on-surface mb-1">{n.message || n.type}</div>
              <div className="text-xs text-on-surface-variant">{new Date(n.createdAt || n.time || n._raw?.createdAt).toLocaleString()}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const AuditPanel = ({ logs = [], loading, auditPermDenied = false, t }) => {
  if (loading) return <LoadingSkeleton className="h-32 w-full" />;
  if (auditPermDenied) return <div className="p-3 text-sm text-on-surface-variant">{t("dashboard.audit.noPermission")}</div>;
  if (!logs.length) return <div className="p-3 text-sm text-on-surface-variant">{t("dashboard.audit.noLogs")}</div>;
  
  return (
    <div>
      <ul className="space-y-3">
        {logs.map((l, index) => (
          <li 
            key={l.id} 
            className="p-3 bg-surface-container-low rounded-xl border border-outline/20 transition-all duration-300 hover:shadow-md"
            style={{
              animationDelay: `${index * 80}ms`,
              transitionDelay: `${index * 40}ms`
            }}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="font-medium text-on-surface">{l.userName || `User ${l.userId}`}</span>
                <span className="text-on-surface-variant"> {l.action} </span>
                <span className="text-on-surface-variant"> {l.entity}</span>
              </div>
              <div className="text-xs text-on-surface-variant whitespace-nowrap">
                {new Date(l.createdAt || l._raw?.createdAt).toLocaleString()}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* Main dashboard */
export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const project = useProjectApi();
  
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
  const [filters] = useState({ group: "", dateFrom: "", dateTo: "", status: "" });
  const [error, setError] = useState(null);
  const [auditPermDenied, setAuditPermDenied] = useState(false);
  const [marking, setMarking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  
  const permissionArray = Array.isArray(user?.permissions) ? user.permissions : [];
  const hasAuditPerm = permissionArray.includes("view_audit_logs");
  
  const lastRefreshAt = useRef(0);
  
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAuditPermDenied(false);
    
    try {
      const promises = [
        fetchDashboardSummary({ groupId: filters.group, dateFrom: filters.dateFrom, dateTo: filters.dateTo, status: filters.status }),
        fetchDashboardCharts({ type: "group", groupId: filters.group, dateFrom: filters.dateFrom, dateTo: filters.dateTo }),
        fetchDashboardCharts({ type: "task", groupId: filters.group, top: 8 }),
        fetchDashboardCharts({ type: "reports", groupId: filters.group }),
        fetchOverdueTasks({ limit: 10, groupId: filters.group }),
        fetchNotifications({ limit: 5 }),
      ];
      
      if (hasAuditPerm) {
        promises.push(fetchAuditLogs({ limit: 5 }));
      } else {
        promises.push(Promise.resolve([]));
      }
      
      const results = await Promise.allSettled(promises);
      const [summaryRes, groupRes, taskRes, reportsRes, overdueRes, notifsRes, auditRes] = results;
      
      // Accept summary either as { ... } or { data: { ... } }
      const raw = summaryRes.status === "fulfilled" ? summaryRes.value : null;
      const summaryObj = raw && typeof raw === "object" && raw.data ? raw.data : raw;
      
      const newData = {
        summary: summaryObj,
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
        auditLogs: [],
      };
      
      newData.groups = Array.isArray(newData.groupBars)
        ? newData.groupBars.map((g) => ({ groupId: g.groupId ?? g.id, name: g.name, value: g.progress ?? g.value ?? 0, color: g.color }))
        : [];
      
      if (hasAuditPerm) {
        if (auditRes.status === "fulfilled") {
          newData.auditLogs = auditRes.value || [];
        } else {
          const reason = auditRes.reason;
          if (reason && reason.status === 403) {
            setAuditPermDenied(true);
            newData.auditLogs = [];
          } else {
            newData.auditLogs = [];
          }
        }
      } else {
        newData.auditLogs = [];
      }
      
      setDashboardData(newData);
      
      const errors = [
        summaryRes.status === "rejected" && t("dashboard.errors.summary"),
        groupRes.status === "rejected" && t("dashboard.errors.groupCharts"),
        taskRes.status === "rejected" && t("dashboard.errors.taskCharts"),
        reportsRes.status === "rejected" && t("dashboard.errors.reports"),
        overdueRes.status === "rejected" && t("dashboard.errors.overdue"),
        notifsRes.status === "rejected" && t("dashboard.errors.notifications"),
        hasAuditPerm && auditRes.status === "rejected" && t("dashboard.errors.audit"),
      ].filter(Boolean);
      
      if (errors.length) setError(t("dashboard.failedLoadPrefix") + errors.join(", "));
    } catch (err) {
      console.error("Unexpected dashboard error", err);
      setError(String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, t, hasAuditPerm]);
  
  useEffect(() => {
    loadAll();
  }, [loadAll, user]);
  
  useEffect(() => {
    if (project && typeof project.loadGoals === "function") {
      project.loadGoals().catch((e) => {
        console.warn("project.loadGoals failed", e);
      });
    }
  }, [project]);
  
  const handleRefresh = () => {
    const now = Date.now();
    if (now - lastRefreshAt.current < 1200) {
      console.warn("Refresh suppressed (too frequent)");
      return;
    }
    lastRefreshAt.current = now;
    setRefreshing(true);
    loadAll();
    if (project && typeof project.loadGoals === "function") project.loadGoals().catch(() => {});
  };
  
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
        notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
        summary: prev.summary ? { ...prev.summary, unread: 0, unread_notifications: 0 } : null,
      }));
    } catch (err) {
      console.error("❌ Failed to mark notifications read:", err);
    } finally {
      setMarking(false);
    }
  };
  
  // parse numeric-like values (backend often returns strings)
  const parseNum = (v, fallback = null) => {
    if (v === null || v === undefined) return fallback;
    if (typeof v === "number") return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  
  // take summary either directly or from { data: ... }
  const rawSummary = dashboardData.summary ?? {};
  const summary = rawSummary && typeof rawSummary === "object" ? rawSummary : {};
  
  // PERCENTAGES (you said these already work)
  const overall_goal_progress = parseNum(summary.overall_goal_progress, null);
  const overall_task_progress = parseNum(summary.overall_task_progress, null);
  const overall_activity_progress = parseNum(summary.overall_activity_progress, null);
  
  // pending reports
  const pending_reports = parseNum(summary.pending_reports, 0);
  
  // --- EXACT COUNTS from your JSON ---
  const goals_count = parseNum(summary.goals_count, 0);
  const tasks_count = parseNum(summary.tasks_count, 0);
  const activities_count = parseNum(summary.activities_count, 0);
  const goals_finished_count = parseNum(summary.goals_finished_count, 0);
  const tasks_finished_count = parseNum(summary.tasks_finished_count, 0);
  const activities_finished_count = parseNum(summary.activities_finished_count, 0);
  
  // unread notifications
  const unread_notifications = parseNum(summary.unread_notifications, 0);
  const unread = parseNum(summary.unread, unread_notifications ?? 0) ?? 0;
  
  // goal delta (optional)
  const goalDelta = useMemo(() => {
    if (!dashboardData.summary) return null;
    const d = dashboardData.summary.overall_goal_delta ?? null;
    if (d == null) return null;
    const sign = d >= 0 ? "+" : "";
    return `${sign}${d}%`;
  }, [dashboardData.summary]);
  
  // totals / finished
  const goalsTotal = goals_count ?? 0;
  const goalsFinished = goals_finished_count ?? 0;
  const tasksTotal = tasks_count ?? 0;
  const tasksFinished = tasks_finished_count ?? 0;
  const activitiesTotal = activities_count ?? 0;
  const activitiesFinished = activities_finished_count ?? 0;
  
  const hasGoalPercent = overall_goal_progress !== null && overall_goal_progress !== undefined;
  const hasTaskPercent = overall_task_progress !== null && overall_task_progress !== undefined;
  const hasActivityPercent = overall_activity_progress !== null && overall_activity_progress !== undefined;
  
  const goToGoals = () => navigate("/project?tab=goals");
  const goToTasks = () => navigate("/project?tab=tasks");
  const goToActivities = () => navigate("/project?tab=activities");
  const goToPendingReports = () => navigate("/report?status=Pending");
  const goToNotifications = () => navigate("/notification");
  const goToAudit = () => {
    if (!hasAuditPerm) {
      console.warn("User attempted to access audit without permission");
      return;
    }
    navigate("/auditLog");
  };
  
  // Define Material 3 color variables
  const material3Colors = {
    primary: "#6750A4",
    onPrimary: "#FFFFFF",
    primaryContainer: "#EADDFF",
    onPrimaryContainer: "#21005D",
    secondary: "#625B71",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#E8DEF8",
    onSecondaryContainer: "#1E192B",
    tertiary: "#7D5260",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#FFD8E4",
    onTertiaryContainer: "#31111D",
    error: "#B3261E",
    onError: "#FFFFFF",
    errorContainer: "#F9DEDC",
    onErrorContainer: "#410E0B",
    background: "#FFFBFE",
    onBackground: "#1C1B1F",
    surface: "#FFFBFE",
    onSurface: "#1C1B1F",
    surfaceVariant: "#E7E0EC",
    onSurfaceVariant: "#49454F",
    outline: "#79747E",
    outlineVariant: "#CAC4D0",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#313033",
    inverseOnSurface: "#F4EFF4",
    inversePrimary: "#D0BCFF",
    surfaceContainerLowest: "#FFFFFF",
    surfaceContainerLow: "#F8F5FA",
    surfaceContainer: "#F3F0F6",
    surfaceContainerHigh: "#EFEBF1",
    surfaceContainerHighest: "#EAE6EC",
  };
  
  return (
    <div className="p-4 bg-background min-h-screen" style={{ "--surface": material3Colors.surface }}>
      <style jsx global>{`
        :root {
          --primary: ${material3Colors.primary};
          --on-primary: ${material3Colors.onPrimary};
          --primary-container: ${material3Colors.primaryContainer};
          --on-primary-container: ${material3Colors.onPrimaryContainer};
          --secondary: ${material3Colors.secondary};
          --on-secondary: ${material3Colors.onSecondary};
          --secondary-container: ${material3Colors.secondaryContainer};
          --on-secondary-container: ${material3Colors.onSecondaryContainer};
          --tertiary: ${material3Colors.tertiary};
          --on-tertiary: ${material3Colors.onTertiary};
          --tertiary-container: ${material3Colors.tertiaryContainer};
          --on-tertiary-container: ${material3Colors.onTertiaryContainer};
          --error: ${material3Colors.error};
          --on-error: ${material3Colors.onError};
          --error-container: ${material3Colors.errorContainer};
          --on-error-container: ${material3Colors.onErrorContainer};
          --background: ${material3Colors.background};
          --on-background: ${material3Colors.onBackground};
          --surface: ${material3Colors.surface};
          --on-surface: ${material3Colors.onSurface};
          --surface-variant: ${material3Colors.surfaceVariant};
          --on-surface-variant: ${material3Colors.onSurfaceVariant};
          --outline: ${material3Colors.outline};
          --outline-variant: ${material3Colors.outlineVariant};
          --shadow: ${material3Colors.shadow};
          --scrim: ${material3Colors.scrim};
          --inverse-surface: ${material3Colors.inverseSurface};
          --inverse-on-surface: ${material3Colors.inverseOnSurface};
          --inverse-primary: ${material3Colors.inversePrimary};
          --surface-container-lowest: ${material3Colors.surfaceContainerLowest};
          --surface-container-low: ${material3Colors.surfaceContainerLow};
          --surface-container: ${material3Colors.surfaceContainer};
          --surface-container-high: ${material3Colors.surfaceContainerHigh};
          --surface-container-highest: ${material3Colors.surfaceContainerHighest};
        }
      `}</style>
      
      {/* Card-style Header */}
      <div className="mb-6">
        <div className="bg-surface-container-low rounded-xl shadow-sm border border-outline/10 py-3 px-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-3 rounded-xl bg-primary-container">
                <Home className="h-6 w-6 text-on-primary-container" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col sm:flex-row items-start sm:items-center sm:gap-3">
                  <h1 className="text-xl md:text-2xl font-bold text-on-surface truncate">
                    {t("dashboard.title")}
                  </h1>
                </div>
                <p className="text-sm text-on-surface-variant mt-1">
                  {t("dashboard.subtitle")}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between md:justify-end gap-3">
              <button
                onClick={handleRefresh}
                className={`px-3 py-2 rounded-xl bg-surface-container text-on-surface shadow-sm hover:bg-surface-container-high flex items-center gap-2 transition-all duration-300 ${
                  refreshing ? 'animate-pulse' : ''
                }`}
                aria-label={t("dashboard.aria.refresh")}
                disabled={loading}
              >
                <svg 
                  className={`w-4 h-4 transition-all duration-300 ${loading || refreshing ? "animate-spin" : ""}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                  />
                </svg>
                <span className="text-sm font-medium">
                  {t("dashboard.refresh")}
                </span>
              </button>
              <div className="flex-shrink-0">
                <TopBar />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="p-3 bg-error-container text-on-error-container rounded-lg mb-4 border border-error">
          {error}
        </div>
      )}
      
      {/* BENTO GRID */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* KPI cards */}
        <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Goals Card */}
          <Card title={t("dashboard.cards.goals.title")} onClick={goToGoals} ariaLabel={t("dashboard.cards.goals.aria")}>
            {loading ? (
              <LoadingSkeleton className="h-6 w-20" />
            ) : (
              <div>
                <div className="text-2xl md:text-3xl font-bold text-on-surface">
                  {hasGoalPercent ? `${overall_goal_progress.toFixed(2)}%` : goalsTotal > 0 ? `${goalsFinished} of ${goalsTotal}` : "-"}
                  <sub className="text-[10px] ml-1 text-on-surface-variant">{t("dashboard.percentage")}</sub>
                </div>
                {goalsTotal > 0 && (
                  <div className="text-sm text-on-surface-variant mt-1">
                    {`${goalsFinished} ${t("dashboard.cards.goals.outOf")} ${goalsTotal} ${t("dashboard.cards.goals.title").toLowerCase()} ${t("dashboard.cards.goals.haveBeenDone")}`}
                  </div>
                )}
                <div className="text-sm text-on-surface-variant mt-1">
                  {goalDelta ? (
                    <span className={`font-medium ${
                      goalDelta.startsWith("+") ? "text-tertiary" : "text-error"
                    }`}>
                      {goalDelta} {t("dashboard.cards.goals.fromLast")}
                    </span>
                  ) : (
                    t("dashboard.cards.goals.noComparison") || "Overall goal progress"
                  )}
                </div>
              </div>
            )}
          </Card>
          
          {/* Tasks Card */}
          <Card title={t("dashboard.cards.tasks.title")} onClick={goToTasks} ariaLabel={t("dashboard.cards.tasks.aria")}>
            {loading ? (
              <LoadingSkeleton className="h-6 w-20" />
            ) : (
              <div>
                <div className="text-2xl md:text-3xl font-bold text-on-surface">
                  {hasTaskPercent ? `${overall_task_progress.toFixed(2)}%` : tasksTotal > 0 ? `${tasksFinished} of ${tasksTotal}` : "-"}
                  <sub className="text-[10px] ml-1 text-on-surface-variant">{t("dashboard.percentage")}</sub>
                </div>
                {tasksTotal > 0 && <div className="text-sm text-on-surface-variant mt-1">{`${tasksFinished} ${t("dashboard.cards.tasks.outOf")} ${tasksTotal} ${t("dashboard.cards.tasks.title").toLowerCase()} ${t("dashboard.cards.tasks.haveBeenDone")}`}</div>}
                <div className="text-sm text-on-surface-variant mt-1">{t("dashboard.cards.tasks.subtitle")}</div>
              </div>
            )}
          </Card>
          
          {/* Activities Card */}
          <Card title={t("dashboard.cards.activities.title")} onClick={goToActivities} ariaLabel={t("dashboard.cards.activities.aria")}>
            {loading ? (
              <LoadingSkeleton className="h-6 w-20" />
            ) : (
              <div>
                <div className="text-2xl md:text-3xl font-bold text-on-surface">
                  {hasActivityPercent ? `${overall_activity_progress.toFixed(2)}%` : activitiesTotal > 0 ? `${activitiesFinished} of ${activitiesTotal}` : "-"}
                  <sub className="text-[10px] ml-1 text-on-surface-variant">{t("dashboard.percentage")}</sub>
                </div>
                {activitiesTotal > 0 && <div className="text-sm text-on-surface-variant mt-1">{`${activitiesFinished} ${t("dashboard.cards.activities.outOf")} ${activitiesTotal} ${t("dashboard.cards.activities.title").toLowerCase()} ${t("dashboard.cards.activities.haveBeenDone")}`}</div>}
                <div className="text-sm text-on-surface-variant mt-1">{t("dashboard.cards.activities.subtitle")}</div>
              </div>
            )}
          </Card>
          
          {/* Pending Reports Card */}
          <Card title={t("dashboard.cards.pendingReports.title")} onClick={goToPendingReports} ariaLabel={t("dashboard.cards.pendingReports.aria")}>
            {loading ? (
              <LoadingSkeleton className="h-6 w-20" />
            ) : (
              <div>
                <div className="text-2xl md:text-3xl font-bold text-on-surface">
                  {pending_reports ?? 0}
                </div>
                <div className="text-sm text-on-surface-variant mt-1">{t("dashboard.cards.pendingReports.subtitle")}</div>
              </div>
            )}
          </Card>
        </div>
        
        {/* Charts */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title={t("dashboard.groupProgress")} onClick={() => setShowGroupModal(true)} className="p-4 flex flex-col justify-between h-full">
            {loading ? (<LoadingSkeleton className="h-24" />) : (<div className="mt-2"><GroupBarChart data={(dashboardData.groupBars || []).map((g) => ({ name: g.name, progress: g.progress, value: g.progress, color: g.color }))} limit={5} barWidth={80} gap={30} yLabel="Office progress" height={320}/></div>)}
          </Card>
          
          <Card title={t("dashboard.topTasks")} onClick={() => setShowTasksModal(true)} className="p-4">
            {loading ? (<LoadingSkeleton className="h-24" />) : (<TaskBarChart items={(dashboardData.taskBars || []).map((x) => ({ label: x.label ?? x.name, progress: Number(x.progress ?? x.value ?? 0), color: x.color }))} maxItems={4} />)}
          </Card>
          
          <Card title={t("dashboard.reportsDistribution1")} onClick={() => navigate("/report")} className="p-4" ariaLabel={t("dashboard.reportsDistribution.aria")}>
            {loading ? <LoadingSkeleton className="h-24" /> : <div className="flex justify-center"><PieChart slices={(dashboardData.reportsPie || []).map((r) => ({ value: r.count, label: r.label, color: r.color }))} /></div>}
          </Card>
        </div>
        
        {hasAuditPerm ? (
          <div className="lg:col-span-12">
            <Card title={t("dashboard.audit.title")} onClick={goToAudit}><AuditPanel logs={dashboardData.auditLogs} loading={loading} auditPermDenied={auditPermDenied} t={t} /></Card>
          </div>
        ) : null}
        
        {/* Overdue + Notifications */}
        <div className="lg:col-span-8">
          <Card
            title={
              <div className="flex items-center justify-between h-5 min-w-0">
                <span className="text-sm font-medium text-on-surface-variant truncate">
                  {t("dashboard.overdueTitle")}
                </span>
                <span className="text-sm font-medium bg-error-container text-on-error-container ml-2 px-2 py-0.5 rounded-full">
                  {(dashboardData.overdueRows || []).length} {t("dashboard.tasks")}
                </span>
              </div>
            }
            headerActions={
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); goToTasks(); }} 
                  className="text-sm font-medium text-primary hover:underline"
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
              unread={unread}
              loading={loading}
              onMarkAsRead={handleMarkNotificationsRead}
              marking={marking}
              t={t}
              navigate={navigate}
            />
          </Card>
        </div>
      </div>
      
      {/* Modals */}
      <Modal open={showGroupModal} onClose={() => setShowGroupModal(false)} title={t("dashboard.groupProgress")}>
        {loading ? <LoadingSkeleton className="h-32" /> : <div className="overflow-x-auto"><div className="flex gap-4 items-end pb-3">{(dashboardData.groups || []).map((g, idx) => (<div key={g.groupId ?? g.id ?? idx} className="flex flex-col items-center min-w-[70px]"><div className="w-10 h-24 bg-surface-container-highest rounded-lg overflow-hidden flex items-end"><div style={{ height: `${Math.max(6, Math.round((Number(g.value ?? g.progress ?? 0) / Math.max(1, ...((dashboardData.groups || []).map(x=>Number(x.value ?? x.progress ?? 0)))))*100))}%`, background: g.color }} className="w-full transition-all duration-1000 ease-out" /></div><div className="text-sm text-center text-on-surface mt-2 break-words max-w-[100px] min-h-[2.5rem] flex items-center justify-center">{g.name}</div><div className="text-sm font-medium text-on-surface-variant mt-1">{Math.round(Number(g.value ?? g.progress ?? 0))}%</div></div>))}</div></div>}
      </Modal>
      
      <Modal open={showTasksModal} onClose={() => setShowTasksModal(false)} title={t("dashboard.topTasks")}>
        {loading ? (<LoadingSkeleton className="h-32" />) : (<div className="space-y-3"><TaskBarChart items={(dashboardData.taskBars || []).map((x) => ({ label: x.label ?? x.name, progress: Number(x.progress ?? x.value ?? 0), color: x.color }))} maxItems={dashboardData.taskBars.length || 1000} /></div>)}
      </Modal>
      
      <div aria-live="polite" className="sr-only">{loading ? t("dashboard.aria.loading") : t("dashboard.aria.loaded")}</div>
    </div>
  );
}
