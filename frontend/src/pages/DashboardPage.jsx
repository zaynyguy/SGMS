import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
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

/* Material Design 3 Dashboard Component */
const App = () => {
  const { t } = useTranslation();
  
  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);

  // Material Design 3 color system - light theme
  const lightColors = {
    primary: "#10B981", // Green 40
    onPrimary: "#FFFFFF",
    primaryContainer: "#BBF7D0", // Light green container
    onPrimaryContainer: "#047857", // Dark green text on container
    secondary: "#4F7AE6",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#DBE6FD",
    onSecondaryContainer: "#0B2962",
    tertiary: "#9333EA",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#E9D7FD",
    onTertiaryContainer: "#381E72",
    error: "#B3261E",
    onError: "#FFFFFF",
    errorContainer: "#F9DEDC",
    onErrorContainer: "#410E0B",
    background: "#F8FAF5",
    onBackground: "#1C1B1F",
    surface: "#F8FAF5",
    onSurface: "#1C1B1F",
    surfaceVariant: "#D8E8D9",
    onSurfaceVariant: "#444C45",
    outline: "#737B73",
    outlineVariant: "#C2C9C2",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#313033",
    inverseOnSurface: "#F4EFF4",
    inversePrimary: "#99F6E4",
    surfaceContainerLowest: "#FFFFFF",
    surfaceContainerLow: "#F5F9F2",
    surfaceContainer: "#F0F5ED",
    surfaceContainerHigh: "#EBF1E9",
    surfaceContainerHighest: "#E5ECE3",
  };

  // Material Design 3 color system - dark theme
  const darkColors = {
    primary: "#4ADE80", // Lighter green for dark mode
    onPrimary: "#002115",
    primaryContainer: "#003925",
    onPrimaryContainer: "#BBF7D0",
    secondary: "#B6C9FF",
    onSecondary: "#1E307D",
    secondaryContainer: "#354796",
    onSecondaryContainer: "#DBE6FD",
    tertiary: "#D0BCFF",
    onTertiary: "#4F308B",
    tertiaryContainer: "#6745A3",
    onTertiaryContainer: "#E9D7FD",
    error: "#FFB4AB",
    onError: "#690005",
    errorContainer: "#93000A",
    onErrorContainer: "#FFDAD6",
    background: "#1A1C19",
    onBackground: "#E1E3DD",
    surface: "#1A1C19",
    onSurface: "#E1E3DD",
    surfaceVariant: "#444C45",
    onSurfaceVariant: "#C2C9C2",
    outline: "#8C948D",
    outlineVariant: "#444C45",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#E1E3DD",
    inverseOnSurface: "#1A1C19",
    inversePrimary: "#006D5B",
    surfaceContainerLowest: "#222421",
    surfaceContainerLow: "#2D2F2C",
    surfaceContainer: "#313330",
    surfaceContainerHigh: "#3B3D3A",
    surfaceContainerHighest: "#454744",
  };

  // Select colors based on dark mode
  const m3Colors = darkMode ? darkColors : lightColors;

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
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => setMounted(false);
  }, []);

  /* Small helpers */
  const LoadingSkeleton = ({ className = "h-5 bg-[var(--surface-container)] rounded animate-pulse" }) => (
    <div className={`${className} transition-all duration-300`} aria-hidden />
  );

  const Modal = ({ open, onClose, children, title }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    // Keep track of whether we mounted the portal content (so we can animate)
    useEffect(() => {
      if (open) {
        // mount & start enter animation
        setIsVisible(true);
        // small timeout to ensure classes apply after mount
        requestAnimationFrame(() => setIsAnimating(true));
        // lock body scroll
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
          document.body.style.overflow = prevOverflow || "";
        };
      } else {
        // start leave animation, then unmount after duration
        setIsAnimating(false);
        const t = setTimeout(() => setIsVisible(false), 320);
        return () => clearTimeout(t);
      }
    }, [open]);
    // Escape key closes modal
    useEffect(() => {
      if (!open) return;
      const onKey = (e) => {
        if (e.key === "Escape") onClose?.();
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);
    if (!isVisible) return null;
    const content = (
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed bg-black/40 dark:bg-gray-900/80 inset-0 z-50 flex items-center justify-center p-3 transition-opacity duration-300`}
        aria-hidden={!open}
      >
        {/* Scrim */}
        <div
          className={`absolute inset-0 bg-[var(--scrim)]/[0.4] dark:bg-gray-900/80 transition-opacity duration-300 ${open && isAnimating ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClose}
        />
        {/* Modal panel */}
        <div
          className={`relative z-10 w-full max-w-4xl max-h-[90vh] overflow-auto bg-[var(--surface-container-lowest)] dark:bg-gray-800 rounded-2xl surface-elevation-3 p-3 sm:p-4 transform transition-all duration-320 ${open && isAnimating ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-8'}`}
          // stop click on panel from closing by scrim
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-lg font-semibold text-[var(--on-surface)] dark:text-white transition-all duration-300">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-[var(--on-surface-variant)] dark:text-gray-400 hover:text-[var(--on-surface)] dark:hover:text-white transition-all duration-300 transform hover:scale-125"
            >
              ✕
            </button>
          </div>
          <div className="transition-all duration-300">
            {children}
          </div>
        </div>
      </div>
    );
    // render into body so fixed positioning is viewport-relative
    return createPortal(content, document.body);
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
        className={`text-left p-4 rounded-2xl bg-[var(--surface-container-low)] dark:bg-gray-800 transition-all duration-300 ${
          clickable ? `cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 ${
            isHovered ? 'surface-elevation-2' : 'surface-elevation-3'
          } ${isPressed ? 'scale-95' : ''}` : ""
        } ${className}`}
        style={{
          transform: isPressed ? 'scale(0.95)' : isHovered && clickable ? 'translateY(-4px)' : 'translateY(0)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-300">
            {title}
          </div>
          {headerActions}
        </div>
        <div className="transition-all duration-300">{children}</div>
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
    return <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400">No chart data</div>;
  }
  const display = limit ? data.slice(0, limit) : data;
  const values = display.map((d) => Math.max(0, Number(d.value ?? d.progress ?? d.count ?? 0)));
  const maxValue = Math.max(1, ...values);
  const itemCount = display.length;
  // Calculate dimensions
  const chartPadding = { top: 40, right: 20, bottom: 60, left: 60 };
  const chartWidth = itemCount * (barWidth + gap) - gap;
  const svgWidth = Math.max(chartPadding.left + chartWidth + chartPadding.right, 300);
  const svgHeight = chartPadding.top + height + chartPadding.bottom;
  const innerHeight = height;
  // Calculate y-axis ticks (5 ticks including 0)
  const ticks = 5;
  const tickValues = new Array(ticks).fill(0).map((_, i) => Math.round((maxValue * (ticks - 1 - i)) / (ticks - 1)));
  // Format numbers compactly
  const formatValue = (n) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
    return String(n);
  };
  // Get color for each bar (using a cohesive palette)
  const getColorForIndex = (index) => {
    const colors = [
      '#5470C6', // Blue
      '#91CC75', // Green
      '#FAC858', // Yellow
      '#EE6666', // Red
      '#73C0DE', // Cyan
      '#3BA272', // Teal
      '#FC8452'  // Orange
    ];
    return colors[index % colors.length];
  };
  // Handle tooltip display
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
  const handleMouseMove = (e, name, value, color) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setTooltip({
      visible: true,
      x: x + 10,
      y: y + 10,
      content: `
        <div style="padding: 6px; background: var(--surface-container-low); border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
          <div style="color: ${color}; font-weight: 500; margin-bottom: 4px;">${name}</div>
          <div style="font-weight: 600;">${formatValue(value)}%</div>
          <div style="color: var(--on-surface-variant); font-size: 11px; margin-top: 2px;">${yLabel}</div>
        </div>
      `
    });
  };
  const handleMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, content: '' });
  };
  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={`${yLabel} bar chart`} style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        aria-hidden={false}
        onMouseLeave={handleMouseLeave}
      >
        {/* Grid lines and background */}
        <rect
          x={chartPadding.left - 10}
          y={chartPadding.top - 10}
          width={svgWidth - chartPadding.left - chartPadding.right + 20}
          height={innerHeight + 20}
          rx="4"
          className="fill-gray-200 dark:fill-gray-900"
          stroke="var(--outline-variant)"
          strokeWidth="1"
        />
        {/* Horizontal grid lines */}
        {tickValues.map((tv, i) => {
          const y = chartPadding.top + (innerHeight * i) / (ticks - 1);
          return (
            <g key={i}>
              <line
                x1={chartPadding.left}
                x2={svgWidth - chartPadding.right}
                y1={y}
                y2={y}
                stroke={i === ticks - 1 ? "var(--outline)" : "var(--outline-variant)"}
                strokeDasharray={i === ticks - 1 ? "0" : "2,2"}
                strokeWidth={i === ticks - 1 ? "1.5" : "1"}
                className="dark:stroke-[var(--outline-variant)]"
              />
              <text
                x={chartPadding.left - 12}
                y={y + 4}
                fontSize="11"
                textAnchor="end"
                fontFamily="Inter, system-ui, sans-serif"
                className="fill-black dark:fill-white"
              >
                {formatValue(tv, true)}
              </text>
            </g>
          );
        })}
        {/* Y-axis title */}
        <text
          x={16}
          y={chartPadding.top + innerHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${chartPadding.top + innerHeight / 2})`}
          fontSize="12"
          fontWeight="500"
          fontFamily="Inter, system-ui, sans-serif"
          className="fill-black dark:fill-white"
        >
          {yLabel}
        </text>
        {/* X-axis title */}
        <text
          x={svgWidth / 2}
          y={svgHeight - 12}
          textAnchor="middle"
          fontSize="12"
          fontWeight="500"
          fontFamily="Inter, system-ui, sans-serif"
          className="fill-black dark:fill-white"
        >
          {t("dashboard.groupChart.xAxisTitle", "Groups")}
        </text>
        {/* Bars group */}
        <g transform={`translate(${chartPadding.left}, ${chartPadding.top})`}>
          {display.map((d, i) => {
            const val = values[i];
            const x = i * (barWidth + gap);
            const proportion = val / maxValue;
            const barHeight = innerHeight * proportion;
            const barY = innerHeight - barHeight;
            const color = d.color || getColorForIndex(i);
            const label = d.name ?? d.label ?? d.title ?? `#${i + 1}`;
            return (
              <g 
                key={i} 
                transform={`translate(${x},0)`}
                onMouseMove={(e) => handleMouseMove(e, label, val, color)}
                onMouseLeave={handleMouseLeave}
              >
                {/* Bar with shadow effect */}
                <rect
                  x={0}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  stroke={color}
                  strokeWidth="1"
                  className="transition-all duration-300 hover:opacity-90"
                  style={{ 
                    filter: animated ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' : 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => setHoveredBar(i)}
                  aria-valuenow={val}
                  aria-valuemin={0}
                  aria-valuemax={maxValue}
                  aria-label={`${label}: ${formatValue(val, true)}`}
                />
                {/* Value label on top of bar */}
                <text
                  x={barWidth / 2}
                  y={Math.max(20, barY - 8)}
                  fontSize="11"
                  fontWeight="600"
                  textAnchor="middle"
                  fontFamily="Inter, system-ui, sans-serif"
                  className="fill-black dark:fill-white"
                >
                  {formatValue(val, true)}
                </text>
                {/* X-axis label below bar */}
                <text
                  x={barWidth / 2}
                  y={innerHeight + 26}
                  fontSize="11"
                  textAnchor="middle"
                  fontFamily="Inter, system-ui, sans-serif"
                  className="fill-black dark:fill-white"
                  style={{ 
                    maxWidth: `${barWidth}px`, 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap'
                  }}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {/* Tooltip that appears on hover */}
      {tooltip.visible && (
        <div 
          className="absolute z-10 pointer-events-none"
          style={{ 
            left: `${tooltip.x}px`, 
            top: `${tooltip.y}px`,
            maxWidth: '250px'
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.content }}
        />
      )}
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
    if (!items || !items.length) return <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-300">No tasks</div>;
    const display = items.slice(0, maxItems);
    return (
      <div className="space-y-3 transition-all duration-300">
        {display.map((it, idx) => {
          const value = Math.max(0, Math.min(100, Math.round(Number(it.progress ?? it.value ?? 0))));
          const color = it.color || `hsl(${(idx * 50) % 360},70%,50%)`;
          return (
            <div 
              key={idx} 
              className="flex items-center gap-3 transition-all duration-300 ease-out"
              style={{
                animationDelay: `${idx * 100}ms`,
                transitionDelay: `${idx * 50}ms`
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-[var(--on-surface)] dark:text-white truncate transition-all duration-300">
                    {it.label}
                  </div>
                  <div className="text-sm font-semibold text-[var(--on-surface-variant)] dark:text-gray-400 ml-2 transition-all duration-300">
                    {value}%
                  </div>
                </div>
                <div
                  className="mt-2 w-full bg-[var(--surface-container)] dark:bg-gray-700 rounded-full h-2.5 overflow-hidden transition-all duration-300"
                  role="progressbar"
                  aria-valuenow={value}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${it.label} progress`}
                >
                  <div 
                    title={`${it.label}: ${value}%`} 
                    style={{ 
                      width: animated ? `0%` : `${value}%`, 
                      background: color 
                    }} 
                    className="h-2.5 rounded-full transition-all duration-1000 ease-out" 
                  />
                </div>
              </div>
            </div>
          );
        })}
        {items.length > maxItems && <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-300">+{items.length - maxItems} more</div>}
      </div>
    );
  };

  /* PieChart */
  const PieChart = ({ slices = [], size = 220 }) => {
    const [animated, setAnimated] = useState(false);
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
      if (key.includes("approve") || key.includes("approved") || key === "approved") return "#10B981";
      if (key.includes("reject") || key.includes("rejected") || key === "rejected") return "#EF4444";
      if (key.includes("pending") || key === "pending") return "#F59E0B";
      return `hsl(${(i * 70) % 360}, 70%, 60%)`;
    };
    if (total === 0) {
      return (
        <div className="flex items-center justify-center h-32 transition-all duration-300">
          <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400">{t("reports.noReports3")}</div>
        </div>
      );
    }
    const nonZero = items.filter((x) => Number(x.value ?? x.count ?? 0) > 0);
    const cx = size / 2;
    const cy = size / 2;
    const r = Math.min(80, size / 2 - 6);
    const innerR = Math.max(3, r - 20);
    if (nonZero.length === 1) {
      const s = nonZero[0];
      const fill = getColorFor(s, items.indexOf(s));
      return (
        <div className="flex md:flex-col flex-row items-center gap-4 transition-all duration-300">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="transition-all duration-1000 transform hover:scale-110">
            <circle cx={cx} cy={cy} r={r} fill={fill} stroke="#fff" strokeWidth="1" className="dark:stroke-[var(--surface-container-low)] transition-all duration-300" />
            <circle cx={cx} cy={cy} r={innerR} fill="#fff" className="dark:fill-[var(--surface-container-low)] transition-all duration-300" />
            <text x={cx} y={cy} textAnchor="middle" dy="5" fontSize="14" className="fill-current text-[var(--on-surface)] dark:text-white font-semibold transition-all duration-300">
              {total}
            </text>
          </svg>
          <div className="flex-1 min-w-0 transition-all duration-300">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-1">
              {items.map((it, i) => {
                const val = Number(it.value ?? it.count ?? 0);
                const pct = Math.round((val / total) * 100);
                return (
                  <div key={i} className="flex items-center gap-2 text-sm transition-all duration-300">
                    <span style={{ background: getColorFor(it, i) }} className="w-3 h-3 rounded-sm inline-block flex-shrink-0 transition-all duration-300 transform hover:scale-125" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="truncate text-[var(--on-surface)] dark:text-white transition-all duration-300 hover:scale-105">{it.label}</div>
                        <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400 ml-2 transition-all duration-300">({pct}%)</div>
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
      <div className="flex md:flex-col flex-row items-center gap-2 sm:gap-14 transition-all duration-300">
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
                stroke="#fff" 
                className="dark:stroke-[var(--surface-container-low)] transition-all duration-1000" 
                strokeWidth="1"
                style={{
                  transformOrigin: `${cx}px ${cy}px`,
                  transform: animated ? 'scale(0)' : 'scale(1)',
                  transition: `transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 200}ms`
                }}
              />
            );
          })}
          <circle cx={cx} cy={cy} r={innerR} className="fill-white dark:fill-gray-800 transition-all duration-300" />
          <text x={cx} y={cy} textAnchor="middle" dy="5" fontSize="14" className="fill-current text-[var(--on-surface)] dark:text-white font-semibold transition-all duration-300">
            {total}
          </text>
        </svg>
        <div className="flex-1 min-w-0 transition-all duration-300">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {items.map((it, i) => {
              const val = Number(it.value ?? it.count ?? 0);
              const pct = Math.round((val / total) * 100);
              return (
                <div key={i} className="flex items-center gap-2 text-sm transition-all duration-300">
                  <span style={{ background: getColorFor(it, i) }} className="w-3 h-3 rounded-sm inline-block flex-shrink-0 transition-all duration-300 transform hover:scale-125" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="truncate text-[var(--on-surface)] dark:text-white transition-all duration-300 hover:scale-105">{it.label}</div>
                      <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400 ml-2 transition-all duration-300">({pct}%)</div>
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
    if (loading) return <LoadingSkeleton className="h-40 w-full transition-all duration-300" />;
    if (!rows.length) return <div className="p-3 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-300">{t("dashboard.noOverdue")}</div>;
    return (
      <div className="overflow-auto transition-all duration-300">
        <table className="w-full text-sm transition-all duration-300">
          <thead className="text-left text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 bg-[var(--surface-container-low)] dark:bg-gray-800 transition-all duration-300">
            <tr>
              <th className="p-2 transition-all duration-300">{t("dashboard.table.task")}</th>
              <th className="p-2 transition-all duration-300">{t("dashboard.table.due")}</th>
              <th className="p-2 transition-all duration-300">{t("dashboard.table.daysOverdue")}</th>
              <th className="p-2 transition-all duration-300">{t("dashboard.table.goal")}</th>
              <th className="p-2 transition-all duration-300">{t("dashboard.table.group")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, index) => (
              <tr 
                key={r.id || r.taskId} 
                className="border-b border-[var(--outline-variant)] dark:border-gray-700 hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 transition-all duration-300"
                style={{
                  animationDelay: `${index * 50}ms`,
                  transitionDelay: `${index * 30}ms`
                }}
              >
                <td className="p-2 text-[var(--on-surface)] dark:text-white transition-all duration-300">{r.taskTitle}</td>
                <td className="p-2 text-[var(--on-surface)] dark:text-white transition-all duration-300">{formatDate(r.dueDate)}</td>
                <td className="p-2 transition-all duration-300">
                  <span className="px-2 py-1 bg-[var(--error-container)] dark:bg-red-900 text-[var(--on-error-container)] dark:text-red-200 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-110">
                    {r.days_overdue ?? r.daysOverdue ?? 0}
                  </span>
                </td>
                <td className="p-2 text-[var(--on-surface)] dark:text-white transition-all duration-300">{r.goalTitle}</td>
                <td className="p-2 text-[var(--on-surface)] dark:text-white transition-all duration-300">{r.groupName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const NotificationsPanel = ({ notifications = [], unread = 0, loading, onMarkAsRead, marking, t, navigate }) => {
    if (loading) return <LoadingSkeleton className="h-32 w-full transition-all duration-300" />;
    if (!notifications.length) return <div className="p-3 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-300">{t("dashboard.noNotifications")}</div>;
    return (
      <div className="transition-all duration-300">
        <div className="flex items-center justify-between mb-3 transition-all duration-300">
          <div className="flex items-center gap-2 transition-all duration-300">
            <span className="text-sm text-[var(--on-primary)] dark:text-green-200 bg-[var(--primary-container)] dark:bg-indigo-900 px-2 py-0.5 rounded-full font-medium transition-all duration-300 transform hover:scale-125">
              {unread}
            </span>
            {unread > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead();
                }}
                disabled={marking}
                className="text-sm text-[var(--primary)] dark:text-indigo-400 hover:underline disabled:opacity-50 transition-all duration-300 transform hover:scale-105"
              >
                {marking ? t("dashboard.notifications.marking") : t("dashboard.notifications.markAll")}
              </button>
            )}
          </div>
        </div>
        <ul className="space-y-2 transition-all duration-300">
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
                className={`w-full text-left p-3 rounded-xl transition-all duration-300 ${
                  n.isRead 
                    ? "bg-[var(--surface-container-low)] dark:bg-gray-800 hover:bg-[var(--surface-container)] dark:hover:bg-gray-700" 
                    : "bg-green-400/[0.08] dark:bg-indigo-900/[0.3] hover:bg-green-400/[0.15] dark:hover:bg-indigo-900/[0.5]"
                }`}
                style={{
                  animationDelay: `${index * 100}ms`,
                  transitionDelay: `${index * 50}ms`
                }}
              >
                <div className="text-sm mb-1 text-[var(--on-surface)] dark:text-white transition-all duration-300">{n.message || n.type}</div>
                <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-300">{new Date(n.createdAt || n.time || n._raw?.createdAt).toLocaleString()}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const AuditPanel = ({ logs = [], loading, auditPermDenied = false, t }) => {
    if (loading) return <LoadingSkeleton className="h-32 w-full transition-all duration-300" />;
    if (auditPermDenied) return <div className="p-3 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-300">{t("dashboard.audit.noPermission")}</div>;
    if (!logs.length) return <div className="p-3 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-300">{t("dashboard.audit.noLogs")}</div>;
    return (
      <div className="transition-all duration-300">
        <ul className="space-y-2 transition-all duration-300">
          {logs.map((l, index) => (
            <li 
              key={l.id} 
              className="p-3 bg-[var(--surface-container-low)] dark:bg-gray-800 rounded-xl border border-[var(--outline-variant)] dark:border-gray-700 transition-all duration-300 hover:shadow"
              style={{
                animationDelay: `${index * 80}ms`,
                transitionDelay: `${index * 40}ms`
              }}
            >
              <div className="flex justify-between items-start transition-all duration-300">
                <div className="transition-all duration-300">
                  <span className="font-medium text-[var(--on-surface)] dark:text-white transition-all duration-300">{l.userName || `User ${l.userId}`}</span>
                  <span className="text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-300"> {l.action} </span>
                  <span className="text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-300"> {l.entity}</span>
                </div>
                <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400 whitespace-nowrap transition-all duration-300">
                  {new Date(l.createdAt || l._raw?.createdAt).toLocaleString()}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // PERCENTAGES
  const overall_goal_progress = parseNum(summary.overall_goal_progress, null);
  const overall_task_progress = parseNum(summary.overall_task_progress, null);
  const overall_activity_progress = parseNum(summary.overall_activity_progress, null);
  // pending reports
  const pending_reports = parseNum(summary.pending_reports, 0);
  // EXACT COUNTS from your JSON
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

  return (
    <div className={`min-h-screen bg-[var(--background)] dark:bg-gray-900 font-sans transition-colors duration-300 ${mounted ? 'animate-fade-in' : ''}`} 
      style={{
        "--primary": m3Colors.primary,
        "--on-primary": m3Colors.onPrimary,
        "--primary-container": m3Colors.primaryContainer,
        "--on-primary-container": m3Colors.onPrimaryContainer,
        "--secondary": m3Colors.secondary,
        "--on-secondary": m3Colors.onSecondary,
        "--secondary-container": m3Colors.secondaryContainer,
        "--on-secondary-container": m3Colors.onSecondaryContainer,
        "--tertiary": m3Colors.tertiary,
        "--on-tertiary": m3Colors.onTertiary,
        "--tertiary-container": m3Colors.tertiaryContainer,
        "--on-tertiary-container": m3Colors.onTertiaryContainer,
        "--error": m3Colors.error,
        "--on-error": m3Colors.onError,
        "--error-container": m3Colors.errorContainer,
        "--on-error-container": m3Colors.onErrorContainer,
        "--background": m3Colors.background,
        "--on-background": m3Colors.onBackground,
        "--surface": m3Colors.surface,
        "--on-surface": m3Colors.onSurface,
        "--surface-variant": m3Colors.surfaceVariant,
        "--on-surface-variant": m3Colors.onSurfaceVariant,
        "--outline": m3Colors.outline,
        "--outline-variant": m3Colors.outlineVariant,
        "--shadow": m3Colors.shadow,
        "--scrim": m3Colors.scrim,
        "--inverse-surface": m3Colors.inverseSurface,
        "--inverse-on-surface": m3Colors.inverseOnSurface,
        "--inverse-primary": m3Colors.inversePrimary,
        "--surface-container-lowest": m3Colors.surfaceContainerLowest,
        "--surface-container-low": m3Colors.surfaceContainerLow,
        "--surface-container": m3Colors.surfaceContainer,
        "--surface-container-high": m3Colors.surfaceContainerHigh,
        "--surface-container-highest": m3Colors.surfaceContainerHighest,
      }}
    >
      <style>{`
        :root {
          --primary: ${m3Colors.primary};
          --on-primary: ${m3Colors.onPrimary};
          --primary-container: ${m3Colors.primaryContainer};
          --on-primary-container: ${m3Colors.onPrimaryContainer};
          --secondary: ${m3Colors.secondary};
          --on-secondary: ${m3Colors.onSecondary};
          --secondary-container: ${m3Colors.secondaryContainer};
          --on-secondary-container: ${m3Colors.onSecondaryContainer};
          --tertiary: ${m3Colors.tertiary};
          --on-tertiary: ${m3Colors.onTertiary};
          --tertiary-container: ${m3Colors.tertiaryContainer};
          --on-tertiary-container: ${m3Colors.onTertiaryContainer};
          --error: ${m3Colors.error};
          --on-error: ${m3Colors.onError};
          --error-container: ${m3Colors.errorContainer};
          --on-error-container: ${m3Colors.onErrorContainer};
          --background: ${m3Colors.background};
          --on-background: ${m3Colors.onBackground};
          --surface: ${m3Colors.surface};
          --on-surface: ${m3Colors.onSurface};
          --surface-variant: ${m3Colors.surfaceVariant};
          --on-surface-variant: ${m3Colors.onSurfaceVariant};
          --outline: ${m3Colors.outline};
          --outline-variant: ${m3Colors.outlineVariant};
          --shadow: ${m3Colors.shadow};
          --scrim: ${m3Colors.scrim};
          --inverse-surface: ${m3Colors.inverseSurface};
          --inverse-on-surface: ${m3Colors.inverseOnSurface};
          --inverse-primary: ${m3Colors.inversePrimary};
          --surface-container-lowest: ${m3Colors.surfaceContainerLowest};
          --surface-container-low: ${m3Colors.surfaceContainerLow};
          --surface-container: ${m3Colors.surfaceContainer};
          --surface-container-high: ${m3Colors.surfaceContainerHigh};
          --surface-container-highest: ${m3Colors.surfaceContainerHighest};
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes material-in {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-in-up {
          animation: slideInUp 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .surface-elevation-1 { 
          box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04); 
        }
        .surface-elevation-2 { 
          box-shadow: 0 2px 6px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06); 
        }
        .surface-elevation-3 { 
          box-shadow: 0 4px 12px rgba(0,0,0,0.12), 0 24px 24px rgba(0,0,0,0.18); 
        }
      `}</style>
      <div className="max-w-8xl mx-auto px-4 py-6">
        {/* Card-style Header */}
        <div className="mb-6">
  <div className="rounded-2xl bg-[var(--surface-container-low)] dark:bg-gray-800 surface-elevation-3 px-4 py-4">
    <div className="flex flex-col md:flex-row md:items-center gap-4">
      {/* Top row: Icon + Title + Subtitle + TopBar */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center min-w-0 gap-4">
          <div className="p-3 rounded-xl bg-[var(--primary-container)] dark:bg-indigo-900 surface-elevation-2">
            <Home className="h-6 w-6 text-[var(--on-primary-container)] dark:text-indigo-200" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[var(--on-surface)] dark:text-white truncate transition-colors duration-300">
              {t("dashboard.title")}
            </h1>
            <p className="mt-0.5 text-base text-[var(--on-surface-variant)] dark:text-gray-400 max-w-2xl">
              {t("dashboard.subtitle")}
            </p>
          </div>
        </div>
        
      </div>
      {/* Refresh button below on mobile, same row on desktop */}
      <div className="w-full md:w-auto mt-3 md:mt-0">
        <button
          onClick={handleRefresh}
          className={`w-full md:w-auto px-4 py-2.5 rounded-full bg-[var(--surface-container-low)] dark:bg-gray-800 border border-[var(--outline-variant)] dark:border-gray-700 text-[var(--on-surface)] dark:text-white hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 flex items-center justify-center md:justify-start gap-2 transition-all duration-300 surface-elevation-2 ${
            refreshing ? "animate-pulse" : ""
          }`}
          aria-label={t("dashboard.aria.refresh")}
          disabled={loading}
        >
          <svg
            className={`w-4 h-4 transition-all duration-300 ${
              loading || refreshing ? "animate-spin" : ""
            }`}
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
          <span className="text-base transition-all duration-300">
            {t("dashboard.refresh")}
          </span>
        </button>
      </div>
      <div className="flex-shrink-0">
          <TopBar />
        </div>
    </div>
  </div>
</div>
        {error && (
          <div className="p-3 mb-5 bg-[var(--error-container)] dark:bg-red-900 border border-[var(--error-container)] dark:border-red-800 text-[var(--on-error-container)] dark:text-red-200 rounded-xl transition-all duration-300 surface-elevation-3">
            {error}
          </div>
        )}
        {/* BENTO GRID */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* KPI cards */}
          <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Goals Card */}
            <Card title={t("dashboard.cards.goals.title")} onClick={goToGoals} ariaLabel={t("dashboard.cards.goals.aria")}>
              {loading ? (
                <LoadingSkeleton className="h-8 w-24 transition-all duration-300" />
              ) : (
                <div className="transition-all duration-300">
                  <div className="text-3xl font-bold text-[var(--on-surface)] dark:text-white transition-all duration-300">
                    {hasGoalPercent ? `${overall_goal_progress.toFixed(2)}%` : goalsTotal > 0 ? `${goalsFinished} of ${goalsTotal}` : "-"}
                    <sub className="text-xs ml-1 transition-all duration-300">{t("dashboard.percentage")}</sub>
                  </div>
                  {goalsTotal > 0 && (
                    <div className="text-base text-[var(--on-surface-variant)] dark:text-gray-400 mt-1 transition-all duration-300">
                      {`${goalsFinished} ${t("dashboard.cards.goals.outOf")} ${goalsTotal} ${t("dashboard.cards.goals.title").toLowerCase()} ${t("dashboard.cards.goals.haveBeenDone")}`}
                    </div>
                  )}
                  <div className="text-base text-[var(--on-surface-variant)] dark:text-gray-400 mt-1 transition-all duration-300">
                    {goalDelta ? (
                      <span className={`transition-all duration-300 ${
                        goalDelta.startsWith("+") ? "text-[var(--primary)] dark:text-green-400" : "text-[var(--error)] dark:text-red-400"
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
                <LoadingSkeleton className="h-8 w-24 transition-all duration-300" />
              ) : (
                <div className="transition-all duration-300">
                  <div className="text-3xl font-bold text-[var(--on-surface)] dark:text-white transition-all duration-300">
                    {hasTaskPercent ? `${overall_task_progress.toFixed(2)}%` : tasksTotal > 0 ? `${tasksFinished} of ${tasksTotal}` : "-"}
                    <sub className="text-xs ml-1 transition-all duration-300">{t("dashboard.percentage")}</sub>
                  </div>
                  {tasksTotal > 0 && <div className="text-base text-[var(--on-surface-variant)] dark:text-gray-400 mt-1 transition-all duration-300">{`${tasksFinished} ${t("dashboard.cards.tasks.outOf")} ${tasksTotal} ${t("dashboard.cards.tasks.title").toLowerCase()} ${t("dashboard.cards.tasks.haveBeenDone")}`}</div>}
                  <div className="text-base text-[var(--on-surface-variant)] dark:text-gray-400 mt-1 transition-all duration-300">{t("dashboard.cards.tasks.subtitle")}</div>
                </div>
              )}
            </Card>
            {/* Activities Card */}
            <Card title={t("dashboard.cards.activities.title")} onClick={goToActivities} ariaLabel={t("dashboard.cards.activities.aria")}>
              {loading ? (
                <LoadingSkeleton className="h-8 w-24 transition-all duration-300" />
              ) : (
                <div className="transition-all duration-300">
                  <div className="text-3xl font-bold text-[var(--on-surface)] dark:text-white transition-all duration-300">
                    {hasActivityPercent ? `${overall_activity_progress.toFixed(2)}%` : activitiesTotal > 0 ? `${activitiesFinished} of ${activitiesTotal}` : "-"}
                    <sub className="text-xs ml-1 transition-all duration-300">{t("dashboard.percentage")}</sub>
                  </div>
                  {activitiesTotal > 0 && <div className="text-base text-[var(--on-surface-variant)] dark:text-gray-400 mt-1 transition-all duration-300">{`${activitiesFinished} ${t("dashboard.cards.activities.outOf")} ${activitiesTotal} ${t("dashboard.cards.activities.title").toLowerCase()} ${t("dashboard.cards.activities.haveBeenDone")}`}</div>}
                  <div className="text-base text-[var(--on-surface-variant)] dark:text-gray-400 mt-1 transition-all duration-300">{t("dashboard.cards.activities.subtitle")}</div>
                </div>
              )}
            </Card>
            {/* Pending Reports Card */}
            <Card title={t("dashboard.cards.pendingReports.title")} onClick={goToPendingReports} ariaLabel={t("dashboard.cards.pendingReports.aria")}>
              {loading ? (
                <LoadingSkeleton className="h-8 w-24 transition-all duration-300" />
              ) : (
                <div className="transition-all duration-300">
                  <div className="text-3xl font-bold text-[var(--on-surface)] dark:text-white transition-all duration-300">
                    {pending_reports ?? 0}
                  </div>
                  <div className="text-base text-[var(--on-surface-variant)] dark:text-gray-400 mt-1 transition-all duration-300">{t("dashboard.cards.pendingReports.subtitle")}</div>
                </div>
              )}
            </Card>
          </div>
          {/* Charts */}
          <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card title={t("dashboard.groupProgress")} onClick={() => setShowGroupModal(true)} className="p-4 flex flex-col justify-between h-full">
              {loading ? (<LoadingSkeleton className="h-28 transition-all duration-300" />) : (<div className="mt-3 transition-all duration-300"><GroupBarChart data={(dashboardData.groupBars || []).map((g) => ({ name: g.name, progress: g.progress, value: g.progress, color: g.color }))} limit={5} barWidth={80} gap={30} yLabel="Office progress" height={320}/></div>)}
            </Card>
            <Card title={t("dashboard.topTasks")} onClick={() => setShowTasksModal(true)} className="p-4">
              {loading ? (<LoadingSkeleton className="h-28 transition-all duration-300" />) : (<TaskBarChart items={(dashboardData.taskBars || []).map((x) => ({ label: x.label ?? x.name, progress: Number(x.progress ?? x.value ?? 0), color: x.color }))} maxItems={4} />)}
            </Card>
            <Card title={t("dashboard.reportsDistribution1")} onClick={() => navigate("/report")} className="p-4" ariaLabel={t("dashboard.reportsDistribution.aria")}>
              {loading ? <LoadingSkeleton className="h-28 transition-all duration-300" /> : <div className="flex justify-center transition-all duration-300"><PieChart slices={(dashboardData.reportsPie || []).map((r) => ({ value: r.count, label: r.label, color: r.color }))} /></div>}
            </Card>
          </div>
          {hasAuditPerm && (
            <div className="lg:col-span-12 transition-all duration-300">
              <Card title={t("dashboard.audit.title")} onClick={goToAudit}>
                <AuditPanel logs={dashboardData.auditLogs} loading={loading} auditPermDenied={auditPermDenied} t={t} />
              </Card>
            </div>
          )}
          {/* Overdue + Notifications */}
          <div className="lg:col-span-8 transition-all duration-300">
            <Card
              title={
                <div className="flex items-center justify-between h-6 min-w-0 transition-all duration-300">
                  <span className="text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 truncate transition-all duration-300">
                    {t("dashboard.overdueTitle")}
                  </span>
                  <span className="text-sm font-medium bg-[var(--error-container)] dark:bg-red-900 text-[var(--on-error-container)] dark:text-red-200 ml-2 px-2 py-0.5 rounded-full transition-all duration-300">
                    {(dashboardData.overdueRows || []).length} {t("dashboard.tasks")}
                  </span>
                </div>
              }
              headerActions={
                <div className="flex items-center gap-2 transition-all duration-300">
                  <button 
                    onClick={(e) => { e.stopPropagation(); goToTasks(); }} 
                    className="text-sm text-[var(--primary)] dark:text-indigo-400 transition-all duration-300"
                  >
                    {t("dashboard.openAll")}
                  </button>
                </div>
              }
            >
              <OverdueTable rows={dashboardData.overdueRows} loading={loading} t={t} />
            </Card>
          </div>
          <div className="lg:col-span-4 transition-all duration-300">
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
          {loading ? <LoadingSkeleton className="h-36 transition-all duration-300" /> : <div className="overflow-x-auto transition-all duration-300"><div className="flex gap-5 items-end pb-4 transition-all duration-300">{(dashboardData.groups || []).map((g, idx) => (<div key={g.groupId ?? g.id ?? idx} className="flex flex-col items-center min-w-[80px] transition-all duration-300"><div className="w-10 h-32 bg-[var(--surface-container)] dark:bg-gray-700 rounded-xl overflow-hidden flex items-end transition-all duration-1000"><div style={{ height: `${Math.max(6, Math.round((Number(g.value ?? g.progress ?? 0) / Math.max(1, ...((dashboardData.groups || []).map(x=>Number(x.value ?? x.progress ?? 0)))))*100))}%`, background: g.color }} className="w-full transition-all duration-1000 ease-out" /></div><div className="text-sm text-center text-[var(--on-surface)] dark:text-white mt-2 break-words max-w-[100px] min-h-[2.5rem] flex items-center justify-center transition-all duration-300">{g.name}</div><div className="text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 mt-1 transition-all duration-300">{Math.round(Number(g.value ?? g.progress ?? 0))}%</div></div>))}</div></div>}
        </Modal>
        <Modal open={showTasksModal} onClose={() => setShowTasksModal(false)} title={t("dashboard.topTasks")}>
          {loading ? (<LoadingSkeleton className="h-36 transition-all duration-300" />) : (<div className="space-y-4 transition-all duration-300"><TaskBarChart items={(dashboardData.taskBars || []).map((x) => ({ label: x.label ?? x.name, progress: Number(x.progress ?? x.value ?? 0), color: x.color }))} maxItems={dashboardData.taskBars.length || 1000} /></div>)}
        </Modal>
        <div aria-live="polite" className="sr-only transition-all duration-300">{loading ? t("dashboard.aria.loading") : t("dashboard.aria.loaded")}</div>
      </div>
    </div>
  );
};

export default App;