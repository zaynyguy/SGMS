// src/pages/DashboardPage.jsx
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
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 transition-all duration-300 ease-out ${
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
        className={`relative z-10 w-full max-w-4xl max-h-[90vh] overflow-auto bg-white dark:bg-gray-900 rounded-lg shadow-xl p-3 sm:p-4 transform transition-all duration-500 ease-out ${
          open && !isAnimating ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-8'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 transition-all duration-300">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all duration-300 transform hover:scale-125 hover:rotate-90"
          >
            ✕
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
      className={`text-left p-3 rounded-xl bg-white dark:bg-gray-800 shadow-sm transition-all duration-500 ease-out transform ${
        clickable ? `hover:shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-400/30 ${
          isHovered ? '-translate-y-1 scale-105' : 'translate-y-0 scale-100'
        } ${isPressed ? 'scale-95' : ''}` : ""
      } ${className}`}
      style={{
        transform: `translateY(${isHovered && clickable ? '-4px' : '0px'}) scale(${isPressed ? 0.95 : isHovered && clickable ? 1.05 : 1})`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs text-gray-500 dark:text-gray-400 transition-all duration-300 transform ">
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
    return <div className="text-xs text-gray-500 dark:text-gray-400">No chart data</div>;
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

  // a single cohesive color like your screenshot
  const barColor = "#4F7AE6";
  const bg = "#F3F7FB"; // light band for chart area (body) if wanted

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
            <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#0b3bff" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* background behind chart area */}
        <rect
          x={chartPadding.left - 8}
          y={chartPadding.top - 12}
          width={svgWidth - chartPadding.left - chartPadding.right + 16}
          height={innerHeight + 24}
          rx="8"
          fill={bg}
          className="dark:fill-gray-800/20"
        />

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
                stroke={isZero ? "#D1D5DB" : "#E6EEF8"}
                className="dark:stroke-gray-700"
                strokeWidth={isZero ? 1.2 : 1}
              />
              <text
                x={chartPadding.left - 12}
                y={y + 4}
                fontSize="12"
                textAnchor="end"
                fill="#6B7280"
                className="dark:fill-gray-400"
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
          fill="#374151"
          className="dark:fill-gray-300"
          style={{ fontWeight: 600 }}
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
                  fill="#1F2937"
                  className="dark:fill-gray-200"
                  style={{ fontWeight: 700 }}
                >
                  {formatCompact(val)}
                </text>

                {/* x-axis labels */}
                <text
                  x={barWidth / 2}
                  y={innerHeight + 20}
                  fontSize="12"
                  textAnchor="middle"
                  fill="#374151"
                  className="dark:fill-gray-300"
                  style={{ transformOrigin: "center", whiteSpace: "pre-line" }}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>

        {/* x-axis baseline */}
        {/* <line
          x1={chartPadding.left}
          x2={svgWidth - chartPadding.right}
          y1={chartPadding.top + innerHeight + 6}
          y2={chartPadding.top + innerHeight + 6}
          stroke="#E5E7EB"
          className="dark:stroke-gray-700"
          strokeWidth={1}
        /> */}
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

  if (!items || !items.length) return <div className="text-xs text-gray-500 dark:text-gray-400 transition-all duration-500">No tasks</div>;
  const display = items.slice(0, maxItems);
  return (
    <div className="space-y-2 transition-all duration-500">
      {display.map((it, idx) => {
        const value = Math.max(0, Math.min(100, Math.round(Number(it.progress ?? it.value ?? 0))));
        const color = it.color || `hsl(${(idx * 50) % 360},70%,50%)`;
        return (
          <div 
            key={idx} 
            className="flex items-center gap-2 transition-all duration-500 ease-out transform hover:translate-x-1.5"
            style={{
              animationDelay: `${idx * 100}ms`,
              transitionDelay: `${idx * 50}ms`
            }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate transition-all duration-300 hover:scale-105">
                  {it.label}
                </div>
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 ml-1.5 transition-all duration-500 transform hover:scale-125">
                  {value}%
                </div>
              </div>

              <div
                className="mt-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden transition-all duration-500"
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${it.label} progress`}
              >
                <div 
                  title={`${it.label}: ${value}%`} 
                  style={{ 
                    width: animated ? `${value}%` : '0%', 
                    background: color 
                  }} 
                  className="h-2 rounded-full transition-all duration-1000 ease-out" 
                />
              </div>
            </div>
          </div>
        );
      })}
      {items.length > maxItems && <div className="text-xs text-gray-500 dark:text-gray-400 transition-all duration-500">+{items.length - maxItems} more</div>}
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
    if (key.includes("approve") || key.includes("approved") || key === "approved") return "#10B981";
    if (key.includes("reject") || key.includes("rejected") || key === "rejected") return "#EF4444";
    if (key.includes("pending") || key === "pending") return "#F59E0B";
    return `hsl(${(i * 70) % 360}, 70%, 60%)`;
  };

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-32 transition-all duration-500">
        <div className="text-xs text-gray-500 dark:text-gray-400">{t("reports.noReports3")}</div>
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
      <div className="flex md:flex-col flex-row items-center gap-3 transition-all duration-500">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="transition-all duration-1000 transform hover:scale-110">
          <circle cx={cx} cy={cy} r={r} fill={fill} stroke="#fff" strokeWidth="1" className="dark:stroke-gray-800 transition-all duration-500" />
          <circle cx={cx} cy={cy} r={innerR} fill="#fff" className="dark:fill-gray-800 transition-all duration-500" />
          <text x={cx} y={cy} textAnchor="middle" dy="5" fontSize="12" className="fill-current text-gray-900 dark:text-gray-100 font-semibold transition-all duration-500">
            {total}
          </text>
        </svg>

        <div className="flex-1 min-w-0 transition-all duration-500">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-1">
            {items.map((it, i) => {
              const val = Number(it.value ?? it.count ?? 0);
              const pct = Math.round((val / total) * 100);
              return (
                <div key={i} className="flex items-center gap-2 text-xs transition-all duration-500 transform hover:translate-x-1.5">
                  <span style={{ background: getColorFor(it, i) }} className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0 transition-all duration-300 transform hover:scale-125" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="truncate text-gray-700 dark:text-gray-300 transition-all duration-300 hover:scale-105">{it.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 ml-1.5 transition-all duration-500 transform hover:scale-125">({pct}%)</div>
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
    <div className="flex md:flex-col flex-row items-center gap-3 transition-all duration-500">
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
              className="dark:stroke-gray-800 transition-all duration-1000" 
              strokeWidth="1"
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                transform: animated ? 'scale(0)' : 'scale(1)',
                transition: `transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 200}ms`
              }}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={innerR} fill="#fff" className="dark:fill-gray-800 transition-all duration-500" />
        <text x={cx} y={cy} textAnchor="middle" dy="5" fontSize="12" className="fill-current text-gray-900 dark:text-gray-100 font-semibold transition-all duration-500">
          {total}
        </text>
      </svg>

      <div className="flex-1 min-w-0 transition-all duration-500">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-1">
          {items.map((it, i) => {
            const val = Number(it.value ?? it.count ?? 0);
            const pct = Math.round((val / total) * 100);
            return (
              <div key={i} className="flex items-center gap-2 text-xs transition-all duration-500 transform hover:translate-x-1.5">
                <span style={{ background: getColorFor(it, i) }} className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0 transition-all duration-300 transform hover:scale-125" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="truncate text-gray-700 dark:text-gray-300 transition-all duration-300 hover:scale-105">{it.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 ml-1.5 transition-all duration-500 transform hover:scale-125">({pct}%)</div>
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
  if (loading) return <LoadingSkeleton className="h-40 w-full transition-all duration-500" />;
  if (!rows.length) return <div className="p-3 text-xs text-gray-500 dark:text-gray-400 transition-all duration-500">{t("dashboard.noOverdue")}</div>;
  return (
    <div className="overflow-auto transition-all duration-500">
      <table className="w-full text-xs transition-all duration-500">
        <thead className="text-left text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 transition-all duration-500">
          <tr>
            <th className="p-1.5 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-600">{t("dashboard.table.task")}</th>
            <th className="p-1.5 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-600">{t("dashboard.table.due")}</th>
            <th className="p-1.5 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-600">{t("dashboard.table.daysOverdue")}</th>
            <th className="p-1.5 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-600">{t("dashboard.table.goal")}</th>
            <th className="p-1.5 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-600">{t("dashboard.table.group")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, index) => (
            <tr 
              key={r.id || r.taskId} 
              className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-500 ease-out transform hover:scale-105 hover:-translate-y-0.5"
              style={{
                animationDelay: `${index * 50}ms`,
                transitionDelay: `${index * 30}ms`
              }}
            >
              <td className="p-1.5 dark:text-gray-300 transition-all duration-300">{r.taskTitle}</td>
              <td className="p-1.5 dark:text-gray-300 transition-all duration-300">{formatDate(r.dueDate)}</td>
              <td className="p-1.5 transition-all duration-300">
                <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-xs transition-all duration-500 transform hover:scale-110">
                  {r.days_overdue ?? r.daysOverdue ?? 0}
                </span>
              </td>
              <td className="p-1.5 dark:text-gray-300 transition-all duration-300">{r.goalTitle}</td>
              <td className="p-1.5 dark:text-gray-300 transition-all duration-300">{r.groupName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const NotificationsPanel = ({ notifications = [], unread = 0, loading, onMarkAsRead, marking, t, navigate }) => {
  if (loading) return <LoadingSkeleton className="h-32 w-full transition-all duration-500" />;
  if (!notifications.length) return <div className="p-3 text-xs text-gray-500 dark:text-gray-400 transition-all duration-500">{t("dashboard.noNotifications")}</div>;
  return (
    <div className="transition-all duration-500">
      <div className="flex items-center justify-between mb-2 transition-all duration-500">
        <div className="flex items-center gap-1.5 transition-all duration-500">
          <span className="text-xs text-white bg-red-500 px-1.5 py-0.5 rounded-full transition-all duration-500 transform hover:scale-125">
            {unread}
          </span>
          {unread > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead();
              }}
              disabled={marking}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 transition-all duration-300 transform hover:scale-105"
            >
              {marking ? t("dashboard.notifications.marking") : t("dashboard.notifications.markAll")}
            </button>
          )}
        </div>
      </div>
      <ul className="space-y-1.5 transition-all duration-500">
        {notifications.map((n, index) => (
          <li key={n.id} className="transition-all duration-500 ease-out transform hover:scale-105">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (n.url) {
                  window.location.href = n.url;
                } else {
                  navigate("/notification");
                }
              }}
              className={`w-full text-left p-2 rounded border transition-all duration-500 transform hover:-translate-y-0.5 ${
                n.isRead ? "border-gray-200 dark:border-gray-700" : "border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30"
              } hover:shadow`}
              style={{
                animationDelay: `${index * 100}ms`,
                transitionDelay: `${index * 50}ms`
              }}
            >
              <div className="text-xs mb-0.5 dark:text-gray-300 transition-all duration-300">{n.message || n.type}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500 transition-all duration-500">{new Date(n.createdAt || n.time || n._raw?.createdAt).toLocaleString()}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const AuditPanel = ({ logs = [], loading, auditPermDenied = false, t }) => {
  if (loading) return <LoadingSkeleton className="h-32 w-full transition-all duration-500" />;
  if (auditPermDenied) return <div className="p-3 text-xs text-gray-500 dark:text-gray-400 transition-all duration-500">{t("dashboard.audit.noPermission")}</div>;
  if (!logs.length) return <div className="p-3 text-xs text-gray-500 dark:text-gray-400 transition-all duration-500">{t("dashboard.audit.noLogs")}</div>;
  return (
    <div className="transition-all duration-500">
      <ul className="space-y-1.5 transition-all duration-500">
        {logs.map((l, index) => (
          <li 
            key={l.id} 
            className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 transition-all duration-500 ease-out transform hover:scale-100 hover:-translate-y-0.5 hover:shadow"
            style={{
              animationDelay: `${index * 80}ms`,
              transitionDelay: `${index * 40}ms`
            }}
          >
            <div className="flex justify-between items-start transition-all duration-300">
              <div className="transition-all duration-500">
                <span className="font-medium text-gray-900 dark:text-gray-300 transition-all duration-300 hover:scale-105">{l.userName || `User ${l.userId}`}</span>
                <span className="text-gray-700 dark:text-gray-400 transition-all duration-500"> {l.action} </span>
                <span className="text-gray-500 dark:text-gray-500 transition-all duration-500"> {l.entity}</span>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap transition-all duration-500 transform hover:scale-110">
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

  return (
    <div className="p-3 md:p-4 bg-gray-200 dark:bg-gray-900 min-h-screen transition-all duration-500 ease-out">
      {/* Card-style Header */}
      <div className="mb-4 md:mb-5">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 py-2 px-3 transition-all duration-200">
          <div className="flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2.5 rounded-lg bg-gray-200 dark:bg-gray-900 border border-sky-100 dark:border-sky-800/30">
                <Home className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-row items-center sm:gap-3">
                  <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                    {t("dashboard.title")}
                  </h1>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {t("dashboard.subtitle")}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-3">
              <button
                onClick={handleRefresh}
                className={`px-2.5 py-1.5 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1.5 transition-all duration-500 transform hover:scale-105 active:scale-95 ${
                  refreshing ? 'animate-pulse' : ''
                }`}
                aria-label={t("dashboard.aria.refresh")}
                disabled={loading}
              >
                <svg 
                  className={`w-3.5 h-3.5 transition-all duration-500 ${loading || refreshing ? "animate-spin" : ""}`} 
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
                <span className="text-xs transition-all duration-300">
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
        <div className="p-2.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded mb-3 transition-all duration-500 transform hover:scale-105 text-xs">
          {error}
        </div>
      )}

      {/* BENTO GRID */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 transition-all duration-500">
        {/* KPI cards */}
        <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 transition-all duration-500">
          {/* Goals Card */}
          <Card title={t("dashboard.cards.goals.title")} onClick={goToGoals} ariaLabel={t("dashboard.cards.goals.aria")}>
            {loading ? (
              <LoadingSkeleton className="h-6 w-20 transition-all duration-500" />
            ) : (
              <div className="transition-all duration-500">
                <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white transition-all duration-500 transform ">
                  {hasGoalPercent ? `${overall_goal_progress.toFixed(2)}%` : goalsTotal > 0 ? `${goalsFinished} of ${goalsTotal}` : "-"}
                  <sub className="text-[9px] transition-all duration-300">{t("dashboard.percentage")}</sub>
                </div>

                {goalsTotal > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 transition-all duration-500">
                    {`${goalsFinished} ${t("dashboard.cards.goals.outOf")} ${goalsTotal} ${t("dashboard.cards.goals.title").toLowerCase()} ${t("dashboard.cards.goals.haveBeenDone")}`}
                  </div>
                )}

                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 transition-all duration-500">
                  {goalDelta ? (
                    <span className={`transition-all duration-500 transform hover:scale-110 ${
                      goalDelta.startsWith("+") ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
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
              <LoadingSkeleton className="h-6 w-20 transition-all duration-500" />
            ) : (
              <div className="transition-all duration-500">
                <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white transition-all duration-500 transform">
                  {hasTaskPercent ? `${overall_task_progress.toFixed(2)}%` : tasksTotal > 0 ? `${tasksFinished} of ${tasksTotal}` : "-"}
                  <sub className="text-[9px] transition-all duration-300">{t("dashboard.percentage")}</sub>
                </div>

                {tasksTotal > 0 && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 transition-all duration-500">{`${tasksFinished} ${t("dashboard.cards.tasks.outOf")} ${tasksTotal} ${t("dashboard.cards.tasks.title").toLowerCase()} ${t("dashboard.cards.tasks.haveBeenDone")}`}</div>}

                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 transition-all duration-500">{t("dashboard.cards.tasks.subtitle")}</div>
              </div>
            )}
          </Card>

          {/* Activities Card */}
          <Card title={t("dashboard.cards.activities.title")} onClick={goToActivities} ariaLabel={t("dashboard.cards.activities.aria")}>
            {loading ? (
              <LoadingSkeleton className="h-6 w-20 transition-all duration-500" />
            ) : (
              <div className="transition-all duration-500">
                <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white transition-all duration-500 transform">
                  {hasActivityPercent ? `${overall_activity_progress.toFixed(2)}%` : activitiesTotal > 0 ? `${activitiesFinished} of ${activitiesTotal}` : "-"}
                  <sub className="text-[9px] transition-all duration-300">{t("dashboard.percentage")}</sub>
                </div>

                {activitiesTotal > 0 && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 transition-all duration-500">{`${activitiesFinished} ${t("dashboard.cards.activities.outOf")} ${activitiesTotal} ${t("dashboard.cards.activities.title").toLowerCase()} ${t("dashboard.cards.activities.haveBeenDone")}`}</div>}

                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 transition-all duration-500">{t("dashboard.cards.activities.subtitle")}</div>
              </div>
            )}
          </Card>

          {/* Pending Reports Card */}
          <Card title={t("dashboard.cards.pendingReports.title")} onClick={goToPendingReports} ariaLabel={t("dashboard.cards.pendingReports.aria")}>
            {loading ? (
              <LoadingSkeleton className="h-6 w-20 transition-all duration-500" />
            ) : (
              <div className="transition-all duration-500">
                <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white transition-all duration-500 transform">
                  {pending_reports ?? 0}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 transition-all duration-500">{t("dashboard.cards.pendingReports.subtitle")}</div>
              </div>
            )}
          </Card>
        </div>

        {/* Charts */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4 transition-all duration-500">
          <Card title={t("dashboard.groupProgress")} onClick={() => setShowGroupModal(true)} className="p-3 flex flex-col justify-between h-full">
            {loading ? (<LoadingSkeleton className="h-24 transition-all duration-500" />) : (<div className="mt-2 transition-all duration-500"><GroupBarChart data={(dashboardData.groupBars || []).map((g) => ({ name: g.name, progress: g.progress, value: g.progress, color: g.color }))} limit={5} barWidth={80} gap={30} yLabel="Office progress" height={320}/></div>)}
          </Card>

          <Card title={t("dashboard.topTasks")} onClick={() => setShowTasksModal(true)} className="p-3">
            {loading ? (<LoadingSkeleton className="h-24 transition-all duration-500" />) : (<TaskBarChart items={(dashboardData.taskBars || []).map((x) => ({ label: x.label ?? x.name, progress: Number(x.progress ?? x.value ?? 0), color: x.color }))} maxItems={4} />)}
          </Card>

          <Card title={t("dashboard.reportsDistribution1")} onClick={() => navigate("/report")} className="p-3" ariaLabel={t("dashboard.reportsDistribution.aria")}>
            {loading ? <LoadingSkeleton className="h-24 transition-all duration-500" /> : <div className="flex justify-center transition-all duration-500"><PieChart slices={(dashboardData.reportsPie || []).map((r) => ({ value: r.count, label: r.label, color: r.color }))} /></div>}
          </Card>
        </div>

        {hasAuditPerm ? (
          <div className="lg:col-span-12 transition-all duration-500">
            <Card title={t("dashboard.audit.title")} onClick={goToAudit}><AuditPanel logs={dashboardData.auditLogs} loading={loading} auditPermDenied={auditPermDenied} t={t} /></Card>
          </div>
        ) : null}

        {/* Overdue + Notifications */}
        <div className="lg:col-span-8 transition-all duration-500 transform hover:scale-[1.02]">
          <Card
            title={
              <div className="flex items-center justify-between h-5 min-w-0 transition-all duration-500">
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate transition-all duration-300 ">
                  {t("dashboard.overdueTitle")}
                </span>
                <span className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 ml-1.5 px-1.5 py-0.5 rounded-full transition-all duration-500 transform ">
                  {(dashboardData.overdueRows || []).length} {t("dashboard.tasks")}
                </span>
              </div>
            }
            headerActions={
              <div className="flex items-center gap-1.5 transition-all duration-500">
                <button 
                  onClick={(e) => { e.stopPropagation(); goToTasks(); }} 
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline transition-all duration-300 transform hover:scale-110"
                >
                  {t("dashboard.openAll")}
                </button>
              </div>
            }
          >
            <OverdueTable rows={dashboardData.overdueRows} loading={loading} t={t} />
          </Card>
        </div>

        <div className="lg:col-span-4 transition-all duration-500">
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
        {loading ? <LoadingSkeleton className="h-32 transition-all duration-500" /> : <div className="overflow-x-auto transition-all duration-500"><div className="flex gap-4 items-end pb-3 transition-all duration-500">{(dashboardData.groups || []).map((g, idx) => (<div key={g.groupId ?? g.id ?? idx} className="flex flex-col items-center min-w-[70px] transition-all duration-500 transform hover:scale-95"><div className="w-10 h-24 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden flex items-end transition-all duration-1000"><div style={{ height: `${Math.max(6, Math.round((Number(g.value ?? g.progress ?? 0) / Math.max(1, ...((dashboardData.groups || []).map(x=>Number(x.value ?? x.progress ?? 0)))))*100))}%`, background: g.color }} className="w-full transition-all duration-1000 ease-out" /></div><div className="text-xs text-center text-gray-700 dark:text-gray-300 mt-1.5 break-words max-w-[100px] min-h-[2rem] flex items-center justify-center transition-all duration-300">{g.name}</div><div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 transition-all duration-500 transform hover:scale-125">{Math.round(Number(g.value ?? g.progress ?? 0))}%</div></div>))}</div></div>}
      </Modal>

      <Modal open={showTasksModal} onClose={() => setShowTasksModal(false)} title={t("dashboard.topTasks")}>
        {loading ? (<LoadingSkeleton className="h-32 transition-all duration-500" />) : (<div className="space-y-3 transition-all duration-500"><TaskBarChart items={(dashboardData.taskBars || []).map((x) => ({ label: x.label ?? x.name, progress: Number(x.progress ?? x.value ?? 0), color: x.color }))} maxItems={dashboardData.taskBars.length || 1000} /></div>)}
      </Modal>

      <div aria-live="polite" className="sr-only transition-all duration-500">{loading ? t("dashboard.aria.loading") : t("dashboard.aria.loaded")}</div>

      {/* Custom animation styles */}
      <style jsx>{`
        @keyframes gentleBounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-gentle-bounce {
          animation: gentleBounce 2s ease-in-out infinite;
        }
        
        .animate-slide-in-up {
          animation: slideInUp 0.6s ease-out both;
        }
      `}</style>
    </div>
  );
}