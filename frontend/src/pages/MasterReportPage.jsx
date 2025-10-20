import React, { useState, useEffect, useMemo } from "react";
import { Loader, FileText, ChevronRight, User } from "lucide-react";
import { fetchReports, reviewReport, fetchMasterReport } from "../api/reports";
import { useTranslation } from "react-i18next";
import { fetchGroups } from "../api/groups";

/* -------------------------
* Master Report page wrapper
* ------------------------- */
export default function MasterReportPageWrapper() {
const { t } = useTranslation();

const [groupId, setGroupId] = useState("");
const [loading, setLoading] = useState(false);
const [master, setMaster] = useState(null);
const [error, setError] = useState(null);
const [granularity, setGranularity] = useState("quarterly");

  // --- STATE FOR GROUP DROPDOWN ---
  const [groupSearchTerm, setGroupSearchTerm] = useState(t("reports.master.allGroups", "All Groups")); // For print title
  const [allGroups, setAllGroups] = useState([]);
  const [groupLoadError, setGroupLoadError] = useState(null);

  // --- EFFECT TO FETCH GROUPS ---
  useEffect(() => {
    async function loadGroups() {
      try {
        setGroupLoadError(null);
        const groups = await fetchGroups(); //
        setAllGroups(groups || []); // [cite: 779-783]
      } catch (err) {
        console.error("Failed to fetch groups", err);
        setGroupLoadError(t("reports.master.groupLoadFailed", "Failed to load groups list."));
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
return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function handleFetch() {
setLoading(true);
setError(null);
try {
const data = await fetchMasterReport(groupId || undefined);
setMaster(data);
} catch (err) {
if (err && err.status === 401) {
setError("Unauthorized — your session may have expired. Please sign in again.");
setMaster(null);
} else {
setError(err?.message || t("reports.master.fetchFailed"));
setMaster(null);
}
} finally {
setLoading(false);
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
rows.push({ type: "goal", id: `g-${g.id}`, title: g.title, weight: g.weight ?? "-", progress: g.progress ?? "-", goal: g, raw: g, number: goalNum });
(g.tasks || []).forEach((task, taskIndex) => {
const taskNum = `${goalNum}.${taskIndex + 1}`;
rows.push({ type: "task", id: `t-${task.id}`, title: task.title, weight: task.weight ?? "-", progress: task.progress ?? "-", task: task, parentGoal: g, raw: task, number: taskNum });
(task.activities || []).forEach((a, activityIndex) => {
const activityNum = `${taskNum}.${activityIndex + 1}`;
rows.push({ type: "activity", id: `a-${a.id}`, title: a.title, weight: a.weight ?? "-", activity: a, parentTask: task, parentGoal: g, raw: a, number: activityNum });
});
});
});
return rows;
}, [master]);

function generateHtmlForPrint() {
const data = master || { goals: [] };
const periods = periodColumns;
const columnsHtml = periods
.map((p) => {
let label = p;
if (granularity === "monthly") label = fmtMonthKey(p);
if (granularity === "quarterly") label = fmtQuarterKey(p);
return `<th style="padding:8px;border:1px solid #ddd;background:#f3f4f6">${escapeHtml(label)}</th>`;
})
.join("");

const rowsHtml = tableRows
.map((row) => {
const titleWithNumber = `${row.number}. ${row.title}`;
if (row.type === "goal") {
return `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:700">${escapeHtml(titleWithNumber)}</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(String(row.weight))}</td><td style="padding:8px;border:1px solid #ddd">—</td><td style="padding:8px;border:1px solid #ddd">—</td>${periods
.map(() => `<td style="padding:8px;border:1px solid #ddd">—</td>`)
.join("")}</tr>`;
} else if (row.type === "task") {
return `<tr><td style="padding:8px;border:1px solid #ddd;padding-left:20px">${escapeHtml(titleWithNumber)}</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(String(row.weight))}</td><td style="padding:8px;border:1px solid #ddd">—</td><td style="padding:8px;border:1px solid #ddd">—</td>${periods
.map(() => `<td style="padding:8px;border:1px solid #ddd">—</td>`)
.join("")}</tr>`;
} else {
const mk = pickMetricForActivity(row.activity, null);
let targetVal = "";
if (typeof row.activity.targetMetric === "number") targetVal = row.activity.targetMetric;
else if (mk && row.activity.targetMetric && mk in row.activity.targetMetric) targetVal = row.activity.targetMetric[mk];
else if (row.activity.targetMetric && typeof row.activity.targetMetric === "object" && "target" in row.activity.targetMetric)
targetVal = row.activity.targetMetric.target;
const periodCells = periods
.map((p) => {
const v = getLatestMetricValueInPeriod(row.activity, p, granularity, mk);
if (v === null || v === undefined) return `<td style="padding:8px;border:1px solid #ddd">-</td>`;
let dv = v;
if (typeof dv === "object") {
try {
const k = Object.keys(dv || {})[0];
if (k) dv = dv[k];
else dv = JSON.stringify(dv);
} catch (e) {
dv = JSON.stringify(dv);
}
}
return `<td style="padding:8px;border:1px solid #ddd">${escapeHtml(String(dv))}</td>`;
})
.join("");
return `<tr><td style="padding:8px;border:1px solid #ddd;padding-left:34px">${escapeHtml(titleWithNumber)}</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(String(row.weight))}</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(mk ?? "-")}</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(String(targetVal ?? "-"))}</td>${periodCells}</tr>`;
}
})
.join("");

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
<style>
body{font-family:Inter,Arial,Helvetica,sans-serif;padding:20px;color:#111;background:#fff}
h1{font-size:24px;margin-bottom:4px}
h2{font-size:16px;color:#374151}
table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{border:1px solid #ddd;padding:8px;font-size:13px;vertical-align:top}
th{background:#f3f4f6}
.goal-row td{background:#eef2ff}
.task-row td{background:#f8fafc}
.narrative { white-space: pre-wrap; line-height:1.45; padding:10px; background:#fff; border-radius:6px; border:1px solid #eee; }

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
    padding: 10px;
    margin-top: 12px;
  }
}
</style>
</head>
<body>
<p style="margin-top:2px;margin-bottom:8px">${escapeHtml(groupLabel)}: ${escapeHtml(String(groupSearchTerm || "All"))} • ${escapeHtml(generated)}</p>

<section>
<h2>${escapeHtml(narratives)}</h2>
${data.goals
.map(
(g, goalIndex) => {
const goalNum = `${goalIndex + 1}`;
return `
{/* --- ADDED 'print-goal-narrative' CLASS --- */}
<div style="margin-bottom:12px;padding:10px;border:1px solid #eee;border-radius:6px;background:#fbfbfb" class="print-goal-narrative">
<div style="font-weight:700;font-size:15px">${escapeHtml(`${goalNum}. ${g.title}`)} <span style="font-weight:400;color:#6b7280">• ${escapeHtml(
String(g.status || "—")
)} • ${escapeHtml(String(g.progress ?? 0))}% • weight: ${escapeHtml(String(g.weight ?? "-"))}</span></div>
<div style="margin-top:8px;padding-left:8px">
${(g.tasks || [])
.map(
(task, taskIndex) => {
const taskNum = `${goalNum}.${taskIndex + 1}`;
return `
<div style="margin-bottom:8px">
<div style="font-weight:600">${escapeHtml(`${taskNum}. ${task.title}`)} <span style="color:#6b7280">(${escapeHtml(String(task.progress ?? 0))}%) • weight: ${escapeHtml(
String(task.weight ?? "-")
)}</span></div>
${(task.activities || [])
.map(
(activity, activityIndex) => {
const activityNum = `${taskNum}.${activityIndex + 1}`;
return `
<div style="margin-left:16px;margin-top:6px;padding:8px;border:1px solid #f1f5f9;border-radius:4px;background:#fff">
<div style="font-weight:600">${escapeHtml(`${activityNum}. ${activity.title}`)}</div>
<div style="color:#6b7280;margin-top:6px">${escapeHtml(t("reports.master.targetLabel"))}: ${activity.targetMetric ? escapeHtml(JSON.stringify(activity.targetMetric)) : "-"}</div>
<div style="margin-top:8px">${(activity.reports || [])
.map(
(r) =>
`<div style="padding:6px;border-top:1px dashed #eee"><strong>#${escapeHtml(String(r.id))}</strong> • ${escapeHtml(String(r.status || "—"))} • ${
r.createdAt ? escapeHtml(new Date(r.createdAt).toLocaleString()) : ""
}<div class="narrative" style="margin-top:6px">${escapeHtml(r.narrative || "")}</div></div>`
)
.join("")}</div>
</div>
`;
}
)
.join("")}
</div>
`;
}
)
.join("")}
</div>
</div>
`;
}
)
.join("")}
</section>

<section style="margin-top:18px">
<h2>${escapeHtml(dataTable)}</h2>
<table>
<thead><tr><th>${escapeHtml(t("reports.table.title"))}</th><th>${escapeHtml(t("reports.table.weight"))}</th><th>${escapeHtml(t("reports.table.metric"))}</th><th>${escapeHtml(t("reports.table.target"))}</th>${columnsHtml}</tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
</section>

</body>
</html>`;
}

{/* --- REWRITTEN CSV EXPORT FUNCTION (HIERARCHICAL) --- */}
function exportCSV() {
if (!master) return alert(t("reports.master.loadFirstAlert"));
const periods = periodColumns;

  // New headers for the "grouped" style.
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
    ...periods
  ];

const rows = [];
  const emptyPeriodCells = periods.map(() => "");

master.goals.forEach((g, goalIndex) => {
const goalNum = `${goalIndex + 1}`;
    // Add Goal Row
const goalRow = [
      goalNum,
      g.title,
      "", // Task #
      "", // Task
      "", // Activity #
      "", // Activity
      g.weight ?? "",
      "", // Metric
      "", // Target
      ...emptyPeriodCells
    ];
rows.push(goalRow);

(g.tasks || []).forEach((task, taskIndex) => {
const taskNum = `${goalNum}.${taskIndex + 1}`;
      // Add Task Row
const taskRow = [
        "", // Goal #
        "", // Goal
        taskNum,
        task.title,
        "", // Activity #
        "", // Activity
        task.weight ?? "",
        "", // Metric
        "", // Target
        ...emptyPeriodCells
      ];
rows.push(taskRow);

(task.activities || []).forEach((a, activityIndex) => {
const activityNum = `${taskNum}.${activityIndex + 1}`;
const mk = pickMetricForActivity(a, null);
const target = mk && a.targetMetric && mk in a.targetMetric ? a.targetMetric[mk] : a.targetMetric?.target ?? "";
const periodVals = periods.map((p) => {
const v = getLatestMetricValueInPeriod(a, p, granularity, mk);
if (v === null || v === undefined) return "";
if (typeof v === "object") {
const k = Object.keys(v || {})[0];
if (k) return String(v[k]);
return JSON.stringify(v);
}
return String(v);
});

        // Add Activity Row
const actRow = [
          "", // Goal #
          "", // Goal
          "", // Task #
          "", // Task
          activityNum,
          a.title,
          a.weight ?? "",
          mk ?? "",
          target ?? "",
          ...periodVals
        ];
rows.push(actRow);
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
a.download = `master_report_${groupId || "all"}.csv`;
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
} catch (e) {}
}, 400);
}

return (
<div className="bg-white dark:bg-gray-800 p-4 md:p-6 lg:p-7 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
<div className="flex items-center gap-4 mb-5">
<div className="text-sky-600 dark:text-sky-300 bg-gray-200 dark:bg-gray-900 p-3 rounded-lg">
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
<path d="M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 11h7v6H3z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
</svg>
</div>

<div>
<h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-gray-100">{t("reports.master.title")}</h2>
<div className="text-sm text-gray-500 dark:text-gray-300">{t("reports.master.subtitle")}</div>
</div>
</div>

{/* --- UPDATED GROUP <select> DROPDOWN --- */}
<div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-5">
<div className="md:col-span-3">
<label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">{t("reports.master.groupSearchLabel", "Select Group")}</label>
    <select
      value={groupId}
      onChange={handleGroupSelectChange}
      className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
    >
      <option value="">{t("reports.master.allGroups", "All Groups")}</option>
      {allGroups.map(group => (
        <option key={group.id} value={group.id}>
          {group.name}
        </option>
      ))}
    </select>
{error && <div className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</div>}
    {groupLoadError && <div className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">{groupLoadError}</div>}
</div>

<div className="md:col-span-2 flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
<button onClick={handleFetch} disabled={loading} className="px-4 py-2 bg-sky-600 text-white rounded-lg shadow flex items-center justify-center gap-2 hover:bg-sky-700 transition-colors">
{loading ? <Loader className="h-4 w-4 animate-spin" /> : t("reports.master.loadButton")}
</button>
<button onClick={exportPDF} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">{t("reports.master.exportPDF")}</button>
<button onClick={exportCSV} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">{t("reports.master.exportCSV")}</button>
</div>
</div>

<div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
<div>
<label className="text-sm text-gray-600 dark:text-gray-300">{t("reports.master.granularityLabel")}</label>
<div className="flex gap-2 mt-1">
{["monthly", "quarterly", "annual"].map((g) => (
<button key={g} onClick={() => setGranularity(g)} className={`px-3 py-1.5 rounded-lg transition-colors ${granularity === g ?
"bg-sky-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
{t(`reports.master.granularities.${g}`)}
</button>
))}
</div>
</div>

<div className="ml-auto text-sm text-gray-500 dark:text-gray-400">{t("reports.master.periodColumns", { count: periodColumns.length, granularity })}</div>
</div>

<div className="mb-6">
<h3 className="text-xl md:text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">{t("reports.master.narrativesTitle")}</h3>
{!master && <div className="text-sm text-gray-500 dark:text-gray-400">{t("reports.master.noData")}</div>}
{master && master.goals && master.goals.length === 0 && <div className="text-sm text-gray-500 dark:text-gray-400">{t("reports.master.noGoals")}</div>}
{master && master.goals && master.goals.length > 0 && (
<div className="space-y-4">
{master.goals.map((g, goalIndex) => {
const goalNum = `${goalIndex + 1}`;
return (
<div key={g.id} className="p-4 border rounded bg-gray-50 dark:bg-gray-900">
<div className="flex items-center justify-between">
<div>
<div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">{`${goalNum}. ${g.title}`}</div>
<div className="text-sm text-gray-500 dark:text-gray-300 mt-1">{g.status} • {g.progress ?? 0}%</div>
</div>
</div>

<div className="mt-4 pl-3 space-y-3">
{(g.tasks || []).map((task, taskIndex) => {
const taskNum = `${goalNum}.${taskIndex + 1}`;
return (
<div key={task.id}>
<div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
{`${taskNum}. ${task.title}`} <span className="text-sm text-gray-400">({task.progress ?? 0}%)</span>
</div>
<div className="pl-3 mt-3 space-y-3">
{(task.activities || []).map((a, activityIndex) => {
const activityNum = `${taskNum}.${activityIndex + 1}`;
return (
<div key={a.id} className="p-3 bg-white dark:bg-gray-800 rounded border">
<div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
<div>
<div className="text-base md:text-lg font-medium text-gray-800 dark:text-gray-100">{`${activityNum}. ${a.title}`}</div>
<div className="text-sm text-gray-500 dark:text-gray-300 mt-1">{t("reports.master.targetText")}: <span className="font-medium text-gray-800 dark:text-gray-100">{a.targetMetric ? "" : "-"}</span></div>
<div className="mt-2">{a.targetMetric ? renderMetricsList(a.targetMetric) : null}</div>
</div>
<div className="text-sm text-gray-400">{a.status} • {a.isDone ? t("reports.master.done") : t("reports.master.open")}</div>
</div>

<div className="mt-3 space-y-2">
{(a.reports || []).length === 0 ? (
<div className="text-xs text-gray-400">{t("reports.master.noReports")}</div>
) : (
(a.reports || []).map((r) => (
<div key={r.id} className="text-sm border rounded p-2 bg-gray-50 dark:bg-gray-900">
<div className="flex flex-col sm:flex-row sm:justify-between gap-1">
<div className="text-sm font-medium">#{r.id} • <span className="text-gray-600 dark:text-gray-300">{r.status}</span></div>
<div className="text-xs text-gray-400">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</div>
</div>
<div className="mt-1 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{r.narrative || <em className="text-gray-400">{t("reports.noNarrative")}</em>}</div>
{r.metrics && (
<div className="mt-2">
<div className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t("reports.metrics.title", "Metrics")}</div>
<div className="mt-1">{renderMetricsList(r.metrics)}</div>
</div>
)}
</div>
))
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
<div>
<h3 className="text-xl md:text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">{t("reports.table.titleFull")}</h3>

<div className="overflow-auto border rounded">
<table className="min-w-full">
<thead>
<tr>
<th className="border px-3 py-3 text-left text-base text-gray-900 dark:text-gray-100">{t("reports.table.title")}</th>
<th className="border px-3 py-3 text-sm text-gray-900 dark:text-gray-100">{t("reports.table.weight")}</th>
<th className="border px-3 py-3 text-sm text-gray-900 dark:text-gray-100">{t("reports.table.metric")}</th>
<th className="border px-3 py-3 text-sm text-gray-900 dark:text-gray-100">{t("reports.table.target")}</th>
{periodColumns.map((p) => (
<th key={p} className="border px-3 py-3 text-sm text-gray-900 dark:text-gray-100">
{granularity === "monthly" ? fmtMonthKey(p) : granularity === "quarterly" ? fmtQuarterKey(p) : p}
</th>
))}
</tr>
</thead>

<tbody>
{tableRows.map((row) => {
if (row.type === "goal") {
return (
<tr key={row.id} className="bg-indigo-50 dark:bg-indigo-900/10">
<td className="border px-3 py-3 font-semibold text-gray-900 dark:text-gray-100">{`${row.number}. ${row.title}`}</td>
<td className="border px-3 py-3 text-gray-700 dark:text-gray-200">{row.weight}</td>
<td className="border px-3 py-3">—</td>
<td className="border px-3 py-3">—</td>
{periodColumns.map((p) => (
<td key={p} className="border px-3 py-3">—</td>
))}
</tr>
);
} else if (row.type === "task") {
return (
<tr key={row.id} className="bg-gray-50 dark:bg-gray-900/20">
<td className="border px-3 py-3 pl-6 text-gray-900 dark:text-gray-100">{`${row.number}. ${row.title}`}</td>
<td className="border px-3 py-3 text-gray-700 dark:text-gray-200">{row.weight}</td>
<td className="border px-3 py-3">—</td>
<td className="border px-3 py-3">—</td>
{periodColumns.map((p) => (
<td key={p} className="border px-3 py-3">—</td>
))}
</tr>
);
} else {
return <ActivityRow key={row.id} activity={row.activity} periods={periodColumns} granularity={granularity} number={row.number} />;
}
})}
{tableRows.length === 0 && (
<tr>
<td className="p-6 text-center text-gray-500 dark:text-gray-400" colSpan={4 + periodColumns.length}>
{t("reports.table.noData")}
</td>
</tr>
)}
</tbody>
</table>
</div>
</div>
</div>
);
}

/* -------------------------
* Master report helpers & table row
* ------------------------- */

/**
* Normalize period keys returned from backend into canonical monthly/quarterly/annual keys:
* - monthly -> "YYYY-MM" (from any of: "YYYY-M", "YYYY-MM", "YYYY-MM-DD", ISO string)
* - quarterly -> "YYYY-Qn"
* - annual -> "YYYY"
*/
function normalizePeriodKey(rawKey, granularity) {
if (!rawKey) return null;
// if rawKey is a Date-like string "2025-10-01T00:00:00Z" or "2025-10-01"
const tryDate = new Date(rawKey);
if (!isNaN(tryDate)) {
const y = tryDate.getFullYear();
const m = String(tryDate.getMonth() + 1).padStart(2, "0");
if (granularity === "monthly") return `${y}-${m}`;
if (granularity === "quarterly") return `${y}-Q${Math.floor(tryDate.getMonth() / 3) + 1}`;
return String(y);
}

// if `rawKey` already like 'YYYY-M' or 'YYYY-MM'
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
// try parse as 'YYYY-MM' -> convert to quarter
if (parts.length >= 2) {
const y = parts[0];
const m = Number(parts[1]);
const q = Math.floor((m - 1) / 3) + 1;
return `${y}-Q${q}`;
}
return rawKey;
}
// annual
if (parts.length >= 1) return parts[0];
return rawKey;
}

function fmtMonthKey(dateKey) {
if (!dateKey) return "";
// expected canonical 'YYYY-MM' or 'YYYY-MM-DD' or ISO
const [yPart, mPart] = String(dateKey).split("-");
if (!mPart) return dateKey;
const y = Number(yPart);
const m = Number(mPart);
if (isNaN(y) || isNaN(m)) return dateKey;
return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "short", year: "numeric" });
}
function fmtQuarterKey(q) {
const [y, qn] = String(q).split("-Q");
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
const tg = activity.targetMetric || {};
const tgKeys = Object.keys(tg);
if (tgKeys.length) return tgKeys[0];
const curKeys = activity.currentMetric ? Object.keys(activity.currentMetric) : [];
if (curKeys.length) return curKeys[0];
const hist = activity.history || {};
for (const g of ["monthly", "quarterly", "annual"]) {
const periodObj = hist[g] || {};
for (const periodKey of Object.keys(periodObj)) {
const reports = periodObj[periodKey] || [];
for (const r of reports) {
if (r.metrics && typeof r.metrics === "object") {
const keys = Object.keys(r.metrics);
if (keys.length) return keys[0];
}
}
}
}
return null;
}

/* -------------------------
* NEW HELPERS: extraction + parsing
* ------------------------- */

/**
* Extract a sensible primitive metric value from a metrics object for a given metricKey.
*/
function extractMetricValue(metricsObj, metricKey) {
if (!metricsObj) return null;

function unwrapPrimitive(x) {
if (x === null || x === undefined) return x;
if (typeof x !== "object") return x;
const ks = Object.keys(x);
for (const k of ks) {
const v = x[k];
if (v === null || v === undefined) return v;
if (typeof v !== "object") return v;
const innerKs = Object.keys(v || {});
for (const ik of innerKs) {
const iv = v[ik];
if (iv === null || iv === undefined) return iv;
if (typeof iv !== "object") return iv;
}
}
try {
return JSON.stringify(x);
} catch (e) {
return null;
}
}

if (metricKey) {
if (metricsObj.currentMetric && metricKey in metricsObj.currentMetric) {
return unwrapPrimitive(metricsObj.currentMetric[metricKey]);
}
if (metricKey in metricsObj) {
return unwrapPrimitive(metricsObj[metricKey]);
}
if (metricsObj.targetMetric && metricKey in metricsObj.targetMetric) {
return unwrapPrimitive(metricsObj.targetMetric[metricKey]);
}
return null;
}

if (metricsObj.currentMetric && typeof metricsObj.currentMetric === "object") {
const k1 = Object.keys(metricsObj.currentMetric)[0];
if (k1) return unwrapPrimitive(metricsObj.currentMetric[k1]);
}
if (metricsObj.targetMetric && typeof metricsObj.targetMetric === "object") {
const k2 = Object.keys(metricsObj.targetMetric)[0];
if (k2) return unwrapPrimitive(metricsObj.targetMetric[k2]);
}
const topKeys = Object.keys(metricsObj);
if (topKeys.length) return unwrapPrimitive(metricsObj[topKeys[0]]);
return null;
}

/**
* Try to parse a numeric-ish string for percentage calculations.
* Removes commas, whitespace and any non-digit/dot/minus characters (but preserve dot and minus).
*/
function parseNumberForPct(x) {
if (x === null || x === undefined) return NaN;
if (typeof x === "number") return Number(x);
const s = String(x).trim();
if (s === "") return NaN;
const cleaned = s.replace(/[^0-9.\-]/g, "");
if (cleaned === "" || cleaned === "." || cleaned === "-" || cleaned === "-.") return NaN;
const v = Number(cleaned);
return isNaN(v) ? NaN : v;
}

/* -------------------------
* REWRITTEN: reliable period lookup + latest metric extraction
* ------------------------- */

/**
* Get the latest metric value for an activity within a normalized period (month/quarter/year).
*/
function getLatestMetricValueInPeriod(activity, periodKey, granularity, metricKey) {
const hist = activity.history?.[granularity] || {};
const normalizedKey = normalizePeriodKey(periodKey, granularity);
if (!normalizedKey) return null;

// collect all reports across raw keys that match the normalizedKey
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
// ignore malformed keys
}
}

if (candidateReports.length === 0) return null;

// sort ascending by date (robust)
candidateReports.sort((a, b) => {
const da = a && a.date ? new Date(a.date) : null;
const db = b && b.date ? new Date(b.date) : null;
if (!da && !db) return 0;
if (!da) return -1;
if (!db) return 1;
return da - db;
});

// walk backwards (latest first) and extract first non-null metric value
for (let i = candidateReports.length - 1; i >= 0; i--) {
const r = candidateReports[i];
if (!r || !r.metrics) continue;
const v = extractMetricValue(r.metrics, metricKey);
if (v !== null && v !== undefined) return v;
}

return null;
}

/* ActivityRow updated: compact columns & percent/value toggle */
function ActivityRow({ activity, periods, granularity, number, showPercent }) {
const { t } = useTranslation();

const metricKey = pickMetricForActivity(activity, null);
const targetObj = activity.targetMetric || {};
let targetValue = null;
if (metricKey && metricKey in targetObj) targetValue = targetObj[metricKey];
else if (typeof targetObj === "number") targetValue = targetObj;
else if (targetObj && typeof targetObj === "object" && "target" in targetObj) targetValue = targetObj.target ?? null;

function formatMetricValue(val) {
if (val === null || val === undefined) return null;
if (typeof val === "object") {
const keys = Object.keys(val || {});
if (keys.length === 1) {
const inner = val[keys[0]];
if (typeof inner === "object") return JSON.stringify(inner);
return String(inner);
}
try {
return JSON.stringify(val);
} catch (e) {
return String(val);
}
}
return String(val);
}

return (
<tr className="bg-white dark:bg-gray-800">
<td className="border px-3 py-3 text-base font-medium text-gray-900 dark:text-gray-100 pl-4 min-w-[240px] max-w-[420px]">
<div className="truncate">{`${number} ${activity.title}`}</div>
</td>

<td className="border px-3 py-3 text-sm text-gray-700 dark:text-gray-200 w-20 text-center">
<div className="truncate">{activity.weight ?? "-"}</div>
</td>

<td className="border px-3 py-3 text-sm text-gray-700 dark:text-gray-200 w-28 text-center">
<div className="truncate">{metricKey ?? "-"}</div>
</td>

<td className="border px-3 py-3 text-sm text-gray-700 dark:text-gray-200 w-32 text-right font-mono">
<div className="truncate">{targetValue ?? "-"}</div>
</td>

{periods.map((p) => {
const rawVal = getLatestMetricValueInPeriod(activity, p, granularity, metricKey);
if (rawVal === null || rawVal === undefined) {
return (
<td key={p} className="border px-2 py-2 text-sm text-gray-700 dark:text-gray-200 text-center w-[88px]">
<div className="truncate">-</div>
</td>
);
}
const display = formatMetricValue(rawVal) ?? "-";

// percentage calculations (kept but only displayed when showPercent === true)
let pct = null;
const parsedVal = parseNumberForPct(rawVal);
const parsedTarget = parseNumberForPct(targetValue);
if (!isNaN(parsedVal) && !isNaN(parsedTarget) && parsedTarget !== 0) {
pct = (parsedVal / parsedTarget) * 100;
}

return (
<td key={p} className="border px-2 py-2 text-sm text-gray-700 dark:text-gray-200 text-right w-[88px]">
<div className="min-w-0">
<div className="text-sm font-mono truncate">{showPercent && pct !== null && !isNaN(pct) ? `${pct.toFixed(0)}%` : display}</div>
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
if (!metrics) return <div className="text-xs text-gray-400">—</div>;

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
<div className="text-xs font-mono break-words p-2 bg-white dark:bg-gray-900 rounded border text-gray-800 dark:text-gray-100">
{s}
</div>
);
}

if (!obj || typeof obj !== "object") {
return <div className="text-xs text-gray-400">—</div>;
}
const keys = Object.keys(obj);
if (keys.length === 0) return <div className="text-xs text-gray-400">—</div>;

return (
<div className="space-y-1">
{keys.map((k) => {
const value = obj[k];
const displayValue =
value !== null && typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
return (
<div
key={k}
className="flex items-start justify-between bg-white dark:bg-gray-900 rounded px-2 py-1 border dark:border-gray-700 gap-4"
>
<div className="text-xs text-gray-600 dark:text-gray-300 pt-px">{k}</div>
<div className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all text-right whitespace-pre-wrap">
{displayValue}
</div>
</div>
);
})}
</div>
);
}