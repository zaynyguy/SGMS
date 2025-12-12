import React, { useState, useEffect, useMemo } from "react";
import { Loader, Download, Printer, Table2, ChevronRight, Moon, Sun } from "lucide-react";
import { fetchMasterReport } from "../api/reports";
import { useTranslation } from "react-i18next";
import { fetchGroups } from "../api/groups";
import TopBar from "../components/layout/TopBar";
/* -------------------------
* Master Report page wrapper with Material Design 3
* MODIFIED:
* - Added "Yearly Progress %" column (Current / Target * 100).
* - Renamed quarterly "Variance %" to "Progress %".
* - Updated 'getQuarterlyStats' to calculate progress: (Record / Goal) * 100.
* - Updated 'getOverallMetrics' to also return 'currentVal'.
* - Print and CSV exports updated to reflect both changes.
* ------------------------- */
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
      const data = await fetchMasterReport(groupId || undefined);
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

  const periodColumns = useMemo(() => {
    if (!master) return [];
    return flattenPeriods(master, granularity);
  }, [master, granularity]);

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
          const label = fmtQuarterKey(p);
          return [
            `<th style="padding:6px;border:1px solid #ddd;background:#f3f4f6">${escapeHtml(t("reports.table.qGoal", "Goal"))} (${escapeHtml(label)})</th>`,
            `<th style="padding:6px;border:1px solid #ddd;background:#f3f4f6">${escapeHtml(t("reports.table.qRecord", "Record"))} (${escapeHtml(label)})</th>`,
            // MODIFIED: Header label changed to "Progress %"
            `<th style="padding:6px;border:1px solid #ddd;background:#f3f4f6">${escapeHtml(t("reports.table.qProgress", "Progress %"))} (${escapeHtml(label)})</th>`,
          ].join("");
        })
        .join("");
    }
    // Monthly or Annual
    return periodColumns
      .map((p) => {
        let label = p;
        if (granularity === "monthly") label = fmtMonthKey(p);
        return `<th style="padding:6px;border:1px solid #ddd;background:#f3f4f6">${escapeHtml(
          label
        )}</th>`;
      })
      .join("");
  }, [periodColumns, granularity, t]);

  // Generate table cells for print/export
  const periodCellsHtml = (row) => {
    const emptyCell = `<td style="padding:6px;border:1px solid #ddd">—</td>`;
    if (row.type === "goal" || row.type === "task") {
      const numCols = granularity === "quarterly" ? periodColumns.length * 3 : periodColumns.length;
      // Add 1 for the new Yearly Progress % column
      return Array(numCols + 1).fill(emptyCell).join("");
    }
    // Activity row
    const a = row.activity;
    const mk = pickMetricForActivity(a, null);
    // --- Yearly Progress Cell (must be calculated first) ---
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
    // --- End Yearly ---
    if (granularity === "quarterly") {
      const quarterlyCells = periodColumns.map(p => {
        // MODIFIED: 'variance' is now 'progress'
        const { goal, record, progress } = getQuarterlyStats(a, p, mk);
        // MODIFIED: Format the percentage value
        const displayProgress = progress === null ? '-' : `${progress.toFixed(2)}%`;
        return [
          `<td style="padding:6px;border:1px solid #ddd">${escapeHtml(String(goal ?? "-"))}</td>`,
          `<td style="padding:6px;border:1px solid #ddd">${escapeHtml(String(record ?? "-"))}</td>`,
          // MODIFIED: Display the formatted percentage
          `<td style="padding:6px;border:1px solid #ddd;">${escapeHtml(displayProgress)}</td>`
        ].join("");
      }).join("");
      return yearlyProgressCell + quarterlyCells;
    }
    // Monthly or Annual
    const periodCells = periodColumns
      .map((p) => {
        const v = getLatestMetricValueInPeriod(
          a,
          p,
          granularity,
          mk
        );
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
      })
      .join("");
    return yearlyProgressCell + periodCells;
  };

  function generateHtmlForPrint() {
    const data = master || { goals: [] };
    const columnsHtml = periodHeadersHtml; // Use memoized headers
    const rowsHtml = tableRows
      .map((row) => {
        const titleWithNumber = `${row.number}. ${row.title}`;
        const padding = row.type === "goal" ? '6px' : (row.type === "task" ? '16px' : '28px');
        const weight = row.type === 'goal' ? '700' : '400';
        // Non-activity rows
        if (row.type !== "activity") {
          const emptyQuarterlyCells = granularity === "quarterly" ? periodColumns.length * 3 : periodColumns.length;
          const emptyCells = Array(emptyQuarterlyCells + 1).fill(0).map(() => `<td style="padding:6px;border:1px solid #ddd">—</td>`).join(""); // +1 for yearly progress
          return `<tr><td style="padding:6px;border:1px solid #ddd;font-weight:${weight};padding-left:${padding}">${escapeHtml(
            titleWithNumber
          )}</td><td style="padding:6px;border:1px solid #ddd">${escapeHtml(
            String(row.weight)
          )}</td><td style="padding:6px;border:1px solid #ddd">—</td><td style="padding:6px;border:1px solid #ddd">—</td><td style="padding:6px;border:1px solid #ddd">—</td>${emptyCells}</tr>`;
        }
        // Activity row
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
        const displayYearlyProgress = yearlyProgressPct === null ? '-' : `${yearlyProgressPct.toFixed(2)}%`;
        const quarterlyCellsHtml = periodCellsHtml(row); // This already includes the yearly cell, let's fix that.
        // --- Recalculate periodCellsHtml just for this function ---
        const yearlyProgressCell = `<td style="padding:6px;border:1px solid #ddd">${escapeHtml(displayYearlyProgress)}</td>`;
        let periodCells = "";
        if (granularity === "quarterly") {
          periodCells = periodColumns.map(p => {
            const { goal, record, progress } = getQuarterlyStats(row.activity, p, mk);
            const displayProgress = progress === null ? '-' : `${progress.toFixed(2)}%`;
            return [
              `<td style="padding:6px;border:1px solid #ddd">${escapeHtml(String(goal ?? "-"))}</td>`,
              `<td style="padding:6px;border:1px solid #ddd">${escapeHtml(String(record ?? "-"))}</td>`,
              `<td style="padding:6px;border:1px solid #ddd;">${escapeHtml(displayProgress)}</td>`
            ].join("");
          }).join("");
        } else {
          // Monthly or Annual
          periodCells = periodColumns.map((p) => {
              const v = getLatestMetricValueInPeriod(row.activity, p, granularity, mk);
              if (v === null || v === undefined) return `<td style="padding:6px;border:1px solid #ddd">—</td>`;
              let dv = v;
              if (typeof dv === "object") {
                try {
                  const k = Object.keys(dv || {})[0];
                  if (k) dv = dv[k]; else dv = JSON.stringify(dv);
                } catch (e) { dv = JSON.stringify(dv); }
              }
              return `<td style="padding:6px;border:1px solid #ddd">${escapeHtml(String(dv))}</td>`;
            }).join("");
        }
        // --- End recalculation ---
        return `<tr><td style="padding:6px;border:1px solid #ddd;padding-left:${padding}">${escapeHtml(
          titleWithNumber
        )}</td><td style="padding:6px;border:1px solid #ddd">${escapeHtml(
          String(row.weight)
        )}</td><td style="padding:6px;border:1px solid #ddd">${escapeHtml(
          mk ?? "-"
        )}</td><td style="padding:6px;border:1px solid #ddd">${escapeHtml(
          String(targetVal ?? "-")
        )}</td><td style="padding:6px;border:1px solid #ddd">${escapeHtml(
          String(prevVal ?? "-")
        )}</td>${yearlyProgressCell}${periodCells}</tr>`;
      })
      .join("");
    const title = t("reports.master.title");
    const groupLabel = t("reports.master.groupLabel");
    const narratives = t("reports.master.narratives");
    const dataTable = t("reports.master.dataTable");
    const generated = t("reports.master.generatedAt", {
      date: new Date().toLocaleString(),
    });
    // --- UPDATED NARRATIVE SECTION ---
    // (This now includes quarterlyGoals)
    const narrativesHtml = data.goals
      .map((g, goalIndex) => {
        const goalNum = `${goalIndex + 1}`;
        return `
<div style="margin-bottom:10px;padding:8px;border:1px solid #eee;border-radius:4px;background:#fbfbfb" class="print-goal-narrative">
<div style="font-weight:700;font-size:13px">${escapeHtml(
          `${goalNum}. ${g.title}`
        )} <span style="font-weight:400;color:#6b7280">• ${escapeHtml(
          String(g.status || "—")
        )} • ${escapeHtml(String(g.progress ?? 0))}% • weight: ${escapeHtml(
          String(g.weight ?? "-")
        )}</span></div>
<div style="margin-top:6px;padding-left:6px">
${(g.tasks || [])
          .map((task, taskIndex) => {
            const taskNum = `${goalNum}.${taskIndex + 1}`;
            return `
<div style="margin-bottom:6px">
<div style="font-weight:600">${escapeHtml(
              `${taskNum}. ${task.title}`
            )} <span style="color:#6b7280">(${escapeHtml(
              String(task.progress ?? 0)
            )}%) • weight: ${escapeHtml(String(task.weight ?? "-"))}</span></div>
${(task.activities || [])
              .map((activity, activityIndex) => {
                const activityNum = `${taskNum}.${activityIndex + 1}`;
                return `
<div style="margin-left:12px;margin-top:4px;padding:6px;border:1px solid #f1f5f9;border-radius:3px;background:#fff">
<div style="font-weight:600">${escapeHtml(
                  `${activityNum}. ${activity.title}`
                )}</div>
<div style="color:#6b7280;margin-top:4px;font-size:11px;"><strong>${escapeHtml(
                  t("reports.master.targetLabel")
                )}:</strong> ${
                  activity.targetMetric
                    ? escapeHtml(JSON.stringify(activity.targetMetric))
                    : "-"
                }</div>
{/* --- ADDED CURRENT METRIC --- */}
<div style="color:#6b7280;margin-top:3px;font-size:11px;"><strong>${escapeHtml(
                  t("reports.master.currentLabel", "Current")
                )}:</strong> ${
                  activity.currentMetric
                    ? escapeHtml(JSON.stringify(activity.currentMetric))
                    : "-"
                }</div>
<div style="color:#6b7280;margin-top:3px;font-size:11px;"><strong>${escapeHtml(
                  t("reports.master.previousLabel", "Previous")
                )}:</strong> ${
                  activity.previousMetric
                    ? escapeHtml(JSON.stringify(activity.previousMetric))
                    : "-"
                }</div>
<div style="color:#6b7280;margin-top:3px;font-size:11px;"><strong>${escapeHtml(
                  t("reports.master.quarterlyGoals", "Quarterly Goals")
                )}:</strong> ${
                  activity.quarterlyGoals
                    ? escapeHtml(JSON.stringify(activity.quarterlyGoals))
                    : "-"
                }</div>
<div style="margin-top:6px">${(activity.reports || [])
                  .map(
                    (r) =>
                      `<div style="padding:4px;border-top:1px dashed #eee"><strong>#${escapeHtml(
                        String(r.id)
                      )}</strong> • ${escapeHtml(String(r.status || "—"))} • ${
                        r.createdAt
                          ? escapeHtml(new Date(r.createdAt).toLocaleString())
                          : ""
                      }<div class="narrative" style="margin-top:4px">${escapeHtml(
                        r.narrative || ""
                      )}</div></div>`
                  )
                  .join("")}</div>
</div>
`;
              })
              .join("")}
</div>
`;
          })
          .join("")}
</div>
</div>
`;
      })
      .join("");
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:Inter,Arial,Helvetica,sans-serif;padding:16px;color:#111;background:#fff}
h1{font-size:20px;margin-bottom:3px}
h2{font-size:14px;color:#374151}
table{width:100%;border-collapse:collapse;margin-top:10px}
th,td{border:1px solid #ddd;padding:6px;font-size:12px;vertical-align:top}
th{background:#f3f4f6}
.goal-row td{background:#eef2ff}
.task-row td{background:#f8fafc}
.narrative { white-space: pre-wrap; line-height:1.4; padding:8px; background:#fff; border-radius:4px; border:1px solid #eee; }
{/* --- POLISHED PRINT STYLES (WITH PAGE BREAKS) --- */}
@media print {
body {
-webkit-print-color-adjust: exact;
background: #ffffff !important;
}
/* Force all text to black and backgrounds to white, remove shadows */
* {
color: #000000 !important;
background: #ffffff !important;
text-shadow: none !important;
box-shadow: none !important;
border-color: #ddd !important; /* Default border color */
}
table {
width: 100%;
border-collapse: collapse;
table-layout: auto; /* Allow table to be 100% */
}
th, td {
border: 1px solid #999 !important; /* Ensure table borders are visible */
white-space: nowrap; /* Prevent ugly wrapping in table cells */
}
th {
border-bottom: 2px solid #000 !important; /* Heavier border for table header */
}
/* Page break hints */
section {
page-break-after: always; /* Try to put table on new page */
}
section:last-of-type {
page-break-after: auto; /* Don't add blank page at end */
}
.print-goal-narrative,
tr {
page-break-inside: avoid !important; /* Don't split narrative blocks or table rows */
}
.narrative {
border: 1px dashed #999 !important;
page-break-inside: avoid;
}
/* Differentiate goal narrative sections with a solid border */
.print-goal-narrative {
border: 2px solid #000 !important;
padding: 8px;
margin-top: 10px;
}
}
</style>
</head>
<body>
<p style="margin-top:2px;margin-bottom:6px">${escapeHtml(
      groupLabel
    )}: ${escapeHtml(String(groupSearchTerm || "All"))} • ${escapeHtml(
      generated
    )}</p>
<section>
<h2>${escapeHtml(narratives)}</h2>
${narrativesHtml}
</section>
<section style="margin-top:14px">
<h2>${escapeHtml(dataTable)}</h2>
<table>
<thead><tr><th>${escapeHtml(t("reports.table.title"))}</th><th>${escapeHtml(
      t("reports.table.weight")
    )}</th><th>${escapeHtml(t("reports.table.metric"))}</th><th>${escapeHtml(
      t("reports.table.target")
    )}</th><th>${escapeHtml(
      t("reports.table.previous", "Previous")
    )}</th><th>${escapeHtml(
      t("reports.table.yearlyProgress", "Yearly Progress %") /* ADDED */
    )}</th>${columnsHtml}</tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
</section>
</body>
</html>`;
  }

  function exportCSV() {
    if (!master) return alert(t("reports.master.loadFirstAlert"));
    const periods = periodColumns;
    // --- NEW: Dynamic headers for CSV ---
    const periodHeaders = [];
    if (granularity === "quarterly") {
      periods.forEach(p => {
        const label = fmtQuarterKey(p);
        periodHeaders.push(`${t("reports.table.qGoal", "Goal")} (${label})`);
        periodHeaders.push(`${t("reports.table.qRecord", "Record")} (${label})`);
        // MODIFIED: Header label
        periodHeaders.push(`${t("reports.table.qProgress", "Progress %")} (${label})`);
      });
    } else {
      periods.forEach(p => {
        periodHeaders.push(granularity === "monthly" ? fmtMonthKey(p) : p);
      });
    }
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
      t("reports.table.yearlyProgress", "Yearly Progress %"), // ADDED
      ...periodHeaders,
    ];
    const rows = [];
    // MODIFIED: Added 1 more empty cell for Yearly Progress
    const emptyPeriodCells = periodHeaders.map(() => "");
    const emptyGoalTaskRow = ["", "", "", "", "", ...emptyPeriodCells];
    master.goals.forEach((g, goalIndex) => {
      const goalNum = `${goalIndex + 1}`;
      rows.push([
        goalNum, g.title, "", "", "", "", g.weight ?? "", "", "", "",
        ...emptyGoalTaskRow,
      ]);
      (g.tasks || []).forEach((task, taskIndex) => {
        const taskNum = `${goalNum}.${taskIndex + 1}`;
        rows.push([
          "", "", taskNum, task.title, "", "", task.weight ?? "", "", "", "",
          ...emptyGoalTaskRow,
        ]);
        (task.activities || []).forEach((a, activityIndex) => {
          const activityNum = `${taskNum}.${activityIndex + 1}`;
          const mk = pickMetricForActivity(a, null);
          const { targetVal, prevVal, currentVal } = getOverallMetrics(a, mk); // MODIFIED
          // Calculate Yearly Progress
          const targetNum = toNumberOrNull(targetVal);
          const currentNum = toNumberOrNull(currentVal);
          let yearlyProgressPct = null;
          if (targetNum !== null && currentNum !== null) {
            if (targetNum > 0) yearlyProgressPct = (currentNum / targetNum) * 100;
            else if (targetNum === 0) yearlyProgressPct = (currentNum > 0) ? 100.0 : 0.0;
          }
          const displayYearlyProgress = yearlyProgressPct === null ? '' : `${yearlyProgressPct.toFixed(2)}%`;
          // End Yearly Progress
          const periodVals = [];
          if (granularity === "quarterly") {
            periods.forEach(p => {
              // MODIFIED: 'variance' is now 'progress'
              const { goal, record, progress } = getQuarterlyStats(a, p, mk);
              // MODIFIED: Format as percentage string
              const displayProgress = progress === null ? "" : `${progress.toFixed(2)}%`;
              periodVals.push(goal ?? "");
              periodVals.push(record ?? "");
              periodVals.push(displayProgress);
            });
          } else {
            periods.forEach(p => {
              const v = getLatestMetricValueInPeriod(a, p, granularity, mk);
              if (v === null || v === undefined) {
                periodVals.push("");
                return;
              }
              if (typeof v === "object") {
                const k = Object.keys(v || {})[0];
                if (k) periodVals.push(String(v[k]));
                else periodVals.push(JSON.stringify(v));
              } else {
                periodVals.push(String(v));
              }
            });
          }
          rows.push([
            "", "", "", "", activityNum, a.title, a.weight ?? "", mk ?? "", targetVal ?? "", prevVal ?? "",
            displayYearlyProgress, // ADDED
            ...periodVals,
          ]);
        });
      });
    });
    const csv = [headers, ...rows]
      .map((r) =>
        r
          .map((cell) => {
            if (cell === null || cell === undefined) return "";
            const s = String(cell).replace(/"/g, '""');
            return `"${s}"`;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `master_report_${granularity}_${groupId || "all"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
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
                <div className="text-sm text-[var(--error)] dark:text-red-400 mt-2 animate-pulse">
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
                {t("reports.master.exportPDF")}
              </button>
              <button
                onClick={exportCSV}
                className="px-4 py-2.5 bg-purple-600 dark:bg-purple-900 text-[var(--on-tertiary-container)] dark:text-purple-200 rounded-full hover:bg-purple-300 dark:hover:bg-purple-800 transition-all duration-300 surface-elevation-1 flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                {t("reports.master.exportCSV")}
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
            <div className="ml-auto text-sm text-gray-600 dark:text-gray-400">
              {t("reports.master.periodColumns", {
                count: periodColumns.length,
                granularity,
              })}
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
                    <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-white">
                      {t("reports.table.title")}
                    </th>
                    <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-4 py-3 text-sm font-medium text-gray-600 dark:text-white">
                      {t("reports.table.weight")}
                    </th>
                    <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-4 py-3 text-sm font-medium text-gray-600 dark:text-white">
                      {t("reports.table.metric")}
                    </th>
                    <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-4 py-3 text-sm font-medium text-gray-600 dark:text-white">
                      {t("reports.table.target")}
                    </th>
                    <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-4 py-3 text-sm font-medium text-gray-600 dark:text-white">
                      {t("reports.table.previous", "Previous")}
                    </th>
                    {/* ADDED: Yearly Progress % Header */}
                    <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-4 py-3 text-sm font-medium text-gray-600 dark:text-white">
                      {t("reports.table.yearlyProgress", "Yearly Progress %")}
                    </th>
                    {/* --- Dynamic Headers for Quarterly/Monthly/Annual --- */}
                    {granularity === "quarterly" ? periodColumns.map(p => {
                      const label = fmtQuarterKey(p);
                      return (
                        <React.Fragment key={p}>
                          <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-4 py-3 text-sm font-medium text-gray-600 dark:text-white">
                            {t("reports.table.qGoal", "Goal")} ({label})
                          </th>
                          <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-4 py-3 text-sm font-medium text-gray-600 dark:text-white">
                            {t("reports.table.qRecord", "Record")} ({label})
                          </th>
                          <th className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-4 py-3 text-sm font-medium text-gray-600 dark:text-white">
                            {t("reports.table.qProgress", "Progress %")} ({label})
                          </th>
                        </React.Fragment>
                      );
                    }) : periodColumns.map((p) => (
                      <th
                        key={p}
                        className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-4 py-3 text-sm font-medium text-gray-600 dark:text-white"
                      >
                        {granularity === "monthly" ? fmtMonthKey(p) : p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--outline-variant)] dark:divide-gray-600 bg-gray-100 dark:bg-gray-700">
                  {tableRows.map((row, index) => {
                    if (row.type === "goal" || row.type === "task") {
                      const numEmptyCols = granularity === 'quarterly' ? periodColumns.length * 3 : periodColumns.length;
                      return (
                        <tr
                          key={row.id}
                          className={`${row.type === 'goal' ? 'bg-[var(--primary-container)]/[0.1] dark:bg-gray-900/[0.15]' : 'bg-gray-100 dark:bg-gray-700'} transition-all duration-300`}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <td className={`border-b border-[var(--outline-variant)] dark:border-gray-600 px-4 py-3 font-medium text-gray-600 dark:text-white text-sm ${row.type === 'task' ? 'pl-6' : ''}`}>
                            {`${row.number}. ${row.title}`}
                          </td>
                          <td className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-4 py-3 text-gray-600 dark:text-white text-sm">
                            {row.weight}
                          </td>
                          <td className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-4 py-3 text-gray-600 dark:text-white text-sm">
                            —
                          </td>
                          <td className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-4 py-3 text-gray-600 dark:text-white text-sm">
                            —
                          </td>
                          <td className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-4 py-3 text-gray-600 dark:text-white text-sm">
                            —
                          </td>
                          {/* ADDED: Empty cell for Yearly Progress */}
                          <td className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-4 py-3 text-gray-600 dark:text-white text-sm">
                            —
                          </td>
                          {Array(numEmptyCols).fill(0).map((_, i) => (
                            <td
                              key={i}
                              className="border-b border-[var(--outline-variant)] dark:border-gray-600 px-4 py-3 text-gray-600 dark:text-white text-sm"
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
* Master report helpers & table row
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
  const tryDate = new Date(rawKey);
  if (!isNaN(tryDate)) {
    const y = tryDate.getFullYear();
    const m = String(tryDate.getMonth() + 1).padStart(2, "0");
    if (granularity === "monthly") return `${y}-${m}`;
    if (granularity === "quarterly")
      return `${y}-Q${Math.floor(tryDate.getMonth() / 3) + 1}`;
    return String(y);
  }
  const parts = String(rawKey).split("-");
  if (granularity === "monthly") {
    if (parts.length >= 2) {
      const y = parts[0];
      const m = String(Number(parts[1])).padStart(2, "0");
      return `${y}-${m}`;
    }
    return rawKey;
  }
  if (granularity === "quarterly") {
    if (rawKey.includes("-Q")) return rawKey;
    if (parts.length >= 2) {
      const y = parts[0];
      const m = Number(parts[1]);
      const q = Math.floor((m - 1) / 3) + 1;
      return `${y}-Q${q}`;
    }
    return rawKey;
  }
  if (parts.length >= 1) return parts[0];
  return rawKey;
}

function fmtMonthKey(dateKey) {
  if (!dateKey) return "";
  const [yPart, mPart] = String(dateKey).split("-");
  if (!mPart) return dateKey;
  const y = Number(yPart);
  const m = Number(mPart);
  if (isNaN(y) || isNaN(m)) return dateKey;
  return new Date(y, m - 1, 1).toLocaleString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function fmtQuarterKey(q) {
  if (!q) return q;
  const [y, qn] = String(q).split("-Q");
  if (!qn) return q;
  return `Q${qn} ${y}`;
}

function flattenPeriods(masterJson, granularity) {
  const set = new Set();
  (masterJson?.goals || []).forEach((g) => {
    (g.tasks || []).forEach((task) => {
      (task.activities || []).forEach((a) => {
        const hist = a.history?.[granularity] || {};
        Object.keys(hist || {}).forEach((rawKey) => {
          const normalized = normalizePeriodKey(rawKey, granularity);
          if (normalized) set.add(normalized);
        });
        // ALSO add periods from quarterlyGoals if they don't have history
        if (granularity === "quarterly" && a.quarterlyGoals) {
          const qGoals = safeParseJson(a.quarterlyGoals);
          if (qGoals) {
            Object.keys(qGoals).forEach(qKey => { // q1, q2
              // We need a year. Assume current year for now if history is empty?
              // This is tricky. Let's rely on history *for now*.
              // A better approach would be to get year from goal/task.
            });
          }
        }
      });
    });
  });
  const arr = Array.from(set);
  arr.sort((A, B) => {
    if (granularity === "monthly") {
      const [yA, mA] = A.split("-").map(Number);
      const [yB, mB] = B.split("-").map(Number);
      return yA !== yB ? yA - yB : mA - mB;
    } else if (granularity === "quarterly") {
      const [yA, qA] = A.split("-Q").map(Number);
      const [yB, qB] = B.split("-Q").map(Number);
      return yA !== yB ? yA - yB : qA - qB;
    } else {
      return Number(A) - Number(B);
    }
  });
  return arr;
}

function pickMetricForActivity(activity, metricKey) {
  if (metricKey) return metricKey;
  const tg = safeParseJson(activity.targetMetric) || {};
  const tgKeys = Object.keys(tg);
  if (tgKeys.length) return tgKeys[0];
  const cur = safeParseJson(activity.currentMetric) || {};
  const curKeys = Object.keys(cur);
  if (curKeys.length) return curKeys[0];
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

function parseNumberForPct(x) {
  return toNumberOrNull(x); // Use updated helper
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
  candidateReports.sort((a, b) => {
    const da = a && a.date ? new Date(a.date) : (a && a.createdAt ? new Date(a.createdAt) : null);
    const db = b && b.date ? new Date(b.date) : (b && b.createdAt ? new Date(b.createdAt) : null);
    if (!da && !db) return 0;
    if (!da) return -1;
    if (!db) return 1;
    return da - db;
  });
  for (let i = candidateReports.length - 1; i >= 0; i--) {
    const r = candidateReports[i];
    if (!r || !r.metrics) continue;
    const v = extractMetricValue(r.metrics, metricKey);
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

// Helper to get Goal, Record, Progress %
// ---
// MODIFIED: This function now calculates progress as a percentage.
// ---
function getQuarterlyStats(activity, periodKey, metricKey) {
  const qKey = String(periodKey).split('-Q')[1]; // e.g., "1" from "2024-Q1"
  if (!qKey) return { goal: null, record: null, progress: null };
  const qGoals = safeParseJson(activity.quarterlyGoals);
  const goal = qGoals ? toNumberOrNull(qGoals[`q${qKey}`]) : null;
  const recordRaw = getLatestMetricValueInPeriod(activity, periodKey, 'quarterly', metricKey);
  const record = toNumberOrNull(recordRaw);
  let progress_pct = null;
  if (record !== null && goal !== null) {
    if (goal > 0) {
      // Standard percentage calculation
      progress_pct = (record / goal) * 100;
    } else if (goal === 0) {
      progress_pct = (record > 0) ? 100.0 : 0.0; // If goal is 0, any record > 0 is 100% progress
    }
  }
  return { goal, record, progress: progress_pct }; // 'progress' key now holds the percentage
}

// Helper to get overall Target, Previous, and Current
// MODIFIED: Now returns 'currentVal'
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

/* ActivityRow updated: compact columns & percent/value toggle */
function ActivityRow({
  activity,
  periods,
  granularity,
  number,
  index,
  t,
  darkMode = false,
}) {
  const metricKey = pickMetricForActivity(activity, null);
  // MODIFIED: Get currentVal as well
  const { targetVal, prevVal, currentVal } = getOverallMetrics(activity, metricKey);
  // ADDED: Calculate Yearly Progress
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
      <td className={`border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-4 py-3 text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-600'} pl-5`}>
        <div>{`${number} ${activity.title}`}</div>
      </td>
      <td className={`border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-4 py-3 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 text-center w-16`}>
        <div>{activity.weight ?? "-"}</div>
      </td>
      <td className={`border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-4 py-3 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 text-center w-20`}>
        <div>{metricKey ?? "-"}</div>
      </td>
      <td className={`border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-4 py-3 text-sm text-[var(--on-surface-variant)] dark:text-gray-300 text-right w-24 font-mono`}>
        <div>{typeof targetVal === 'number' ? targetVal.toLocaleString() : targetVal ?? "-"}</div>
      </td>
      <td className={`border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-4 py-3 text-sm text-[var(--on-surface-variant)] dark:text-gray-300 text-right w-24 font-mono`}>
        <div>{typeof prevVal === 'number' ? prevVal.toLocaleString() : prevVal ?? "-"}</div>
      </td>
      {/* ADDED: Yearly Progress % Cell */}
      <td className={`border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-4 py-3 text-sm text-[var(--on-surface-variant)] dark:text-gray-300 text-right w-24 font-mono`}>
        <div>{displayYearlyProgress}</div>
      </td>
      {/* --- NEW: Dynamic Cells for Quarterly --- */}
      {granularity === "quarterly" ? periods.map(p => {
        // MODIFIED: 'variance' is now 'progress'
        const { goal, record, progress } = getQuarterlyStats(activity, p, metricKey);
        // MODIFIED: Format as percentage string
        const displayProgress = progress === null ? '-' : `${progress.toFixed(2)}%`;
        return (
          <React.Fragment key={p}>
            <td className={`border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-3 py-3 text-sm text-[var(--on-surface-variant)] ${darkMode ? 'text-gray-300' : 'text-[var(--on-surface-variant)]'} text-right w-20 font-mono`}>
              <div>{typeof goal === 'number' ? goal.toLocaleString() : goal ?? '-'}</div>
            </td>
            <td className={`border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-3 py-3 text-sm text-[var(--on-surface-variant)] ${darkMode ? 'text-gray-300' : 'text-[var(--on-surface-variant)]'} text-right w-20 font-mono`}>
              <div>{typeof record === 'number' ? record.toLocaleString() : record ?? '-'}</div>
            </td>
            {/* MODIFIED: Display formatted percentage, removed color */}
            <td className={`border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-3 py-3 text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-600'} text-right w-20 font-mono`}>
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
            className={`border-b ${darkMode ? 'border-gray-600' : 'border-[var(--outline-variant)]'} px-3 py-3 text-sm ${darkMode ? 'text-gray-300' : 'text-[var(--on-surface-variant)]'} text-right w-20`}
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
export default App;