import React, { useState, useEffect, useMemo } from "react";
import { Loader, Download, Printer, Table2, ChevronRight, Moon, Sun } from "lucide-react";
import { fetchMasterReport } from "../api/reports";
import { useTranslation } from "react-i18next";
import { fetchGroups } from "../api/groups";
import TopBar from "../components/layout/TopBar";

/* -------------------------
* Master Report page wrapper with Material Design 3
* MODIFIED:
* - Added manual period selection for Gregorian & Ethiopian calendars
* - Added calendar system toggle
* - Refactored data fetching to use selected periods
* - Updated header generation to respect selected calendar system
* ------------------------- */
const App = () => {
  const { t } = useTranslation();
  
  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);
  
  // Calendar system state
  const [calendarSystem, setCalendarSystem] = useState('gregorian'); // 'gregorian' or 'ethiopian'
  
  // Period selection state
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  
  // Monthly granularity state
  const [selectedMonth, setSelectedMonth] = useState('');
  
  // Quarterly granularity state
  const [selectedQuarters, setSelectedQuarters] = useState({
    Q1: false,
    Q2: false,
    Q3: false,
    Q4: false
  });
  
  // Ethiopian month assignments to quarters (default)
  const [quarterMonthAssignments, setQuarterMonthAssignments] = useState({
    Q1: ['ሐምሌ', 'ነሐሴ', 'ጷጉሜ', 'መስከረም'],
    Q2: ['ጥቅምት', 'ኅዳር', 'ታህሳስ'],
    Q3: ['ጥር', 'የካቲት', 'መጋቢት'],
    Q4: ['ሚያዝያ', 'ግንቦት', 'ሰኔ'],
  });

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
    background: "#FFFFFF",
    onBackground: "#111827",
    surface: "#FFFFFF",
    onSurface: "#111827",
    surfaceVariant: "#EEF2F7",
    onSurfaceVariant: "#444C45",
    outline: "#737B73",
    outlineVariant: "#C2C9C2",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#313033",
    inverseOnSurface: "#F4EFF4",
    inversePrimary: "#99F6E4",
    surfaceContainerLowest: "#FFFFFF",
    surfaceContainerLow: "#F8FAFB",
    surfaceContainer: "#F4F6F8",
    surfaceContainerHigh: "#EEF2F7",
    surfaceContainerHighest: "#EEF2F7",
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
  const [groupId, setGroupId] = useState("");
  const [loading, setLoading] = useState(false);
  const [master, setMaster] = useState(null);
  const [error, setError] = useState(null);
  const [granularity, setGranularity] = useState("quarterly");
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // --- STATE FOR GROUP DROPDOWN ---
  const [groupSearchTerm, setGroupSearchTerm] = useState(
    t("reports.master.allGroups", "All Groups")
  ); // For print title
  const [allGroups, setAllGroups] = useState([]);
  const [groupLoadError, setGroupLoadError] = useState(null);
  
  // Animation state
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => setMounted(false);
  }, []);
  
  // Try to respect system preference initially
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDark);
  }, []);
  
  // Reset selections when granularity changes
  useEffect(() => {
    if (granularity === 'monthly') {
      setSelectedMonth('');
    } else if (granularity === 'quarterly') {
      setSelectedQuarters({ Q1: false, Q2: false, Q3: false, Q4: false });
    }
  }, [granularity]);
  
  // --- EFFECT TO FETCH GROUPS ---
  useEffect(() => {
    async function loadGroups() {
      try {
        setGroupLoadError(null);
        const groups = await fetchGroups();
        setAllGroups(groups || []);
      } catch (err) {
        console.error("Failed to fetch groups", err);
        setGroupLoadError(
          t("reports.master.groupLoadFailed", "Failed to load groups list.")
        );
      }
    }
    loadGroups();
  }, [t]);
  
  // --- Set default search term when t() is ready ---
  useEffect(() => {
    if (groupId === "") {
      setGroupSearchTerm(t("reports.master.allGroups", "All Groups"));
    }
  }, [t, groupId]);
  
  function escapeHtml(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  
  async function handleFetch() {
    setLoading(true);
    setIsRefreshing(true);
    setError(null);
    try {
      // Validate selections before fetching
      if (!selectedYear) {
        setError(t("reports.master.yearRequired", "Please enter a year"));
        return;
      }
      
      if (granularity === 'monthly' && !selectedMonth) {
        setError(t("reports.master.monthRequired", "Please select a month"));
        return;
      }
      
      if (granularity === 'quarterly' && 
          !Object.values(selectedQuarters).some(isSelected => isSelected)) {
        setError(t("reports.master.quarterRequired", "Please select at least one quarter"));
        return;
      }
      
      // Build params for API call based on selections
      const params = {
        granularity,
        calendarSystem,
        year: selectedYear,
        month: granularity === 'monthly' ? selectedMonth : undefined,
        quarters: granularity === 'quarterly' ? 
          Object.keys(selectedQuarters).filter(q => selectedQuarters[q]) : undefined,
        quarterMonthAssignments: granularity === 'quarterly' && calendarSystem === 'ethiopian' ? 
          quarterMonthAssignments : undefined
      };
      
      const data = await fetchMasterReport(groupId || undefined, params);
      setMaster(data);
    } catch (err) {
      if (err && err.status === 401) {
        setError(
          "Unauthorized — your session may have expired. Please sign in again."
        );
        setMaster(null);
      } else {
        setError(err?.message || t("reports.master.fetchFailed"));
        setMaster(null);
      }
    } finally {
      setLoading(false);
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }
  
  // --- HANDLER FOR GROUP <select> DROPDOWN ---
  function handleGroupSelectChange(e) {
    const selectedGroupId = e.target.value;
    const selectedGroupText = e.target.options[e.target.selectedIndex].text;
    setGroupId(selectedGroupId);
    setGroupSearchTerm(selectedGroupText); // Store the "All Groups" or group name for printing
    setError(null); // Clear main error on change
  }
  
  // Get Ethiopian year from Gregorian year (simple approximation)
  // In real app, use a proper conversion library like 'kenat'
  function getEthiopianYear(gregorianYear) {
    // Ethiopian year is approximately 7-8 years behind Gregorian
    return gregorianYear - 8;
  }
  
  // Format month key for display (Gregorian or Ethiopian)
  function fmtMonthKey(monthIndex) {
    if (!monthIndex) return "";
    
    const monthNum = parseInt(monthIndex);
    if (isNaN(monthNum)) return monthIndex;
    
    if (calendarSystem === 'gregorian') {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
      return monthNum >= 1 && monthNum <= 12 ? months[monthNum - 1] : monthIndex;
    } else {
      // Ethiopian calendar display
      const ethiopianMonths = [
        'መስከረም', 'ጥቅምት', 'ኅዳር', 'ታህሳስ', 'ጥር', 'የካቲት',
        'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጷጉሜ'
      ];
      
      return monthNum >= 1 && monthNum <= ethiopianMonths.length ? 
        ethiopianMonths[monthNum - 1] : monthIndex;
    }
  }
  
  // Format quarter key for display (Gregorian or Ethiopian)
  function fmtQuarterKey(quarterKey) {
    if (!quarterKey) return quarterKey;
    
    if (calendarSystem === 'gregorian') {
      return quarterKey;
    } else {
      // For Ethiopian calendar, show the months in this quarter
      const months = quarterMonthAssignments[quarterKey] || [];
      const monthNames = months.slice(0, 3).join(", ");
      return `${quarterKey} (${monthNames}${months.length > 3 ? ', ...' : ''})`;
    }
  }
  
  // Get year label to display based on calendar system
  function getDisplayYear() {
    const yearNum = parseInt(selectedYear);
    if (isNaN(yearNum)) return selectedYear;
    
    return calendarSystem === 'gregorian' ? 
      selectedYear : 
      getEthiopianYear(yearNum).toString();
  }
  
  // Generate period columns based on manual selections
  const periodColumns = useMemo(() => {
    if (!selectedYear) return [];
    
    switch (granularity) {
      case 'monthly':
        if (!selectedMonth) return [];
        return [`${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`];
        
      case 'quarterly':
        const quarters = [];
        Object.entries(selectedQuarters).forEach(([quarter, isSelected]) => {
          if (isSelected) {
            quarters.push(`${selectedYear}-${quarter}`);
          }
        });
        return quarters;
        
      case 'annual':
        return [selectedYear];
        
      default:
        return [];
    }
  }, [granularity, selectedYear, selectedMonth, selectedQuarters, calendarSystem]);
  
  const tableRows = useMemo(() => {
    const rows = [];
    if (!master) return rows;
    master.goals.forEach((g, goalIndex) => {
      const goalNum = `${goalIndex + 1}`;
      rows.push({
        type: "goal",
        id: `g-${g.id}`,
        title: g.title,
        weight: g.weight ?? "-",
        progress: g.progress ?? "-",
        goal: g,
        raw: g,
        number: goalNum,
      });
      (g.tasks || []).forEach((task, taskIndex) => {
        const taskNum = `${goalNum}.${taskIndex + 1}`;
        rows.push({
          type: "task",
          id: `t-${task.id}`,
          title: task.title,
          weight: task.weight ?? "-",
          progress: task.progress ?? "-",
          task: task,
          parentGoal: g,
          raw: task,
          number: taskNum,
        });
        (task.activities || []).forEach((a, activityIndex) => {
          const activityNum = `${taskNum}.${activityIndex + 1}`;
          rows.push({
            type: "activity",
            id: `a-${a.id}`,
            title: a.title,
            weight: a.weight ?? "-",
            activity: a,
            parentTask: task,
            parentGoal: g,
            raw: a,
            number: activityNum,
          });
        });
      });
    });
    return rows;
  }, [master]);
  
  // Generate table headers for print/export
  const periodHeadersHtml = useMemo(() => {
    if (granularity === "quarterly") {
      return periodColumns
        .map((p) => {
          const quarterKey = p.split('-')[1];
          const displayYear = getDisplayYear();
          const quarterLabel = fmtQuarterKey(quarterKey);
          const label = `${quarterLabel} ${displayYear}`;
          
          return [
            `<th style="padding:6px;border:1px solid #ddd;background:#f3f4f6">${escapeHtml(t("reports.table.qGoal", "Goal"))} (${escapeHtml(label)})</th>`,
            `<th style="padding:6px;border:1px solid #ddd;background:#f3f4f6">${escapeHtml(t("reports.table.qRecord", "Record"))} (${escapeHtml(label)})</th>`,
            `<th style="padding:6px;border:1px solid #ddd;background:#f3f4f6">${escapeHtml(t("reports.table.qProgress", "Progress %"))} (${escapeHtml(label)})</th>`,
          ].join("");
        })
        .join("");
    }
    
    // Monthly or Annual
    return periodColumns.map((p) => {
      let label = p;
      const displayYear = getDisplayYear();
      
      if (granularity === "monthly") {
        const monthNum = p.split('-')[1];
        const monthName = fmtMonthKey(monthNum);
        label = `${monthName} ${displayYear}`;
      } else if (granularity === "annual") {
        label = displayYear;
      }
      
      return `<th style="padding:6px;border:1px solid #ddd;background:#f3f4f6">${escapeHtml(label)}</th>`;
    }).join("");
  }, [periodColumns, granularity, t, calendarSystem, selectedYear]);
  
  // Generate table cells for print/export
  const periodCellsHtml = (row) => {
    const emptyCell = `<td style="padding:6px;border:1px solid #ddd">—</td>`;
    if (row.type === "goal" || row.type === "task") {
      const numCols = granularity === "quarterly" ? periodColumns.length * 3 : periodColumns.length;
      // Add 1 for the Yearly Progress % column
      return Array(numCols + 1).fill(emptyCell).join("");
    }
    
    // Activity row
    const a = row.activity;
    const mk = pickMetricForActivity(a, null);
    // Calculate Yearly Progress
    const { targetVal, prevVal, currentVal } = getOverallMetrics(a, mk);
    const targetNum = toNumberOrNull(targetVal);
    const currentNum = toNumberOrNull(currentVal);
    let yearlyProgressPct = null;
    
    if (targetNum !== null && currentNum !== null) {
      if (targetNum > 0) {
        yearlyProgressPct = (currentNum / targetNum) * 100;
      } else if (targetNum === 0) {
        yearlyProgressPct = (currentNum > 0) ? 100.0 : 0.0;
      }
    }
    
    const displayYearlyProgress = yearlyProgressPct === null ? '-' : `${yearlyProgressPct.toFixed(2)}%`;
    const yearlyProgressCell = `<td style="padding:6px;border:1px solid #ddd">${escapeHtml(displayYearlyProgress)}</td>`;
    
    // Quarterly cells
    if (granularity === "quarterly") {
      const quarterlyCells = periodColumns.map(p => {
        const { goal, record, progress } = getQuarterlyStats(
          a, p, mk, calendarSystem, quarterMonthAssignments
        );
        const displayProgress = progress === null ? '-' : `${progress.toFixed(2)}%`;
        return [
          `<td style="padding:6px;border:1px solid #ddd">${escapeHtml(String(goal ?? "-"))}</td>`,
          `<td style="padding:6px;border:1px solid #ddd">${escapeHtml(String(record ?? "-"))}</td>`,
          `<td style="padding:6px;border:1px solid #ddd;">${escapeHtml(displayProgress)}</td>`
        ].join("");
      }).join("");
      
      return yearlyProgressCell + quarterlyCells;
    }
    
    // Monthly or Annual cells
    const periodCells = periodColumns.map((p) => {
      const v = getLatestMetricValueInPeriod(a, p, granularity, mk);
      if (v === null || v === undefined) return emptyCell;
      
      let dv = v;
      if (typeof dv === "object") {
        try {
          const k = Object.keys(dv || {})[0];
          if (k) dv = dv[k];
          else dv = JSON.stringify(dv);
        } catch (e) { dv = JSON.stringify(dv); }
      }
      
      return `<td style="padding:6px;border:1px solid #ddd">${escapeHtml(String(dv))}</td>`;
    }).join("");
    
    return yearlyProgressCell + periodCells;
  };
  
  function generateHtmlForPrint() {
  const data = master || { goals: [] };
  const columnsHtml = periodHeadersHtml;
  
  // Premium font stack for a polished look
  const fontFamily = `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif`;

  // --- Helper: Visual Progress Bar ---
  const createProgressBar = (pct, size = 'md') => {
    const p = Math.max(0, Math.min(100, pct || 0));
    const colorClass = p >= 100 ? 'bg-success' : (p > 50 ? 'bg-primary' : 'bg-warning');
    return `
      <div class="progress-track size-${size}">
        <div class="progress-fill ${colorClass}" style="width: ${p}%"></div>
      </div>
    `;
  };

  // --- Helper: Generate Table Rows ---
  const rowsHtml = tableRows.map((row, index) => {
    const titleWithNumber = `${row.number}. ${row.title}`;
    const rowClass = row.type === 'goal' ? 'row-goal' : (row.type === 'task' ? 'row-task' : 'row-activity');
    
    // Non-activity rows (Headers)
    if (row.type !== "activity") {
      const emptyQuarterlyCells = granularity === "quarterly" ? periodColumns.length * 3 : periodColumns.length;
      const emptyCells = Array(emptyQuarterlyCells + 1).fill(0).map(() => `<td class="cell-empty"></td>`).join("");

      return `
        <tr class="${rowClass}">
          <td class="cell-title">
            <div class="title-wrapper">${escapeHtml(titleWithNumber)}</div>
          </td>
          <td class="cell-center font-medium opacity-70">${escapeHtml(String(row.weight))}</td>
          <td class="cell-empty" colspan="4"></td> 
          ${emptyCells}
        </tr>`;
    }

    // Activity row logic
    const mk = pickMetricForActivity(row.activity, null);
    const { targetVal, prevVal, currentVal } = getOverallMetrics(row.activity, mk);

    // Calculate Yearly Progress
    const targetNum = toNumberOrNull(targetVal);
    const currentNum = toNumberOrNull(currentVal);
    let yearlyProgressPct = null;

    if (targetNum !== null && currentNum !== null) {
      if (targetNum > 0) yearlyProgressPct = (currentNum / targetNum) * 100;
      else if (targetNum === 0) yearlyProgressPct = (currentNum > 0) ? 100.0 : 0.0;
    }

    const displayYearlyProgress = yearlyProgressPct === null ? '-' : `${yearlyProgressPct.toFixed(1)}%`;
    const yearlyProgressClass = yearlyProgressPct >= 100 ? 'text-success font-bold' : '';

    // Period Cells Logic
    let periodCells = "";
    if (granularity === "quarterly") {
      periodCells = periodColumns.map(p => {
        const { goal, record, progress } = getQuarterlyStats(row.activity, p, mk, calendarSystem, quarterMonthAssignments);
        const displayProgress = progress === null ? '' : `${progress.toFixed(0)}%`;
        const progressColor = (progress || 0) >= 100 ? 'text-success' : 'text-muted';
        
        return `
          <td class="cell-sub-val">${escapeHtml(String(goal ?? ""))}</td>
          <td class="cell-sub-val font-medium">${escapeHtml(String(record ?? ""))}</td>
          <td class="cell-sub-val ${progressColor} text-xs">${escapeHtml(displayProgress)}</td>
        `;
      }).join("");
    } else {
      periodCells = periodColumns.map((p) => {
        const v = getLatestMetricValueInPeriod(row.activity, p, granularity, mk);
        if (v === null || v === undefined) return `<td class="cell-empty"></td>`;

        let dv = v;
        if (typeof dv === "object") {
          try {
            const k = Object.keys(dv || {})[0];
            if (k) dv = dv[k]; else dv = JSON.stringify(dv);
          } catch (e) { dv = JSON.stringify(dv); }
        }
        return `<td class="cell-number">${escapeHtml(String(dv))}</td>`;
      }).join("");
    }

    return `
      <tr class="${rowClass}">
        <td class="cell-title indent-activity">
          <span class="activity-dot"></span>
          ${escapeHtml(titleWithNumber)}
        </td>
        <td class="cell-center text-muted">${escapeHtml(String(row.weight))}</td>
        <td class="cell-center"><span class="badge-mini">${escapeHtml(mk ?? "")}</span></td>
        <td class="cell-number font-medium">${escapeHtml(String(targetVal ?? "-"))}</td>
        <td class="cell-number text-muted">${escapeHtml(String(prevVal ?? "-"))}</td>
        <td class="cell-number ${yearlyProgressClass}">${escapeHtml(displayYearlyProgress)}</td>
        ${periodCells}
      </tr>`;
  }).join("");

  // --- Helper: Generate Narratives ---
  const narrativesHtml = data.goals.map((g, goalIndex) => {
    const goalNum = `${goalIndex + 1}`;
    const goalProgress = g.progress ?? 0;

    const tasksHtml = (g.tasks || []).map((task, taskIndex) => {
      const taskNum = `${goalNum}.${taskIndex + 1}`;
      
      const activitiesHtml = (task.activities || []).map((activity, activityIndex) => {
        const activityNum = `${taskNum}.${activityIndex + 1}`;
        
        // Stat items
        const metricItems = [
          { label: t("reports.master.metrics.target"), value: activity.targetMetric, icon: '🎯' },
          { label: t("reports.master.metrics.current"), value: activity.currentMetric, icon: '⚡' },
          { label: t("reports.master.metrics.previous"), value: activity.previousMetric, icon: '⏮️' },
          { label: t("reports.master.metrics.quarterly"), value: activity.quarterlyGoals, icon: '📅' }
        ].map(item => `
          <div class="stat-item">
            <div class="stat-content">
              <div class="stat-label">${escapeHtml(item.label)}</div>
              <div class="stat-value">${item.value ? escapeHtml(JSON.stringify(item.value)) : "—"}</div>
            </div>
          </div>
        `).join("");

        // Reports Timeline
        const reportsList = (activity.reports || []).map(r => `
          <div class="timeline-item">
            <div class="timeline-marker"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="report-id">#${escapeHtml(String(r.id))}</span>
                <span class="status-pill status-${String(r.status || "").toLowerCase()}">${escapeHtml(String(r.status || "unknown").toLowerCase())}</span>
                <span class="report-date">${r.createdAt ? escapeHtml(new Date(r.createdAt).toLocaleDateString()) : ""}</span>
              </div>
              <div class="report-text">${escapeHtml(r.narrative || "")}</div>
              ${r.metrics ? `<div class="report-meta">${escapeHtml(t("reports.master.metricsName"))}: ${escapeHtml(JSON.stringify(r.metrics))}</div>` : ''}     
              </div>
          </div>
        `).join("");

        return `
          <div class="card activity-card">
            <div class="card-header-activity">
              <span class="activity-title">${escapeHtml(`${activityNum} ${activity.title}`)}</span>
            </div>
            <div class="card-body">
              <div class="stats-grid">
                ${metricItems}
              </div>
              ${reportsList ? `<div class="timeline-container">${reportsList}</div>` : ''}
            </div>
          </div>
        `;
      }).join("");

      return `
        <div class="task-block">
          <div class="task-title-row">
            <h3>${escapeHtml(`${taskNum} ${task.title}`)}</h3>
            <div class="task-meta">
              <div class="progress-micro-wrapper">
                <span class="progress-text">${escapeHtml(String(task.progress ?? 0))}%</span>
                ${createProgressBar(task.progress, 'sm')}
              </div>
              ${escapeHtml(t("reports.master.task.weight"))}: ${escapeHtml(String(task.weight ?? "-"))}
            </div>
          </div>
          <div class="activities-grid">
            ${activitiesHtml}
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="goal-section">
  <div class="goal-banner">
    <div class="goal-info">
      <h2>${escapeHtml(`${goalNum}. ${g.title}`)}</h2>

      <div class="goal-tags">
        <span class="tag">
          ${escapeHtml(g.status)}
        </span>
        <span class="tag">
          ${escapeHtml(t("reports.master.goals.weight"))}: ${escapeHtml(String(g.weight ?? "-"))}
        </span>
      </div>
    </div>

    <div class="goal-chart">
      <div class="chart-label">
        ${escapeHtml(t("reports.master.charts.goalProgress"))}
      </div>
      <div class="chart-val">
        ${escapeHtml(String(goalProgress))}%
      </div>
      ${createProgressBar(goalProgress, "md")}
    </div>
  </div>

  <div class="goal-content">
    ${tasksHtml}
  </div>
</div>
    `;
  }).join("");

  const title = t("reports.master.title");
  const groupLabel = t("reports.master.groupLabel");
  const narratives = t("reports.master.narratives");
  const dataTable = t("reports.master.dataTable");
  const generated = t("reports.master.generatedAt", { date: new Date().toLocaleString() });

  return `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      :root {
        --primary: #4f46e5;       /* Indigo 600 */
        --primary-light: #eef2ff; /* Indigo 50 */
        --success: #10b981;       /* Emerald 500 */
        --warning: #f59e0b;       /* Amber 500 */
        --danger: #ef4444;        /* Red 500 */
        --gray-900: #111827;
        --gray-700: #374151;
        --gray-500: #6b7280;
        --gray-200: #e5e7eb;
        --gray-50: #f9fafb;
        --border: #e2e8f0;
      }
      
      * { box-sizing: border-box; }
      
      body {
        font-family: ${fontFamily};
        color: var(--gray-900);
        line-height: 1.5;
        background: #fff;
        margin: 0;
        padding: 40px;
        padding-bottom: 60px; /* Space for footer */
        -webkit-print-color-adjust: exact;
        overflow-wrap: break-word; /* Ensure text wraps */
        word-break: break-word; /* Prevent overflow */
        position: relative;
        min-height: 100vh;
      }

      /* --- Report Header --- */
      header {
        margin-bottom: 40px;
        padding-bottom: 20px;
        border-bottom: 2px solid var(--gray-900);
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
      }
      header h1 {
        font-size: 32px;
        font-weight: 800;
        margin: 0;
        letter-spacing: -0.02em;
        background: -webkit-linear-gradient(45deg, var(--primary), #818cf8);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        flex: 1;
      }
      .logo-container {
        flex-shrink: 0;
        margin-left: 20px;
      }
      .logo-img {
        height: 60px;
        width: auto;
        object-fit: contain;
      }

      /* --- Footer --- */
      footer {
        margin-top: 50px;
        padding-top: 20px;
        border-top: 1px solid var(--border);
        text-align: center;
        font-size: 11px;
        color: var(--gray-500);
        width: 100%;
      }
      .footer-meta {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 20px;
        flex-wrap: wrap;
      }
      .footer-sep {
        color: var(--gray-200);
      }
      .footer-val {
        color: var(--gray-900);
        font-weight: 600;
      }

      /* --- Section Headers --- */
      section { margin-bottom: 50px; }
      section h2.section-title {
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--gray-500);
        margin-bottom: 20px;
        border-bottom: 1px solid var(--border);
        padding-bottom: 5px;
      }

      /* --- Narrative: Goal Banner --- */
      .goal-section {
        margin-bottom: 40px;
        page-break-inside: avoid;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid var(--border);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      }
      .goal-banner {
        background: linear-gradient(135deg, var(--gray-900) 0%, #1e293b 100%);
        color: white;
        padding: 20px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .goal-info h2 {
        margin: 0 0 8px 0;
        font-size: 18px;
        font-weight: 600;
        color: #fff;
        word-wrap: break-word;
      }
      .goal-tags { display: flex; gap: 8px; flex-wrap: wrap; }
      .tag {
        background: rgba(255,255,255,0.2);
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
      }
      .goal-chart {
        text-align: right;
        min-width: 120px;
      }
      .chart-label { font-size: 10px; opacity: 0.7; text-transform: uppercase; }
      .chart-val { font-size: 20px; font-weight: 700; color: var(--success); }

      /* --- Narrative: Task Block --- */
      .goal-content { padding: 20px; background: var(--gray-50); }
      .task-block { margin-bottom: 30px; }
      .task-block:last-child { margin-bottom: 0; }
      
      .task-title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border);
        flex-wrap: wrap;
      }
      .task-title-row h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--gray-700); word-wrap: break-word; }
      .task-meta { display: flex; align-items: center; gap: 15px; font-size: 12px; }
      
      .progress-micro-wrapper { display: flex; align-items: center; gap: 8px; width: 100px; }
      .progress-text { font-weight: 600; min-width: 30px; text-align: right; }
      .badge-weight { background: var(--gray-200); padding: 2px 6px; border-radius: 4px; color: var(--gray-700); font-weight: 600; }

      /* --- Narrative: Activity Cards --- */
      .activities-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 16px;
      }
      .activity-card {
        background: #fff;
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 0;
        transition: transform 0.2s;
        /* Prevent card overflow */
        max-width: 100%;
      }
      .card-header-activity {
        padding: 10px 12px;
        background: #fff;
        border-bottom: 1px solid var(--gray-50);
        font-weight: 600;
        font-size: 14px;
        color: var(--primary);
        word-wrap: break-word;
      }
      .card-body { padding: 12px; }

      /* Stats Grid */
      .stats-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 12px;
      }
      .stat-item {
        background: var(--gray-50);
        padding: 8px;
        border-radius: 4px;
        display: flex;
        gap: 8px;
        align-items: flex-start; /* Align top in case of wrapping */
      }
      .stat-icon { font-size: 14px; flex-shrink: 0; margin-top: 2px; }
      .stat-content { overflow: hidden; width: 100%; }
      .stat-label { font-size: 9px; text-transform: uppercase; color: var(--gray-500); font-weight: 600; margin-bottom: 2px; }
      /* allow wrapping for long values (json/urls) */
      .stat-value { 
        font-size: 12px; 
        font-family: monospace; 
        font-weight: 600; 
        color: var(--gray-900); 
        white-space: normal; /* Was nowrap */
        word-break: break-all; /* Ensure JSON breaks */
        line-height: 1.2;
      }

      /* Timeline Reports */
      .timeline-container {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px dashed var(--border);
      }
      .timeline-item {
        position: relative;
        padding-left: 16px;
        margin-bottom: 10px;
      }
      .timeline-item:last-child { margin-bottom: 0; }
      .timeline-marker {
        position: absolute;
        left: 0;
        top: 6px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--gray-200);
        border: 2px solid #fff;
        box-shadow: 0 0 0 1px var(--gray-300);
      }
      .timeline-header {
        display: flex;
        gap: 6px;
        align-items: center;
        font-size: 11px;
        margin-bottom: 2px;
        flex-wrap: wrap;
      }
      .report-id { font-weight: 700; color: var(--gray-400); }
      .status-pill { padding: 1px 6px; border-radius: 99px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
      .status-completed { background: #dcfce7; color: #166534; }
      .status-pending { background: #fef9c3; color: #854d0e; }
      .status-late { background: #fee2e2; color: #991b1b; }
      
      .report-text { 
        font-size: 13px; 
        color: var(--gray-700); 
        line-height: 1.4; 
        word-wrap: break-word;
        overflow-wrap: break-word;
      }
      .report-meta { 
        font-size: 10px; 
        color: var(--gray-400); 
        margin-top: 2px; 
        font-family: monospace; 
        word-break: break-all; 
      }

      /* --- Progress Bars --- */
      .progress-track { background: rgba(0,0,0,0.1); border-radius: 99px; overflow: hidden; width: 100%; }
      .progress-fill { height: 100%; transition: width 0.3s ease; }
      .size-sm { height: 6px; }
      .size-md { height: 8px; }
      .bg-success { background: var(--success); }
      .bg-primary { background: var(--success); } /* Use success for green vibe */
      .bg-warning { background: var(--warning); }

      /* --- Data Table --- */
      table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-size: 12px;
        table-layout: fixed; /* Force column widths to respect page */
      }
      thead th {
        background: var(--gray-50);
        color: var(--gray-500);
        font-weight: 600;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.05em;
        padding: 10px 8px;
        border-bottom: 2px solid var(--border);
        text-align: left;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      tbody td {
        padding: 10px 8px;
        border-bottom: 1px solid var(--border);
        vertical-align: middle;
        word-wrap: break-word; /* Wrap long content */
      }
      
      /* Row Styling */
      .row-goal td {
        background: var(--gray-50);
        font-weight: 700;
        color: var(--gray-900);
        padding-top: 20px;
        border-bottom: 2px solid var(--border);
      }
      .row-task td {
        background: #fff;
        font-weight: 600;
        color: var(--gray-700);
      }
      
      /* Cell Styling */
      /* Assign relative widths to help table-layout: fixed */
      .cell-title { width: 30%; word-wrap: break-word; }
      .cell-center { text-align: center; }
      .cell-number { text-align: right; font-family: monospace; font-size: 12px; }
      .cell-sub-val { text-align: right; font-family: monospace; font-size: 11px; padding: 4px; border: none; border-bottom: 1px solid var(--border); }
      
      .title-wrapper { font-weight: 700; word-wrap: break-word; }
      .indent-activity { padding-left: 24px; position: relative; }
      .activity-dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        background: var(--primary);
        border-radius: 50%;
        margin-right: 8px;
        opacity: 0.5;
        flex-shrink: 0;
      }
      
      .badge-mini { background: var(--primary-light); color: var(--primary); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; display: inline-block; }
      
      .font-medium { font-weight: 500; }
      .font-bold { font-weight: 700; }
      .text-muted { color: var(--gray-500); }
      .text-success { color: var(--success); }
      .text-xs { font-size: 10px; }
      .opacity-70 { opacity: 0.7; }

      /* --- Print Media Query --- */
      @media print {
        body { padding: 0; max-width: none; }
        .goal-section { break-inside: avoid; box-shadow: none; border: 1px solid #000; }
        .goal-banner { background: #000 !important; color: #fff !important; -webkit-print-color-adjust: exact; }
        .progress-fill { -webkit-print-color-adjust: exact; }
        .activity-card { border: 1px solid #ccc; break-inside: avoid; }
        header { border-bottom: 2px solid #000; }
        thead th { border-bottom: 2px solid #000; color: #000; }
        .tag, .stat-item, .badge-mini { border: 1px solid #ddd; }
        .chart-val { color: #000 !important; }
        
        /* Force footer to bottom of every page */
        footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #fff;
          padding: 10px 0;
          border-top: 1px solid #000;
        }
        /* ensure content doesn't overlap footer */
        body { padding-bottom: 50px; }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>${escapeHtml(title)}</h1>
      <div class="logo-container">
        <img src="/src/assets/logo.png" alt="Logo" class="logo-img">
      </div>
    </header>

    <section>
      <h2 class="section-title">${escapeHtml(narratives)}</h2>
      ${narrativesHtml}
    </section>

    <section style="margin-top: 60px;">
      <h2 class="section-title">${escapeHtml(dataTable)}</h2>
      <table>
        <thead>
          <tr>
            <th class="cell-title">${escapeHtml(t("reports.table.title"))}</th>
            <th class="cell-center" style="width: 8%">${escapeHtml(t("reports.table.weight"))}</th>
            <th class="cell-center" style="width: 8%">${escapeHtml(t("reports.table.metric"))}</th>
            <th style="text-align:right; width: 10%">${escapeHtml(t("reports.table.target"))}</th>
            <th style="text-align:right; width: 10%">${escapeHtml(t("reports.table.previous", "Prev"))}</th>
            <th style="text-align:right; width: 10%">${escapeHtml(t("reports.table.yearlyProgress", "YTD %"))}</th>
            ${columnsHtml}
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </section>

    <footer>
      <div class="footer-meta">
        <span>Group: <span class="footer-val">${escapeHtml(String(groupSearchTerm || "All"))}</span></span>
        <span class="footer-sep">•</span>
        <span>Date: <span class="footer-val">${escapeHtml(generated)}</span></span>
        <span class="footer-sep">•</span>
        <span>System: <span class="footer-val">${escapeHtml(calendarSystem === 'gregorian' ? "Gregorian" : "Ethiopian")}</span></span>
      </div>
    </footer>
  </body>
  </html>`;
}
  
  function exportCSV() {
    if (!master) return alert(t("reports.master.loadFirstAlert"));
    
    // Build headers
    const headers = [
      t("reports.table.goalNum", "Goal #"),
      t("reports.table.goal", "Goal"),
      t("reports.table.taskNum", "Task #"),
      t("reports.table.task", "Task"),
      t("reports.table.activityNum", "Activity #"),
      t("reports.table.activity", "Activity"),
      t("reports.table.weight", "Weight"),
      t("reports.table.metric", "Metric"),
      t("reports.table.target", "Target"),
      t("reports.table.previous", "Previous"),
      t("reports.table.yearlyProgress", "Yearly Progress %")
    ];
    
    // Add period headers
    if (granularity === "quarterly") {
      periodColumns.forEach(p => {
        const quarterKey = p.split('-')[1];
        const displayYear = getDisplayYear();
        const quarterLabel = fmtQuarterKey(quarterKey);
        const label = `${quarterLabel} ${displayYear}`;
        
        headers.push(`${t("reports.table.qGoal", "Goal")} (${label})`);
        headers.push(`${t("reports.table.qRecord", "Record")} (${label})`);
        headers.push(`${t("reports.table.qProgress", "Progress %")} (${label})`);
      });
    } else {
      periodColumns.forEach(p => {
        let label = p;
        const displayYear = getDisplayYear();
        
        if (granularity === "monthly") {
          const monthNum = p.split('-')[1];
          const monthName = fmtMonthKey(monthNum);
          label = `${monthName} ${displayYear}`;
        } else if (granularity === "annual") {
          label = displayYear;
        }
        
        headers.push(label);
      });
    }
    
    const rows = [];
    const emptyPeriodCells = Array(headers.length - 11).fill(""); // 11 base columns
    
    master.goals.forEach((g, goalIndex) => {
      const goalNum = `${goalIndex + 1}`;
      rows.push([
        goalNum, g.title, "", "", "", "", g.weight ?? "", "", "", "",
        "", // Yearly Progress
        ...emptyPeriodCells
      ]);
      
      (g.tasks || []).forEach((task, taskIndex) => {
        const taskNum = `${goalNum}.${taskIndex + 1}`;
        rows.push([
          "", "", taskNum, task.title, "", "", task.weight ?? "", "", "", "",
          "", // Yearly Progress
          ...emptyPeriodCells
        ]);
        
        (task.activities || []).forEach((a, activityIndex) => {
          const activityNum = `${taskNum}.${activityIndex + 1}`;
          const mk = pickMetricForActivity(a, null);
          const { targetVal, prevVal, currentVal } = getOverallMetrics(a, mk);
          
          // Calculate Yearly Progress
          const targetNum = toNumberOrNull(targetVal);
          const currentNum = toNumberOrNull(currentVal);
          let yearlyProgressPct = null;
          
          if (targetNum !== null && currentNum !== null) {
            if (targetNum > 0) yearlyProgressPct = (currentNum / targetNum) * 100;
            else if (targetNum === 0) yearlyProgressPct = (currentNum > 0) ? 100.0 : 0.0;
          }
          
          const displayYearlyProgress = yearlyProgressPct === null ? '' : `${yearlyProgressPct.toFixed(2)}%`;
          
          // Get period values
          const periodVals = [];
          
          if (granularity === "quarterly") {
            periodColumns.forEach(p => {
              const { goal, record, progress } = getQuarterlyStats(
                a, p, mk, calendarSystem, quarterMonthAssignments
              );
              const displayProgress = progress === null ? "" : `${progress.toFixed(2)}%`;
              
              periodVals.push(goal ?? "");
              periodVals.push(record ?? "");
              periodVals.push(displayProgress);
            });
          } else {
            periodColumns.forEach(p => {
              const v = getLatestMetricValueInPeriod(a, p, granularity, mk);
              periodVals.push(v === null || v === undefined ? "" : String(v));
            });
          }
          
          rows.push([
            "", "", "", "", activityNum, a.title, a.weight ?? "", mk ?? "", 
            targetVal ?? "", prevVal ?? "", displayYearlyProgress,
            ...periodVals
          ]);
        });
      });
    });
    
    // Generate CSV content
    const csv = [headers, ...rows]
      .map(row => row.map(cell => {
        if (cell === null || cell === undefined) return "";
        const s = String(cell).replace(/"/g, '""');
        return `"${s}"`;
      }).join(","))
      .join("\n");
    
    // Create and download file
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `master_report_${granularity}_${calendarSystem}_${groupId || "all"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  
  function exportPDF() {
    if (!master) return alert(t("reports.master.loadFirstAlert"));
    const w = window.open("", "_blank");
    w.document.write(generateHtmlForPrint());
    w.document.close();
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch (e) { }
    }, 400);
  }
  
  return (
    <div className={`min-h-screen bg-gray-[F8FAF5] dark:bg-gray-900 font-sans transition-colors duration-300 ${mounted ? 'animate-fade-in' : ''}`} 
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
          "--surface-container-low": ${m3Colors.surfaceContainerLow};
          "--surface-container": ${m3Colors.surfaceContainer};
          "--surface-container-high": ${m3Colors.surfaceContainerHigh};
          "--surface-container-highest": ${m3Colors.surfaceContainerHighest};
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
          border: 1px solid var(--outline-variant);
        }
        .surface-elevation-2 { 
          box-shadow: 0 2px 6px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06); 
          border: 1px solid var(--outline-variant);
        }
        .surface-elevation-3 { 
          box-shadow: 0 4px 12px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08); 
          border: 1px solid var(--outline-variant);
        }
        .transition-shadow {
          transition: box-shadow 0.3s ease;
        }
        .hover\\:shadow-md:hover {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
      `}</style>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-300 dark:border-gray-800 shadow-2xl px-4 py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex min-w-0 gap-4 items-center">
                <div className="p-3 rounded-xl bg-green-200 dark:bg-indigo-900">
                  <Table2 className="h-6 w-6 text-green-800 dark:text-indigo-200" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-black dark:text-white">
                    {t("reports.master.title")}
                  </h1>
                  <p className="mt-0.5 text-base text-black dark:text-gray-400 max-w-2xl">
                    {t("reports.master.subtitle")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <TopBar />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-300 dark:border-gray-800 shadow-2xl p-4 sm:p-6">
          {/* --- Group Filter and Action Buttons --- */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-5">
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                {t("reports.master.groupSearchLabel", "Select Group")}
              </label>
              <select
                value={groupId}
                onChange={handleGroupSelectChange}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-800 dark:border-gray-300 bg-gray-200 dark:bg-gray-700 text-black dark:text-white text-base transition-all duration-300"
              >
                <option value="">
                  {t("reports.master.allGroups", "All Groups")}
                </option>
                {allGroups.map((group) => (
                  <option key={group.id} value={group.id} className="bg-white dark:bg-gray-700">
                    {group.name}
                  </option>
                ))}
              </select>
              {error && (
                <div className="text-sm text-[var(--error)] dark:text-red-400 mt-2">
                  {error}
                </div>
              )}
              {groupLoadError && (
                <div className="text-sm text-[var(--tertiary)] dark:text-purple-400 mt-2">
                  {groupLoadError}
                </div>
              )}
            </div>
            <div className="md:col-span-2 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <button
                onClick={handleFetch}
                disabled={loading}
                className="px-4 py-2.5 bg-green-400 dark:bg-green-700 text-green-900 dark:text-green-200 rounded-full shadow-md flex items-center justify-center gap-2 hover:bg-green-300 dark:hover:bg-green-600 transition-all duration-300 surface-elevation-1 disabled:opacity-60"
              >
                {loading ? (
                  <Loader className={`h-4 w-4 animate-spin ${isRefreshing ? "scale-125" : "scale-100"}`} />
                ) : (
                  t("reports.master.loadButton")
                )}
              </button>
              <button
                onClick={exportPDF}
                className="px-4 py-2.5 bg-blue-600 dark:bg-blue-900 text-[var(--on-secondary-container)] dark:text-blue-200 rounded-full hover:bg-blue-300 dark:hover:bg-blue-800 transition-all duration-300 surface-elevation-1 flex items-center justify-center gap-2"
              >
                <Printer className="h-4 w-4" />
                <span className="sm:inline">{t("reports.master.exportPDF")}</span>
              </button>
              <button
                onClick={exportCSV}
                className="px-4 py-2.5 bg-purple-600 dark:bg-purple-900 text-[var(--on-tertiary-container)] dark:text-purple-200 rounded-full hover:bg-purple-300 dark:hover:bg-purple-800 transition-all duration-300 surface-elevation-1 flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                <span className="sm:inline">{t("reports.master.exportCSV")}</span>
              </button>
            </div>
          </div>
          
          <div className="flex justify-between items-center mb-2 gap-10">
            {/* Calendar System Toggle */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block">
              {t("reports.master.calendarSystem", "Calendar System")}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setCalendarSystem('gregorian')}
                className={`px-4 py-2 rounded-full transition-all duration-300 ${
                  calendarSystem === 'gregorian'
                    ? "bg-blue-400 dark:bg-blue-700 text-white shadow-[0_2px_6px_rgba(59,130,246,0.3)] dark:shadow-[0_2px_6px_rgba(59,130,246,0.5)] scale-105"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-400 dark:hover:bg-gray-600 hover:text-gray-600 dark:hover:text-white"
                }`}
              >
                {t("reports.master.gregorian", "Gregorian")}
              </button>
              <button
                onClick={() => setCalendarSystem('ethiopian')}
                className={`px-4 py-2 rounded-full transition-all duration-300 ${
                  calendarSystem === 'ethiopian'
                    ? "bg-green-400 dark:bg-green-700 text-white shadow-[0_2px_6px_rgba(16,185,129,0.3)] dark:shadow-[0_2px_6px_rgba(16,185,129,0.5)] scale-105"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-400 dark:hover:bg-gray-600 hover:text-gray-600 dark:hover:text-white"
                }`}
              >
                {t("reports.master.ethiopian", "Ethiopian")}
              </button>
            </div>
          </div>
          
          {/* Granularity Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block">
                {t("reports.master.granularityLabel")}
              </label>
              <div className="flex gap-2">
                {["monthly", "quarterly", "annual"].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    className={`px-4 py-2 rounded-full transition-all duration-300 ${
                      granularity === g
                        ? "bg-green-400 dark:bg-green-700 text-[var(--on-primary)] dark:text-white shadow-[0_2px_6px_rgba(16,185,129,0.3)] dark:shadow-[0_2px_6px_rgba(16,185,129,0.5)] scale-105"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-400 dark:hover:bg-gray-600 hover:text-gray-600 dark:hover:text-white"
                    }`}
                  >
                    {t(`reports.master.granularities.${g}`)}
                  </button>
                ))}
              </div>
            </div>
            {/* <div className="ml-auto text-sm text-gray-600 dark:text-gray-400">
              {t("reports.master.periodColumns", {
                count: periodColumns.length,
                granularity,
              })}
            </div> */}
          </div>
          </div>
          
          {/* Manual Period Selection */}
          <div className="mb-5 surface-elevation-1 rounded-xl p-4 bg-gray-50 dark:bg-gray-800">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Year Input */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {t("reports.master.yearLabel", "Year")}
                </label>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white"
                  min={calendarSystem === 'gregorian' ? "1900" : "1800"}
                  max={calendarSystem === 'gregorian' ? "2100" : "2000"}
                />
              </div>
              
              {/* Monthly Granularity Controls */}
              {granularity === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t("reports.master.monthLabel", "Month")}
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white"
                  >
                    <option value="">{t("reports.master.selectMonth", "Select a month")}</option>
                    {calendarSystem === 'gregorian'
                      ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, index) => (
                          <option key={index + 1} value={index + 1}>{month}</option>
                        ))
                      : ['መስከረም', 'ጥቅምት', 'ኅዳር', 'ታህሳስ', 'ጥር', 'የካቲት', 'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጷጉሜ'].map((month, index) => (
                          <option key={index + 1} value={index + 1}>{month}</option>
                        ))
                    }
                  </select>
                </div>
              )}
              
              {/* Quarterly Granularity Controls */}
              {granularity === 'quarterly' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    {t("reports.master.selectQuarters", "Select Quarters")}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter) => (
                      <label
                        key={quarter}
                        className={`flex flex-col items-center p-2 rounded-lg cursor-pointer border ${
                          selectedQuarters[quarter]
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedQuarters[quarter]}
                          onChange={(e) => setSelectedQuarters(prev => ({
                            ...prev,
                            [quarter]: e.target.checked
                          }))}
                          className="hidden"
                        />
                        <div className={`text-sm font-medium ${
                          selectedQuarters[quarter] ? 'text-blue-600 dark:text-blue-300' : ''
                        }`}>
                          {quarter}
                        </div>
                      </label>
                    ))}
                  </div>
                  
                  {/* Ethiopian Month Assignment (only visible when Ethiopian calendar is selected) */}
                  {calendarSystem === 'ethiopian' && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                        {t("reports.master.assignMonths", "Assign Months to Quarters")}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-gray-600 dark:text-gray-400">
                        {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter) => (
                          <div 
                            key={quarter} 
                            className={`border rounded-lg p-3 ${
                              selectedQuarters[quarter] 
                                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                                : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            <h5 className="font-medium mb-2 text-sm">{quarter}</h5>
                            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                              {quarterMonthAssignments[quarter].map((month, index) => (
                                <div key={`${quarter}-${month}-${index}`} className="flex items-center justify-between text-xs">
                                  <span>{month}</span>
                                  <button
                                    onClick={() => {
                                      // Move month to next quarter
                                      const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
                                      const currentIndex = quarters.indexOf(quarter);
                                      const nextIndex = (currentIndex + 1) % quarters.length;
                                      const nextQuarter = quarters[nextIndex];
                                      
                                      setQuarterMonthAssignments(prev => ({
                                        ...prev,
                                        [quarter]: prev[quarter].filter(m => m !== month),
                                        [nextQuarter]: [...(prev[nextQuarter] || []), month]
                                      }));
                                    }}
                                    className="text-blue-500 hover:text-blue-700"
                                    title={`Move to ${quarter === 'Q4' ? 'Q1' : `Q${parseInt(quarter[1]) + 1}`}`}
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                              {quarterMonthAssignments[quarter].length === 0 && (
                                <div className="text-center text-gray-400 text-xs py-1">
                                  {t("reports.master.noMonthsAssigned", "No months assigned")}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Narratives Section */}
          <div className="mb-6 animate-fade-in">
            <h2 className="text-xl font-semibold mb-3 text-gray-600 dark:text-white">
              {t("reports.master.narrativesTitle")}
            </h2>
            {!master && (
              <div className="text-base text-gray-600 dark:text-gray-400">
                {t("reports.master.noData")}
              </div>
            )}
            {master && master.goals && master.goals.length === 0 && (
              <div className="text-base text-gray-600 dark:text-gray-400">
                {t("reports.master.noGoals")}
              </div>
            )}
            {master && master.goals && master.goals.length > 0 && (
              <div className="space-y-4">
                {master.goals.map((g, goalIndex) => {
                  const goalNum = `${goalIndex + 1}`;
                  return (
                    <div
                      key={g.id}
                      className="p-4 rounded-xl bg-gray-200 dark:bg-gray-700 border border-[var(--outline-variant)] dark:border-gray-600 surface-elevation-1 transition-all duration-300"
                      style={{ animationDelay: `${goalIndex * 100}ms` }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-gray-600 dark:text-white">{`${goalNum}. ${g.title}`}</h3>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                            {g.status} • {g.progress ?? 0}%
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pl-2 space-y-3">
                        {(g.tasks || []).map((task, taskIndex) => {
                          const taskNum = `${goalNum}.${taskIndex + 1}`;
                          return (
                            <div key={task.id} className="animate-slide-in-up">
                              <div className="text-base font-semibold text-gray-600 dark:text-white">
                                {`${taskNum}. ${task.title}`}{" "}
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  ({task.progress ?? 0}%)
                                </span>
                              </div>
                              <div className="pl-3 mt-2 space-y-3">
                                {(task.activities || []).map((a, activityIndex) => {
                                  const activityNum = `${taskNum}.${activityIndex + 1}`;
                                  return (
                                    <div
                                      key={a.id}
                                      className="p-3 bg-gray-300 dark:bg-gray-800 rounded-xl border border-[var(--outline-variant)] dark:border-gray-600 surface-elevation-1 transition-all duration-300"
                                      style={{ animationDelay: `${activityIndex * 80}ms` }}
                                    >
                                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div className="flex-1">
                                          <div className="text-base font-medium text-gray-600 dark:text-white">{`${activityNum}. ${a.title}`}</div>
                                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <MetricSection 
                                              title={t("reports.master.targetText")} 
                                              metrics={a.targetMetric} 
                                              t={t} 
                                              darkMode={darkMode}
                                            />
                                            <MetricSection 
                                              title={t("reports.master.currentLabel", "Current")} 
                                              metrics={a.currentMetric} 
                                              t={t} 
                                              darkMode={darkMode}
                                            />
                                            <MetricSection 
                                              title={t("reports.master.previousText", "Previous")} 
                                              metrics={a.previousMetric} 
                                              t={t} 
                                              darkMode={darkMode}
                                            />
                                            <MetricSection 
                                              title={t("reports.master.quarterlyGoals", "Quarterly Goals")} 
                                              metrics={a.quarterlyGoals} 
                                              t={t} 
                                              darkMode={darkMode}
                                            />
                                          </div>
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 min-w-[120px] text-right">
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-white">
                                            {a.status === "Done" ? (
                                              <span className="text-green-600 dark:text-green-400">✓ {t("reports.master.done")}</span>
                                            ) : (
                                              <span className="text-purple-600 dark:text-purple-400">● {t("reports.master.open")}</span>
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="mt-3">
                                        <h4 className="text-sm font-medium text-gray-600 dark:text-white mb-2">
                                          {t("reports.master.reportsTitle", "Reports")}
                                        </h4>
                                        {(a.reports || []).length === 0 ? (
                                          <div className="text-sm text-gray-600 dark:text-gray-400">
                                            {t("reports.master.noReports")}
                                          </div>
                                        ) : (
                                          <div className="space-y-3">
                                            {(a.reports || []).map((r, reportIndex) => (
                                              <div
                                                key={r.id}
                                                className="p-3 bg-gray-200 dark:bg-gray-700 rounded-lg border border-[var(--outline-variant)] dark:border-gray-600 surface-elevation-1 transition-all duration-300"
                                                style={{ animationDelay: `${reportIndex * 60}ms` }}
                                              >
                                                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 mb-2">
                                                  <div className="text-sm font-medium text-gray-600 dark:text-white">
                                                    #{r.id} •{" "}
                                                    <span className="text-gray-600 dark:text-gray-400">
                                                      {r.status}
                                                    </span>
                                                  </div>
                                                  <div className="text-sm text-gray-600 dark:text-gray-400">
                                                    {r.createdAt
                                                      ? new Date(r.createdAt).toLocaleString()
                                                      : ""}
                                                  </div>
                                                </div>
                                                <div className="text-base text-gray-600 dark:text-gray-300 break-words">
                                                  {r.narrative || (
                                                    <em className="text-gray-600 dark:text-gray-400">
                                                      {t("reports.noNarrative")}
                                                    </em>
                                                  )}
                                                </div>
                                                {r.metrics && (
                                                  <div className="mt-3">
                                                    <div className="text-sm font-medium text-gray-600 dark:text-white mb-1">
                                                      {t("reports.metrics.title", "Metrics")}
                                                    </div>
                                                    <MetricsDisplay metrics={r.metrics} darkMode={darkMode} />
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Data Table Section */}
          <div className="animate-fade-in">
            <h2 className="text-xl font-semibold mb-4 text-gray-600 dark:text-white">
              {t("reports.table.titleFull")}
            </h2>
            <div className="overflow-auto rounded-xl border border-[var(--outline-variant)] dark:border-gray-600 surface-elevation-1">
              <table className="min-w-full">
                <thead className="bg-gray-300 dark:bg-gray-700">
                  <tr>
                    <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-3 py-2 sm:px-4 sm:py-3 text-left text-sm font-medium text-gray-600 dark:text-white sticky left-0 z-20">
                      {t("reports.table.title")}
                    </th>
                    <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-3 py-2 sm:px-4 sm:py-3 text-sm font-medium text-gray-600 dark:text-white">
                      {t("reports.table.weight")}
                    </th>
                    <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-3 py-2 sm:px-4 sm:py-3 text-sm font-medium text-gray-600 dark:text-white">
                      {t("reports.table.metric")}
                    </th>
                    <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-3 py-2 sm:px-4 sm:py-3 text-sm font-medium text-gray-600 dark:text-white">
                      {t("reports.table.target")}
                    </th>
                    <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-3 py-2 sm:px-4 sm:py-3 text-sm font-medium text-gray-600 dark:text-white">
                      {t("reports.table.previous", "Previous")}
                    </th>
                    <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-3 py-2 sm:px-4 sm:py-3 text-sm font-medium text-gray-600 dark:text-white">
                      {t("reports.table.yearlyProgress", "Yearly Progress %")}
                    </th>
                    {/* --- Dynamic Headers for Quarterly/Monthly/Annual --- */}
                    {granularity === "quarterly" ? periodColumns.map(p => {
                      const quarterKey = p.split('-')[1];
                      const displayYear = getDisplayYear();
                      const quarterLabel = fmtQuarterKey(quarterKey);
                      const label = `${quarterLabel} ${displayYear}`;
                      
                      return (
                        <React.Fragment key={p}>
                          <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-3 py-2 sm:px-4 sm:py-3 text-sm font-medium text-gray-600 dark:text-white">
                            {t("reports.table.qGoal", "Goal")} ({label})
                          </th>
                          <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-3 py-2 sm:px-4 sm:py-3 text-sm font-medium text-gray-600 dark:text-white">
                            {t("reports.table.qRecord", "Record")} ({label})
                          </th>
                          <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-3 py-2 sm:px-4 sm:py-3 text-sm font-medium text-gray-600 dark:text-white">
                            {t("reports.table.qProgress", "Progress %")} ({label})
                          </th>
                        </React.Fragment>
                      );
                    }) : periodColumns.map((p) => {
                      let label = p;
                      const displayYear = getDisplayYear();
                      
                      if (granularity === "monthly") {
                        const monthNum = p.split('-')[1];
                        const monthName = fmtMonthKey(monthNum);
                        label = `${monthName} ${displayYear}`;
                      } else if (granularity === "annual") {
                        label = displayYear;
                      }
                      
                      return (
                        <th
                          key={p}
                          className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-3 py-2 sm:px-4 sm:py-3 text-sm font-medium text-gray-600 dark:text-white"
                        >
                          {label}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--outline-variant)] dark:divide-gray-600 bg-gray-100 dark:bg-gray-700">
                  {tableRows.map((row, index) => {
                    if (row.type === "goal" || row.type === "task") {
                      const numEmptyCols = granularity === 'quarterly' ? 
                        periodColumns.length * 3 : periodColumns.length;
                      
                      return (
                        <tr
                          key={row.id}
                          className={`${row.type === 'goal' ? 'bg-[var(--primary-container)]/[0.1] dark:bg-gray-900/[0.15]' : 'bg-gray-100 dark:bg-gray-700'} transition-all duration-300`}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <td className={`border-b border-[var(--outline-variant)] dark:border-gray-600 px-3 py-2 sm:px-4 sm:py-3 font-medium text-gray-600 dark:text-white text-sm ${row.type === 'task' ? 'pl-6 sm:pl-6' : ''} sticky left-0 z-20`}>
                            {`${row.number}. ${row.title}`}
                          </td>
                          <td className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-3 py-2 sm:px-4 sm:py-3 text-gray-600 dark:text-white text-sm">
                            {row.weight}
                          </td>
                          <td className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-3 py-2 sm:px-4 sm:py-3 text-gray-600 dark:text-white text-sm">
                            —
                          </td>
                          <td className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-3 py-2 sm:px-4 sm:py-3 text-gray-600 dark:text-white text-sm">
                            —
                          </td>
                          <td className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-3 py-2 sm:px-4 sm:py-3 text-gray-600 dark:text-white text-sm">
                            —
                          </td>
                          <td className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-3 py-2 sm:px-4 sm:py-3 text-gray-600 dark:text-white text-sm">
                            —
                          </td>
                          {Array(numEmptyCols).fill(0).map((_, i) => (
                            <td
                              key={`empty-${row.id}-${i}`}
                              className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-3 py-2 sm:px-4 sm:py-3 text-gray-600 dark:text-white text-sm"
                            >
                              —
                            </td>
                          ))}
                        </tr>
                      );
                    } else {
                      return (
                        <ActivityRow
                          key={row.id}
                          activity={row.activity}
                          periods={periodColumns}
                          granularity={granularity}
                          number={row.number}
                          index={index}
                          t={t}
                          darkMode={darkMode}
                          calendarSystem={calendarSystem}
                          quarterMonthAssignments={quarterMonthAssignments}
                        />
                      );
                    }
                  })}
                  {tableRows.length === 0 && (
                    <tr>
                      <td
                        className="p-6 text-center text-gray-600 dark:text-gray-400 text-base"
                        colSpan={6 + (granularity === 'quarterly' ? periodColumns.length * 3 : periodColumns.length)}
                      >
                        {t("reports.table.noData")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------
* Helper Components
* ------------------------- */
const MetricSection = ({ title, metrics, t, darkMode = false }) => (
  <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-200 dark:bg-gray-600 border-gray-600' : 'bg-[var(--surface-container-lowest)] border-[var(--outline-variant)]'} border`}>
    <div className={`text-sm font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-[var(--on-surface-variant)]'}`}>{title}:</div>
    <div className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-base`}>
      {metrics ? <MetricsDisplay metrics={metrics} darkMode={darkMode} /> : "-"}
    </div>
  </div>
);

const MetricsDisplay = ({ metrics, darkMode = false }) => {
  if (!metrics) return "-";
  let obj = null;
  try {
    if (typeof metrics === "string") {
      obj = metrics.trim() === "" ? null : JSON.parse(metrics);
    } else {
      obj = metrics;
    }
  } catch (err) {
    const s = String(metrics);
    return (
      <div className={`text-base font-mono break-words p-1.5 rounded border ${darkMode ? 'bg-gray-50 dark:bg-gray-800 border-gray-600 text-gray-300' : 'bg-[var(--surface-container-low)] text-gray-600'}`}>
        {s}
      </div>
    );
  }
  if (!obj || typeof obj !== "object") {
    return <div className={`text-base ${darkMode ? 'text-gray-400' : 'text-[var(--on-surface-variant)]'}`}>—</div>;
  }
  const keys = Object.keys(obj);
  if (keys.length === 0) return <div className={`text-base ${darkMode ? 'text-gray-400' : 'text-[var(--on-surface-variant)]'}`}>—</div>;
  return (
    <div className="space-y-1.5">
      {keys.map((k, index) => {
        const value = obj[k];
        const displayValue =
          value !== null && typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
        return (
          <div
            key={k}
            className={`flex items-start justify-between rounded px-2.5 py-1.5 border gap-3 ${darkMode ? 'bg-gray-50 dark:bg-gray-800 border-gray-600' : 'bg-[var(--surface-container-low)] border-[var(--outline-variant)]'}`}
          >
            <div className={`text-sm pt-px ${darkMode ? 'text-gray-800 dark:text-gray-200' : 'text-[var(--on-surface-variant)]'}`}>{k}</div>
            <div className={`text-base font-mono break-all text-right whitespace-pre-wrap ${darkMode ? 'text-gray-800 dark:text-gray-200' : 'text-gray-600'}`}>
              {displayValue}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* -------------------------
* Report helpers with calendar system awareness
* ------------------------- */

/**
* Utility function to safely parse JSON strings or return the object if already parsed.
* @param {string|object} v - The value to parse.
* @returns {object|null} The parsed object or null.
*/
function safeParseJson(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      return v.trim() === "" ? null : JSON.parse(v);
    } catch {
      return null;
    }
  }
  return null;
}

/**
* Utility function to convert value to a number, or null if invalid.
*/
function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalizePeriodKey(rawKey, granularity) {
  if (!rawKey) return null;
  
  // For monthly: format as YYYY-MM
  if (granularity === "monthly") {
    const parts = String(rawKey).split("-");
    if (parts.length >= 2) {
      const y = parts[0];
      const m = String(Number(parts[1])).padStart(2, "0");
      return `${y}-${m}`;
    }
    return rawKey;
  }
  
  // For quarterly: format as YYYY-Qn
  if (granularity === "quarterly") {
    if (rawKey.includes("-Q")) return rawKey;
    const parts = String(rawKey).split("-");
    if (parts.length >= 2) {
      const y = parts[0];
      const m = Number(parts[1]);
      const q = Math.floor((m - 1) / 3) + 1;
      return `${y}-Q${q}`;
    }
    return rawKey;
  }
  
  // For annual: just the year
  if (granularity === "annual") {
    const parts = String(rawKey).split("-");
    return parts[0];
  }
  
  return rawKey;
}

// Note: fmtMonthKey and fmtQuarterKey are defined in the component

function extractMetricValue(metricsObj, metricKey) {
  if (!metricsObj) return null;
  const metrics = safeParseJson(metricsObj);
  if (!metrics) return null;
  
  // Check top level
  if (metricKey && metrics[metricKey] !== undefined) return metrics[metricKey];
  
  // Check common nested names
  if (metrics.currentMetric) {
    const current = safeParseJson(metrics.currentMetric);
    if (current && metricKey && current[metricKey] !== undefined) return current[metricKey];
  }
  
  if (metrics.metrics_data) {
    const metricsData = safeParseJson(metrics.metrics_data);
    if (metricsData && metricKey && metricsData[metricKey] !== undefined) return metricsData[metricKey];
  }
  
  // If no key, find first
  if (!metricKey) {
    if (metrics.currentMetric) {
      const current = safeParseJson(metrics.currentMetric);
      const k = Object.keys(current || {})[0];
      if (k) return current[k];
    }
    
    if (metrics.metrics_data) {
      const metricsData = safeParseJson(metrics.metrics_data);
      const k = Object.keys(metricsData || {})[0];
      if (k) return metricsData[k];
    }
    
    const k = Object.keys(metrics)[0];
    if (k) return metrics[k];
  }
  
  return null;
}

function getLatestMetricValueInPeriod(
  activity,
  periodKey,
  granularity,
  metricKey
) {
  const hist = activity.history?.[granularity] || {};
  const normalizedKey = normalizePeriodKey(periodKey, granularity);
  if (!normalizedKey) return null;
  
  const candidateReports = [];
  const rawKeys = Object.keys(hist || {});
  
  for (const rk of rawKeys) {
    try {
      const norm = normalizePeriodKey(rk, granularity);
      if (norm === normalizedKey) {
        const bucket = Array.isArray(hist[rk]) ? hist[rk].slice() : [];
        for (const r of bucket) candidateReports.push(r);
      }
    } catch (e) {
      // ignore
    }
  }
  
  if (candidateReports.length === 0) return null;
  
  // Sort by date (most recent first)
  candidateReports.sort((a, b) => {
    const da = a && a.date ? new Date(a.date) : (a && a.createdAt ? new Date(a.createdAt) : null);
    const db = b && b.date ? new Date(b.date) : (b && b.createdAt ? new Date(b.createdAt) : null);
    if (!da && !db) return 0;
    if (!da) return -1;
    if (!db) return 1;
    return db - da; // Most recent first
  });
  
  // Find first report with valid metric value
  for (const r of candidateReports) {
    if (!r || !r.metrics) continue;
    const v = extractMetricValue(r.metrics, metricKey);
    if (v !== null && v !== undefined) return v;
  }
  
  return null;
}

// Helper to get Goal, Record, Progress %
// MODIFIED: Now accepts calendar system and quarter month assignments
function getQuarterlyStats(activity, periodKey, metricKey, calendarSystem, quarterMonthAssignments) {
  const [year, quarterKey] = String(periodKey).split('-');
  if (!quarterKey) return { goal: null, record: null, progress: null };
  
  // Get goal from quarterlyGoals
  const qGoals = safeParseJson(activity.quarterlyGoals);
  const goal = qGoals ? toNumberOrNull(qGoals[quarterKey.toLowerCase()]) : null;
  
  // For record, we need to aggregate values from the months in this quarter
  let totalRecord = 0;
  let validMonths = 0;
  
  if (calendarSystem === 'ethiopian' && quarterMonthAssignments[quarterKey]) {
    // Ethiopian calendar with manual month assignments
    const months = quarterMonthAssignments[quarterKey];
    
    months.forEach(monthName => {
      // Find the month number for this Ethiopian month
      const ethiopianMonths = [
        'መስከረም', 'ጥቅምት', 'ኅዳር', 'ታህሳስ', 'ጥር', 'የካቲት',
        'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጷጉሜ'
      ];
      const monthIndex = ethiopianMonths.indexOf(monthName) + 1;
      
      if (monthIndex > 0) {
        // Get the record value for this month
        const monthKey = `${year}-${monthIndex.toString().padStart(2, '0')}`;
        const recordRaw = getLatestMetricValueInPeriod(activity, monthKey, 'monthly', metricKey);
        const record = toNumberOrNull(recordRaw);
        
        if (record !== null) {
          totalRecord += record;
          validMonths++;
        }
      }
    });
  } else {
    // Gregorian calendar - use the quarter directly
    const recordRaw = getLatestMetricValueInPeriod(activity, periodKey, 'quarterly', metricKey);
    const record = toNumberOrNull(recordRaw);
    
    if (record !== null) {
      totalRecord = record;
      validMonths = 1;
    }
  }
  
  let progress_pct = null;
  if (validMonths > 0 && goal !== null) {
    if (goal > 0) {
      progress_pct = (totalRecord / goal) * 100;
    } else if (goal === 0) {
      progress_pct = (totalRecord > 0) ? 100.0 : 0.0;
    }
  }
  
  return { 
    goal, 
    record: validMonths > 0 ? totalRecord : null, 
    progress: progress_pct 
  };
}

// Helper to get overall Target, Previous, and Current
function getOverallMetrics(activity, metricKey) {
  // Target
  const targetObj = safeParseJson(activity.targetMetric) || {};
  let targetVal = null;
  if (metricKey && targetObj[metricKey] !== undefined) targetVal = targetObj[metricKey];
  else if (typeof targetObj === "number") targetVal = targetObj;
  else if (targetObj && Object.keys(targetObj).length > 0) targetVal = targetObj[Object.keys(targetObj)[0]];
  
  // Previous
  const previousObj = safeParseJson(activity.previousMetric) || {};
  let prevVal = null;
  if (metricKey && previousObj[metricKey] !== undefined) prevVal = previousObj[metricKey];
  else if (typeof previousObj === "number") prevVal = previousObj;
  else if (previousObj && Object.keys(previousObj).length > 0) prevVal = previousObj[Object.keys(previousObj)[0]];
  
  // Current
  const currentObj = safeParseJson(activity.currentMetric) || {};
  let currentVal = null;
  if (metricKey && currentObj[metricKey] !== undefined) currentVal = currentObj[metricKey];
  else if (typeof currentObj === "number") currentVal = currentObj;
  else if (currentObj && Object.keys(currentObj).length > 0) currentVal = currentObj[Object.keys(currentObj)[0]];
  
  return { targetVal, prevVal, currentVal };
}

/* ActivityRow updated with calendar system awareness */
function ActivityRow({
  activity,
  periods,
  granularity,
  number,
  index,
  t,
  darkMode = false,
  calendarSystem,
  quarterMonthAssignments
}) {
  const metricKey = pickMetricForActivity(activity, null);
  const { targetVal, prevVal, currentVal } = getOverallMetrics(activity, metricKey);
  
  // Calculate Yearly Progress
  const targetNum = toNumberOrNull(targetVal);
  const currentNum = toNumberOrNull(currentVal);
  let yearlyProgressPct = null;
  
  if (targetNum !== null && currentNum !== null) {
    if (targetNum > 0) {
      yearlyProgressPct = (currentNum / targetNum) * 100;
    } else if (targetNum === 0) {
      yearlyProgressPct = (currentNum > 0) ? 100.0 : 0.0;
    }
  }
  
  const displayYearlyProgress = yearlyProgressPct === null ? '-' : `${yearlyProgressPct.toFixed(2)}%`;
  
  function formatMetricValue(val) {
    if (val === null || val === undefined) return "-";
    if (typeof val === "object") {
      return JSON.stringify(val);
    }
    return String(val);
  }
  
  return (
    <tr
      className={`transition-all duration-300 hover:bg-opacity-90 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-[var(--surface-container-low)]'}`}
      style={{ 
        animationDelay: `${index * 60}ms`,
        backgroundColor: darkMode ? '#1f2937' : 'var(--surface-container-lowest)'
      }}
    >
      <td className={`bg-gray-100 dark:bg-gray-700 dark:text-gray-300 text-gray-700 border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-3 py-2 sm:px-4 sm:py-3 text-sm font-medium pl-5 sticky left-0 z-20`}>
        <div>{`${number} ${activity.title}`}</div>
      </td>
      <td className={`bg-gray-100 dark:bg-gray-700 dark:text-gray-300 text-gray-700 border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-3 py-2 sm:px-4 sm:py-3 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 text-center min-w-[56px]`}>
        <div>{activity.weight ?? "-"}</div>
      </td>
      <td className={`bg-gray-100 dark:bg-gray-700 dark:text-gray-300 text-gray-700 border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-3 py-2 sm:px-4 sm:py-3 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 text-center min-w-[64px]`}>
        <div>{metricKey ?? "-"}</div>
      </td>
      <td className={`bg-gray-100 dark:bg-gray-700 dark:text-gray-300 text-gray-700 border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-3 py-2 sm:px-4 sm:py-3 text-sm text-[var(--on-surface-variant)] dark:text-gray-300 text-right min-w-[72px] font-mono`}>
        <div>{typeof targetVal === 'number' ? targetVal.toLocaleString() : targetVal ?? "-"}</div>
      </td>
      <td className={`bg-gray-100 dark:bg-gray-700 dark:text-gray-300 text-gray-700 border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-3 py-2 sm:px-4 sm:py-3 text-sm text-[var(--on-surface-variant)] dark:text-gray-300 text-right min-w-[72px] font-mono`}>
        <div>{typeof prevVal === 'number' ? prevVal.toLocaleString() : prevVal ?? "-"}</div>
      </td>
      <td className={`bg-gray-100 dark:bg-gray-700 dark:text-gray-300 text-gray-700 border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-3 py-2 sm:px-4 sm:py-3 text-sm text-[var(--on-surface-variant)] dark:text-gray-300 text-right min-w-[72px] font-mono`}>
        <div>{displayYearlyProgress}</div>
      </td>
      {/* --- Dynamic Cells for Quarterly --- */}
      {granularity === "quarterly" ? periods.map(p => {
        const { goal, record, progress } = getQuarterlyStats(
          activity, p, metricKey, calendarSystem, quarterMonthAssignments
        );
        const displayProgress = progress === null ? '-' : `${progress.toFixed(2)}%`;
        
        return (
          <React.Fragment key={p}>
            <td className={`bg-gray-100 dark:bg-gray-700 dark:text-gray-300 text-gray-700 border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-3 py-2 sm:px-4 sm:py-3 text-sm text-[var(--on-surface-variant)] ${darkMode ? 'text-gray-300' : 'text-[var(--on-surface-variant)]'} text-right min-w-[68px] font-mono`}>
              <div>{typeof goal === 'number' ? goal.toLocaleString() : goal ?? '-'}</div>
            </td>
            <td className={`bg-gray-100 dark:bg-gray-700 dark:text-gray-300 text-gray-700 border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-3 py-2 sm:px-4 sm:py-3 text-sm text-[var(--on-surface-variant)] ${darkMode ? 'text-gray-300' : 'text-[var(--on-surface-variant)]'} text-right min-w-[68px] font-mono`}>
              <div>{typeof record === 'number' ? record.toLocaleString() : record ?? '-'}</div>
            </td>
            <td className={`bg-gray-100 dark:bg-gray-700 dark:text-gray-300 text-gray-700 border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-3 py-2 sm:px-4 sm:py-3 text-sm font-medium text-right min-w-[68px] font-mono`}>
              <div>{displayProgress}</div>
            </td>
          </React.Fragment>
        );
      }) : periods.map((p) => {
        const rawVal = getLatestMetricValueInPeriod(
          activity,
          p,
          granularity,
          metricKey
        );
        const display = formatMetricValue(rawVal);
        
        return (
          <td
            key={p}
            className={`border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-3 py-2 sm:px-4 sm:py-3 text-sm ${darkMode ? 'text-gray-300' : 'text-[var(--on-surface-variant)]'} text-right min-w-[68px]`}
          >
            <div className="min-w-0">
              <div className="text-sm font-mono">{display}</div>
            </div>
          </td>
        );
      })}
    </tr>
  );
}

// Pick metric key for activity
function pickMetricForActivity(activity, metricKey) {
  if (metricKey) return metricKey;
  
  // Try to get from target metric
  const tg = safeParseJson(activity.targetMetric) || {};
  const tgKeys = Object.keys(tg);
  if (tgKeys.length) return tgKeys[0];
  
  // Try to get from current metric
  const cur = safeParseJson(activity.currentMetric) || {};
  const curKeys = Object.keys(cur);
  if (curKeys.length) return curKeys[0];
  
  // Try to get from history
  const hist = activity.history || {};
  for (const g of ["monthly", "quarterly", "annual"]) {
    const periodObj = hist[g] || {};
    for (const periodKey of Object.keys(periodObj)) {
      const reports = periodObj[periodKey] || [];
      for (const r of reports) {
        const metrics = safeParseJson(r.metrics);
        if (metrics && typeof metrics === "object") {
          const keys = Object.keys(metrics);
          if (keys.length) return keys[0];
        }
      }
    }
  }
  
  return null;
}

export default App;