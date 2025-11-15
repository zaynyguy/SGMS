import React, { useState, useEffect, useMemo } from "react";
import { Loader } from "lucide-react";
import { fetchMasterReport } from "../api/reports";
import { useTranslation } from "react-i18next";
import { fetchGroups } from "../api/groups";

/* -------------------------
* Master Report page wrapper
* MODIFIED:
* - Added "Yearly Progress %" column (Current / Target * 100).
* - Renamed quarterly "Variance %" to "Progress %".
* - Updated 'getQuarterlyStats' to calculate progress: (Record / Goal) * 100.
* - Updated 'getOverallMetrics' to also return 'currentVal'.
* - Print and CSV exports updated to reflect both changes.
* ------------------------- */
export default function MasterReportPageWrapper() {
  const { t } = useTranslation();

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
    <div className="bg-white dark:bg-gray-800 p-3 md:p-4 lg:p-5 rounded-lg shadow border border-gray-200 dark:border-gray-700 transition-all duration-500 ease-out">
      <div className="flex items-center gap-3 mb-4 transition-all duration-500">
        <div className="text-sky-600 dark:text-sky-300 bg-gray-200 dark:bg-gray-900 p-2 rounded transition-all duration-500 transform hover:scale-110 hover:rotate-6">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className="transition-all duration-500"
          >
            <path
              d="M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 11h7v6H3z"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="transition-all duration-500">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 transition-all duration-500 transform">
            {t("reports.master.title")}
          </h2>
          <div className="text-xs text-gray-500 dark:text-gray-300 transition-all duration-700">
            {t("reports.master.subtitle")}
          </div>
        </div>
      </div>

      {/* --- UPDATED GROUP <select> DROPDOWN --- */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4 transition-all duration-500">
        <div className="md:col-span-3 transition-all duration-500">
          <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1 transition-all duration-300">
            {t("reports.master.groupSearchLabel", "Select Group")}
          </label>
          <select
            value={groupId}
            onChange={handleGroupSelectChange}
            className="w-full px-2 py-1.5 rounded border bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-sky-500 focus:border-transparent transition-all duration-300 transform hover:scale-105"
          >
            <option value="">
              {t("reports.master.allGroups", "All Groups")}
            </option>
            {allGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 mt-1.5 transition-all duration-500 transform hover:scale-105 animate-pulse">
              {error}
            </div>
          )}
          {groupLoadError && (
            <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1.5 transition-all duration-500 transform hover:scale-105">
              {groupLoadError}
            </div>
          )}
        </div>

        <div className="md:col-span-2 flex flex-col sm:flex-row gap-1.5 items-stretch sm:items-end transition-all duration-500">
          <button
            onClick={handleFetch}
            disabled={loading}
            className="px-3 py-1.5 bg-sky-600 text-white rounded shadow flex items-center justify-center gap-1.5 hover:bg-sky-700 transition-all duration-300 transform hover:scale-105 active:scale-95 hover:shadow-lg text-xs"
          >
            {loading ? (
              <Loader
                className={`h-3.5 w-3.5 animate-spin transition-all duration-500 ${isRefreshing ? "scale-125" : "scale-100"
                  }`}
              />
            ) : (
              t("reports.master.loadButton")
            )}
          </button>
          <button
            onClick={exportPDF}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-all duration-300 transform hover:scale-105 active:scale-95 hover:shadow-lg text-xs"
          >
            {t("reports.master.exportPDF")}
          </button>
          <button
            onClick={exportCSV}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105 active:scale-95 hover:shadow-lg text-xs"
          >
            {t("reports.master.exportCSV")}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3 transition-all duration-500">
        <div className="transition-all duration-500">
          <label className="text-xs text-gray-600 dark:text-gray-300 transition-all duration-300">
            {t("reports.master.granularityLabel")}
          </label>
          <div className="flex gap-1.5 mt-1 transition-all duration-500">
            {["monthly", "quarterly", "annual"].map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`px-2 py-1 rounded transition-all duration-300 transform hover:scale-110 active:scale-95 text-xs ${granularity === g
                    ? "bg-sky-600 text-white shadow scale-105"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:shadow"
                  }`}
              >
                {t(`reports.master.granularities.${g}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto text-xs text-gray-500 dark:text-gray-400 transition-all duration-500 transform hover:scale-105">
          {t("reports.master.periodColumns", {
            count: periodColumns.length,
            granularity,
          })}
        </div>
      </div>

      <div className="mb-4 transition-all duration-500">
        <h3 className="text-lg md:text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100 transition-all duration-500 transform">
          {t("reports.master.narrativesTitle")}
        </h3>
        {!master && (
          <div className="text-xs text-gray-500 dark:text-gray-400 transition-all duration-500">
            {t("reports.master.noData")}
          </div>
        )}
        {master && master.goals && master.goals.length === 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400 transition-all duration-500">
            {t("reports.master.noGoals")}
          </div>
        )}
        {master && master.goals && master.goals.length > 0 && (
          <div className="space-y-3 transition-all duration-500">
            {master.goals.map((g, goalIndex) => {
              const goalNum = `${goalIndex + 1}`;
              return (
                <div
                  key={g.id}
                  className="p-3 border rounded bg-gray-50 dark:bg-gray-900 transition-all duration-500 ease-out transform"
                  style={{
                    animationDelay: `${goalIndex * 100}ms`,
                    transitionDelay: `${goalIndex * 50}ms`,
                  }}
                >
                  <div className="flex items-center justify-between transition-all duration-300">
                    <div className="transition-all duration-500">
                      <div className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 transition-all duration-300">{`${goalNum}. ${g.title}`}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-300 mt-0.5 transition-all duration-500">
                        {g.status} • {g.progress ?? 0}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pl-2 space-y-2 transition-all duration-500">
                    {(g.tasks || []).map((task, taskIndex) => {
                      const taskNum = `${goalNum}.${taskIndex + 1}`;
                      return (
                        <div
                          key={task.id}
                          className="transition-all duration-500 transform"
                        >
                          <div className="text-base font-semibold text-gray-800 dark:text-gray-100 transition-all duration-300">
                            {`${taskNum}. ${task.title}`}{" "}
                            <span className="text-xs text-gray-400 transition-all duration-500">
                              ({task.progress ?? 0}%)
                            </span>
                          </div>
                          <div className="pl-2 mt-2 space-y-2 transition-all duration-500">
                            {(task.activities || []).map((a, activityIndex) => {
                              const activityNum = `${taskNum}.${activityIndex + 1
                                }`;
                              return (
                                <div
                                  key={a.id}
                                  className="p-2 bg-white dark:bg-gray-800 rounded border transition-all duration-500 ease-out transform"
                                  style={{
                                    animationDelay: `${activityIndex * 80}ms`,
                                    transitionDelay: `${activityIndex * 40}ms`,
                                  }}
                                >
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-1.5 transition-all duration-300">
                                    <div className="transition-all duration-500">
                                      <div className="text-xs md:text-base font-medium text-gray-800 dark:text-gray-100 transition-all duration-300">{`${activityNum}. ${a.title}`}</div>
                                      <div className="text-xs text-gray-500 dark:text-gray-300 mt-0.5 transition-all duration-500">
                                        {t("reports.master.targetText")}:{" "}
                                        <span className="font-medium text-gray-800 dark:text-gray-100 transition-all duration-300">
                                          {a.targetMetric ? "" : "-"}
                                        </span>
                                      </div>
                                      <div className="mt-1.5 transition-all duration-500">
                                        {a.targetMetric
                                          ? renderMetricsList(a.targetMetric)
                                          : null}
                                      </div>

                                      {/* --- ADDED CURRENT METRIC --- */}
                                      <div className="text-xs text-gray-500 dark:text-gray-300 mt-1.5 transition-all duration-500">
                                        {t("reports.master.currentLabel", "Current")}:{" "}
                                        <span className="font-medium text-gray-800 dark:text-gray-100 transition-all duration-300">
                                          {a.currentMetric ? "" : "-"}
                                        </span>
                                      </div>
                                      <div className="mt-1.5 transition-all duration-500">
                                        {a.currentMetric
                                          ? renderMetricsList(a.currentMetric)
                                          : null}
                                      </div>

                                      {/* --- ADDED PREVIOUS METRIC --- */}
                                      <div className="text-xs text-gray-500 dark:text-gray-300 mt-1.5 transition-all duration-500">
                                        {t(
                                          "reports.master.previousText",
                                          "Previous"
                                        )}
                                        :{" "}
                                        <span className="font-medium text-gray-800 dark:text-gray-100 transition-all duration-300">
                                          {a.previousMetric ? "" : "-"}
                                        </span>
                                      </div>
                                      <div className="mt-1.5 transition-all duration-500">
                                        {a.previousMetric
                                          ? renderMetricsList(a.previousMetric)
                                          : null}
                                      </div>
                                      {/* --- ADDED QUARTERLY GOALS --- */}
                                      <div className="text-xs text-gray-500 dark:text-gray-300 mt-1.5 transition-all duration-500">
                                        {t(
                                          "reports.master.quarterlyGoals",
                                          "Quarterly Goals"
                                        )}
                                        :{" "}
                                        <span className="font-medium text-gray-800 dark:text-gray-100 transition-all duration-300">
                                          {a.quarterlyGoals ? "" : "-"}
                                        </span>
                                      </div>
                                      <div className="mt-1.5 transition-all duration-500">
                                        {a.quarterlyGoals
                                          ? renderMetricsList(a.quarterlyGoals)
                                          : null}
                                      </div>
                                      {/* --- END QUARTERLY GOALS --- */}
                                    </div>
                                    <div className="text-xs text-gray-400 transition-all duration-500 transform">
                                      {a.status} •{" "}
                                      {a.isDone
                                        ? t("reports.master.done")
                                        : t("reports.master.open")}
                                    </div>
                                  </div>

                                  <div className="mt-2 space-y-1.5 transition-all duration-500">
                                    {(a.reports || []).length === 0 ? (
                                      <div className="text-xs text-gray-400 transition-all duration-500">
                                        {t("reports.master.noReports")}
                                      </div>
                                    ) : (
                                      (a.reports || []).map(
                                        (r, reportIndex) => (
                                          <div
                                            key={r.id}
                                            className="text-xs border rounded p-1.5 bg-gray-50 dark:bg-gray-900 transition-all duration-500 ease-out transform"
                                            style={{
                                              animationDelay: `${reportIndex * 60
                                                }ms`,
                                              transitionDelay: `${reportIndex * 30
                                                }ms`,
                                            }}
                                          >
                                            <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 transition-all duration-300">
                                              <div className="text-xs font-medium text-gray-800 dark:text-gray-100 transition-all duration-500 transform">
                                                #{r.id} •{" "}
                                                <span className="text-gray-600 dark:text-gray-300 transition-all duration-500">
                                                  {r.status}
                                                </span>
                                              </div>
                                              <div className="text-xs text-gray-400 transition-all duration-500 transform">
                                                {r.createdAt
                                                  ? new Date(
                                                    r.createdAt
                                                  ).toLocaleString()
                                                  : ""}
                                              </div>
                                            </div>
                                            <div className="mt-0.5 text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap transition-all duration-500">
                                              {r.narrative || (
                                                <em className="text-gray-400 transition-all duration-500">
                                                  {t("reports.noNarrative")}
                                                </em>
                                              )}
                                            </div>
                                            {r.metrics && (
                                              <div className="mt-1.5 transition-all duration-500">
                                                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 transition-all duration-300">
                                                  {t(
                                                    "reports.metrics.title",
                                                    "Metrics"
                                                  )}
                                                </div>
                                                <div className="mt-0.5 transition-all duration-500">
                                                  {renderMetricsList(r.metrics)}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )
                                      )
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

      {/* --- THIS SECTION HANDLES THE ON-SCREEN HORIZONTAL SCROLLING --- */}
      <div className="transition-all duration-500">
        <h3 className="text-lg md:text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100 transition-all duration-500 transform">
          {t("reports.table.titleFull")}
        </h3>

        <div className="overflow-auto border rounded transition-all duration-500 transform">
          <table className="min-w-full transition-all duration-500">
            <thead className="transition-all duration-500">
              <tr className="transition-all duration-500">
                <th className="border px-2 py-2 text-left text-xs text-gray-900 dark:text-gray-100 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  {t("reports.table.title")}
                </th>
                <th className="border px-2 py-2 text-xs text-gray-900 dark:text-gray-100 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  {t("reports.table.weight")}
                </th>
                <th className="border px-2 py-2 text-xs text-gray-900 dark:text-gray-100 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  {t("reports.table.metric")}
                </th>
                <th className="border px-2 py-2 text-xs text-gray-900 dark:text-gray-100 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  {t("reports.table.target")}
                </th>
                <th className="border px-2 py-2 text-xs text-gray-900 dark:text-gray-100 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  {t("reports.table.previous", "Previous")}
                </th>
                {/* ADDED: Yearly Progress % Header */}
                <th className="border px-2 py-2 text-xs text-gray-900 dark:text-gray-100 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  {t("reports.table.yearlyProgress", "Yearly Progress %")}
                </th>
                {/* --- NEW: Dynamic Headers for Quarterly --- */}
                {granularity === "quarterly" ? periodColumns.map(p => {
                  const label = fmtQuarterKey(p);
                  return (
                    <React.Fragment key={p}>
                      <th className="border px-2 py-2 text-xs text-gray-900 dark:text-gray-100 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                        {t("reports.table.qGoal", "Goal")} ({label})
                      </th>
                      <th className="border px-2 py-2 text-xs text-gray-900 dark:text-gray-100 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                        {t("reports.table.qRecord", "Record")} ({label})
                      </th>
                      {/* MODIFIED: Header Label */}
                      <th className="border px-2 py-2 text-xs text-gray-900 dark:text-gray-100 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                        {t("reports.table.qProgress", "Progress %")} ({label})
                      </th>
                    </React.Fragment>
                  );
                }) : periodColumns.map((p) => (
                  <th
                    key={p}
                    className="border px-2 py-2 text-xs text-gray-900 dark:text-gray-100 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {granularity === "monthly" ? fmtMonthKey(p) : p}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="transition-all duration-500">
              {tableRows.map((row, index) => {
                if (row.type === "goal" || row.type === "task") {
                  const numEmptyCols = granularity === 'quarterly' ? periodColumns.length * 3 : periodColumns.length;
                  return (
                    <tr
                      key={row.id}
                      className={`${row.type === 'goal' ? 'bg-indigo-50 dark:bg-indigo-900/10' : 'bg-gray-50 dark:bg-gray-900/20'} transition-all duration-500 ease-out transform`}
                      style={{
                        animationDelay: `${index * 50}ms`,
                        transitionDelay: `${index * 30}ms`,
                      }}
                    >
                      <td className={`border px-2 py-2 font-semibold text-gray-900 dark:text-gray-100 transition-all duration-300 ${row.type === 'task' ? 'pl-4' : ''} text-xs`}>{`${row.number}. ${row.title}`}</td>
                      <td className="border px-2 py-2 text-gray-700 dark:text-gray-200 transition-all duration-300 text-xs">
                        {row.weight}
                      </td>
                      <td className="border px-2 py-2 transition-all duration-300 text-xs">
                        —
                      </td>
                      <td className="border px-2 py-2 transition-all duration-300 text-xs">
                        —
                      </td>
                      <td className="border px-2 py-2 transition-all duration-300 text-xs">
                        —
                      </td>
                      {/* ADDED: Empty cell for Yearly Progress */}
                      <td className="border px-2 py-2 transition-all duration-300 text-xs">
                        —
                      </td>
                      {Array(numEmptyCols).fill(0).map((_, i) => (
                        <td
                          key={i}
                          className="border px-2 py-2 transition-all duration-300 text-xs"
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
                    />
                  );
                }
              })}
              {tableRows.length === 0 && (
                <tr className="transition-all duration-500">
                  <td
                    className="p-4 text-center text-gray-500 dark:text-gray-400 transition-all duration-500 text-xs"
                    // MODIFIED: Colspan from 5 to 6
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

      {/* Custom animation styles */}
      <style jsx>{`
@keyframes gentleSlideIn {
from {
opacity: 0;
transform: translateY(20px);
}
to {
opacity: 1;
transform: translateY(0);
}
}

@keyframes pulseGlow {
0%,
100% {
box-shadow: 0 0 5px rgba(14, 165, 233, 0.3);
}
50% {
box-shadow: 0 0 20px rgba(14, 165, 233, 0.6);
}
}

.animate-gentle-slide {
animation: gentleSlideIn 0.6s ease-out both;
}

.animate-pulse-glow {
animation: pulseGlow 2s ease-in-out infinite;
}

/* Enhanced table row animations */
.table-row-animation {
animation: gentleSlideIn 0.5s ease-out both;
}
`}</style>
    </div>
  );
}

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
      className="bg-white dark:bg-gray-800 transition-all duration-500 ease-out transform"
      style={{
        animationDelay: `${index * 60}ms`,
        transitionDelay: `${index * 40}ms`,
      }}
    >
      <td className="border px-2 py-2 text-xs font-medium text-gray-900 dark:text-gray-100 pl-3 min-w-[200px] max-w-[320px] transition-all duration-300">
        <div className="transition-all duration-300">{`${number} ${activity.title}`}</div>
      </td>

      <td className="border px-2 py-2 text-xs text-gray-700 dark:text-gray-200 w-16 text-center transition-all duration-300">
        <div className=" transition-all duration-500">
          {activity.weight ?? "-"}
        </div>
      </td>

      <td className="border px-2 py-2 text-xs text-gray-700 dark:text-gray-200 w-24 text-center transition-all duration-300">
        <div className=" transition-all duration-500">
          {metricKey ?? "-"}
        </div>
      </td>

      <td className="border px-2 py-2 text-xs text-gray-700 dark:text-gray-200 w-28 text-right font-mono transition-all duration-300">
        <div className=" transition-all duration-500 transform">
          {targetVal ?? "-"}
        </div>
      </td>

      <td className="border px-2 py-2 text-xs text-gray-700 dark:text-gray-200 w-28 text-right font-mono transition-all duration-300">
        <div className=" transition-all duration-500 transform">
          {prevVal ?? "-"}
        </div>
      </td>

      {/* ADDED: Yearly Progress % Cell */}
      <td className="border px-2 py-2 text-xs text-gray-700 dark:text-gray-200 w-28 text-right font-mono transition-all duration-300">
        <div className=" transition-all duration-500 transform">
          {displayYearlyProgress}
        </div>
      </td>


      {/* --- NEW: Dynamic Cells for Quarterly --- */}
      {granularity === "quarterly" ? periods.map(p => {
        // MODIFIED: 'variance' is now 'progress'
        const { goal, record, progress } = getQuarterlyStats(activity, p, metricKey);
        // MODIFIED: Format as percentage string
        const displayProgress = progress === null ? '-' : `${progress.toFixed(2)}%`;

        return (
          <React.Fragment key={p}>
            <td className="border px-1.5 py-1.5 text-xs text-gray-700 dark:text-gray-200 text-right w-[80px] font-mono transition-all duration-300">
              <div className="">{goal ?? '-'}</div>
            </td>
            <td className="border px-1.5 py-1.5 text-xs text-gray-700 dark:text-gray-200 text-right w-[80px] font-mono transition-all duration-300">
              <div className="">{record ?? '-'}</div>
            </td>
            {/* MODIFIED: Display formatted percentage, removed color */}
            <td className={`border px-1.5 py-1.5 text-xs text-right w-[80px] font-mono font-medium text-gray-700 dark:text-gray-200 transition-all duration-300`}>
              <div className="">{displayProgress}</div>
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
            className="border px-1.5 py-1.5 text-xs text-gray-700 dark:text-gray-200 text-right w-[80px] transition-all duration-300"
          >
            <div className="min-w-0 transition-all duration-500">
              <div className="text-xs font-mono  transition-all duration-500 transform">
                {display}
              </div>
            </div>
          </td>
        );
      })}
    </tr>
  );
}

/* -------------------------
* Small helper: render metrics nicely (object or JSON)
* ------------------------- */
function renderMetricsList(metrics) {
  if (!metrics)
    return (
      <div className="text-xs text-gray-400 transition-all duration-500">—</div>
    );

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
      <div className="text-xs font-mono break-words p-1.5 bg-white dark:bg-gray-900 rounded border text-gray-800 dark:text-gray-100 transition-all duration-500 transform">
        {s}
      </div>
    );
  }

  if (!obj || typeof obj !== "object") {
    return (
      <div className="text-xs text-gray-400 transition-all duration-500">—</div>
    );
  }
  const keys = Object.keys(obj);
  if (keys.length === 0)
    return (
      <div className="text-xs text-gray-400 transition-all duration-500">—</div>
    );

  return (
    <div className="space-y-0.5 transition-all duration-500">
      {keys.map((k, index) => {
        const value = obj[k];
        const displayValue =
          value !== null && typeof value === "object"
            ? JSON.stringify(value, null, 2)
            : String(value);
        return (
          <div
            key={k}
            className="flex items-start justify-between bg-white dark:bg-gray-900 rounded px-1.5 py-0.5 border dark:border-gray-700 gap-3 transition-all duration-500 ease-out transform"
            style={{
              animationDelay: `${index * 50}ms`,
              transitionDelay: `${index * 25}ms`,
            }}
          >
            <div className="text-xs text-gray-600 dark:text-gray-300 pt-px transition-all duration-300">
              {k}
            </div>
            <div className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all text-right whitespace-pre-wrap transition-all duration-500">
              {displayValue}
            </div>
          </div>
        );
      })}
    </div>
  );
}