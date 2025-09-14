import React, { useState, useEffect, useMemo } from "react";
import { fetchReports, reviewReport, fetchMasterReport } from "../api/reports";

function TopRightTabs({ value, onChange }) {
  const options = [
    {
      id: "review",
      label: "Review",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 5v14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M5 12h14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      id: "master",
      label: "Master",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 11h7v6H3z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex justify-end items-center">
      <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-full p-1 gap-1">
        {options.map((opt) => (
          <button
            key={opt.id}
            aria-pressed={value === opt.id}
            onClick={() => onChange(opt.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold transition ${
              value === opt.id
                ? "bg-white dark:bg-gray-700 shadow text-sky-700 dark:text-sky-300"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            <span className="opacity-90">{opt.icon}</span>
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ReviewReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [actionState, setActionState] = useState({});
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter]); // search triggers manual reload via button or Enter

  async function loadReports(opts = {}) {
    setLoading(true);
    try {
      const usePage = opts.page || page;
      const useSize = opts.pageSize || pageSize;
      const status = statusFilter === "All" ? undefined : statusFilter;
      const q = opts.q !== undefined ? opts.q : search ? search : undefined;

      const data = await fetchReports(usePage, useSize, status, q);
      setReports(Array.isArray(data.rows) ? data.rows : []);
      setPage(data.page || usePage);
      setPageSize(data.pageSize || useSize);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("loadReports error:", err);
      setReports([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(id, status) {
    const adminComment = actionState[id]?.comment || null;
    const resubmissionDeadline = actionState[id]?.deadline || null;
    try {
      await reviewReport(id, { status, adminComment, resubmissionDeadline });
      await loadReports();
      alert("Review updated successfully");
    } catch (err) {
      alert("Failed: " + (err.message || "unknown"));
    }
  }

  function onSearchKeyDown(e) {
    if (e.key === "Enter") {
      setPage(1);
      loadReports({ page: 1, q: search });
    }
  }

  function handleRefresh() {
    setPage(1);
    loadReports({ page: 1, q: search });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="bg-white dark:bg-gray-800 p-5 md:p-7 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Review & Moderate
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
            Approve or reject incoming reports
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search reports (press Enter)"
            className="px-3 py-2 rounded border bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
          />
          <button
            onClick={() => {
              setPage(1);
              loadReports({ page: 1, q: search });
            }}
            className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 text-sm"
          >
            Search
          </button>
          <button
            onClick={handleRefresh}
            className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-3 items-center mb-4">
        {["All", "Pending", "Approved", "Rejected"].map((s) => (
          <button
            key={s}
            onClick={() => {
              setPage(1);
              setStatusFilter(s);
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              statusFilter === s
                ? "bg-sky-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            }`}
          >
            {s}
          </button>
        ))}
        <div className="ml-auto text-xs text-gray-500 dark:text-gray-400">
          Showing page {page} of {totalPages} • {total} reports
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          // render skeleton placeholders (keeps layout stable and prevents spinner from "replacing" first item)
          Array.from({ length: Math.min(5, pageSize) }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="border rounded-lg overflow-hidden animate-pulse"
            >
              <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900">
                <div className="min-w-0 w-full">
                  <div className="flex items-center gap-4">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                  </div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-40 mt-3"></div>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              </div>
            </div>
          ))
        ) : (
          <>
            {reports.map((r) => (
              <div key={r.id} className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900">
                  <div className="min-w-0">
                    <div className="flex items-center gap-4">
                      <div className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">
                        Report #{r.id}
                      </div>
                      <div
                        className={`px-3 py-1.5 rounded-full text-xs md:text-sm font-medium ${
                          r.status === "Approved"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : r.status === "Rejected"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}
                      >
                        {r.status}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-300 mt-1">
                      {r.activity_title} • {r.user_name}
                    </div>
                  </div>

                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() =>
                        setExpanded(expanded === r.id ? null : r.id)
                      }
                      aria-expanded={expanded === r.id}
                      className="flex items-center gap-2 px-3 py-1 rounded bg-gray-50 dark:bg-gray-800"
                    >
                      <svg
                        className={`transition-transform ${
                          expanded === r.id ? "rotate-180" : "rotate-0"
                        }`}
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M6 9l6 6 6-6"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {expanded === r.id && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        Narrative
                      </div>
                      <div className="text-sm md:text-base text-gray-700 dark:text-gray-200 mt-1">
                        {r.narrative || (
                          <em className="text-gray-400">No narrative</em>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        Metrics
                      </div>
                      <pre className="text-xs md:text-sm bg-white dark:bg-gray-900 p-3 rounded border text-gray-800 dark:text-gray-100">
                        {JSON.stringify(r.metrics_data, null, 2)}
                      </pre>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        placeholder="Admin comment"
                        value={actionState[r.id]?.comment || ""}
                        onChange={(e) =>
                          setActionState((s) => ({
                            ...s,
                            [r.id]: {
                              ...(s[r.id] || {}),
                              comment: e.target.value,
                            },
                          }))
                        }
                        className="px-3 py-2 rounded border bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="date"
                        value={actionState[r.id]?.deadline || ""}
                        onChange={(e) =>
                          setActionState((s) => ({
                            ...s,
                            [r.id]: {
                              ...(s[r.id] || {}),
                              deadline: e.target.value,
                            },
                          }))
                        }
                        className="px-3 py-2 rounded border bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview(r.id, "Approved")}
                          className="flex-1 bg-green-600 text-white px-3 py-2 rounded"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReview(r.id, "Rejected")}
                          className="flex-1 bg-red-600 text-white px-3 py-2 rounded"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {reports.length === 0 && !loading && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-6">
                No reports found.
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => {
              setPage(1);
              loadReports({ page: 1 });
            }}
            className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-sm"
          >
            First
          </button>
          <button
            disabled={page <= 1}
            onClick={() => {
              setPage((p) => Math.max(1, p - 1));
              loadReports({ page: Math.max(1, page - 1) });
            }}
            className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-sm"
          >
            Prev
          </button>
          <div className="px-3 py-1 text-sm">
            {page} / {totalPages}
          </div>
          <button
            disabled={page >= totalPages}
            onClick={() => {
              setPage((p) => Math.min(totalPages, p + 1));
              loadReports({ page: Math.min(totalPages, page + 1) });
            }}
            className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-sm"
          >
            Next
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => {
              setPage(totalPages);
              loadReports({ page: totalPages });
            }}
            className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-sm"
          >
            Last
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400">
            Page size
          </label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="px-2 py-1 rounded bg-white dark:bg-gray-700 text-sm"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function fmtMonthKey(date) {
  const [y, m] = String(date).split("-");
  const mm = Number(m);
  return new Date(Number(y), mm - 1, 1).toLocaleString(undefined, {
    month: "short",
    year: "numeric",
  });
}
function fmtQuarterKey(q) {
  const [y, qn] = String(q).split("-Q");
  return `Q${qn} ${y}`;
}
function flattenPeriods(masterJson, granularity) {
  const set = new Set();
  (masterJson.goals || []).forEach((g) => {
    (g.tasks || []).forEach((t) => {
      (t.activities || []).forEach((a) => {
        const hist = a.history?.[granularity] || {};
        Object.keys(hist || {}).forEach((k) => set.add(k));
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
  const curKeys = activity.currentMetric
    ? Object.keys(activity.currentMetric)
    : [];
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
function getLatestMetricValueInPeriod(
  activity,
  periodKey,
  granularity,
  metricKey
) {
  const arr = (activity.history?.[granularity]?.[periodKey] || []).slice();
  if (!arr.length) return null;
  arr.sort((a, b) => new Date(a.date) - new Date(b.date));
  for (let i = arr.length - 1; i >= 0; i--) {
    const r = arr[i];
    if (!r.metrics) continue;
    if (metricKey && metricKey in r.metrics) return r.metrics[metricKey];
    const keys = Object.keys(r.metrics || {});
    if (keys.length === 1) return r.metrics[keys[0]];
    if (keys.length && !metricKey) return r.metrics[keys[0]];
  }
  return null;
}
function ActivityRow({ activity, periods, granularity }) {
  const metricKey = pickMetricForActivity(activity, null);
  const targetObj = activity.targetMetric || {};
  const targetValue =
    metricKey && metricKey in targetObj
      ? targetObj[metricKey]
      : typeof targetObj === "number"
      ? targetObj
      : targetObj.target || null;
  return (
    <tr className="bg-white dark:bg-gray-800">
      <td className="border px-3 py-3 text-base font-medium text-gray-900 dark:text-gray-100">
        {activity.title}
      </td>
      <td className="border px-3 py-3 text-sm text-gray-700 dark:text-gray-200">
        {activity.weight ?? "-"}
      </td>
      <td className="border px-3 py-3 text-sm text-gray-700 dark:text-gray-200">
        {metricKey ?? "-"}
      </td>
      <td className="border px-3 py-3 text-sm text-gray-700 dark:text-gray-200">
        {targetValue ?? "-"}
      </td>
      {periods.map((p) => {
        const val = getLatestMetricValueInPeriod(
          activity,
          p,
          granularity,
          metricKey
        );
        let display = "-";
        if (val !== null && val !== undefined) {
          display = typeof val === "object" ? JSON.stringify(val) : String(val);
          if (targetValue && !isNaN(Number(display))) {
            const pct = (Number(display) / Number(targetValue)) * 100;
            display = `${display} (${pct.toFixed(0)}%)`;
          }
        }
        return (
          <td
            key={p}
            className="border px-3 py-3 text-sm text-gray-700 dark:text-gray-200"
          >
            {display}
          </td>
        );
      })}
    </tr>
  );
}

function MasterReportPageWrapper() {
  const [groupId, setGroupId] = useState("");
  const [loading, setLoading] = useState(false);
  const [master, setMaster] = useState(null);
  const [error, setError] = useState(null);
  const [granularity, setGranularity] = useState("monthly");

  async function handleFetch() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMasterReport(groupId || undefined);
      setMaster(data);
    } catch (err) {
      setError(err.message || "Failed to fetch");
      setMaster(null);
    } finally {
      setLoading(false);
    }
  }

  const periodColumns = useMemo(() => {
    if (!master) return [];
    return flattenPeriods(master, granularity);
  }, [master, granularity]);

  const tableRows = useMemo(() => {
    const rows = [];
    if (!master) return rows;
    master.goals.forEach((g) => {
      rows.push({
        type: "goal",
        id: `g-${g.id}`,
        title: g.title,
        weight: g.weight ?? "-",
        progress: g.progress ?? "-",
        goal: g,
        raw: g,
      });
      (g.tasks || []).forEach((t) => {
        rows.push({
          type: "task",
          id: `t-${t.id}`,
          title: t.title,
          weight: t.weight ?? "-",
          progress: t.progress ?? "-",
          task: t,
          parentGoal: g,
          raw: t,
        });
        (t.activities || []).forEach((a) => {
          rows.push({
            type: "activity",
            id: `a-${a.id}`,
            title: a.title,
            weight: a.weight ?? "-",
            activity: a,
            parentTask: t,
            parentGoal: g,
            raw: a,
          });
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
        return `<th style="padding:8px;border:1px solid #ddd;background:#f3f4f6">${label}</th>`;
      })
      .join("");
    const rowsHtml = tableRows
      .map((row) => {
        if (row.type === "goal") {
          return `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:700">${
            row.title
          }</td><td style="padding:8px;border:1px solid #ddd">${
            row.weight
          }</td><td style="padding:8px;border:1px solid #ddd">—</td><td style="padding:8px;border:1px solid #ddd">—</td>${periods
            .map(() => `<td style="padding:8px;border:1px solid #ddd">—</td>`)
            .join("")}</tr>`;
        } else if (row.type === "task") {
          return `<tr><td style="padding:8px;border:1px solid #ddd;padding-left:20px">${
            row.title
          }</td><td style="padding:8px;border:1px solid #ddd">${
            row.weight
          }</td><td style="padding:8px;border:1px solid #ddd">—</td><td style="padding:8px;border:1px solid #ddd">—</td>${periods
            .map(() => `<td style="padding:8px;border:1px solid #ddd">—</td>`)
            .join("")}</tr>`;
        } else {
          const mk = pickMetricForActivity(row.activity, null);
          const targetVal =
            row.activity.targetMetric && mk in row.activity.targetMetric
              ? row.activity.targetMetric[mk]
              : row.activity.targetMetric?.target ?? "";
          const periodCells = periods
            .map((p) => {
              const v = getLatestMetricValueInPeriod(
                row.activity,
                p,
                granularity,
                mk
              );
              if (v === null || v === undefined)
                return `<td style="padding:8px;border:1px solid #ddd">-</td>`;
              return `<td style="padding:8px;border:1px solid #ddd">${String(
                v
              )}</td>`;
            })
            .join("");
          return `<tr><td style="padding:8px;border:1px solid #ddd;padding-left:34px">${
            row.title
          }</td><td style="padding:8px;border:1px solid #ddd">${
            row.weight
          }</td><td style="padding:8px;border:1px solid #ddd">${
            mk ?? "-"
          }</td><td style="padding:8px;border:1px solid #ddd">${
            targetVal ?? "-"
          }</td>${periodCells}</tr>`;
        }
      })
      .join("");
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Master Report</title>
<style>
body{font-family:Inter,Arial,Helvetica,sans-serif;padding:20px;color:#111;background:#fff}
h1{font-size:24px;margin-bottom:4px}
h2{font-size:16px;color:#374151}
table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{border:1px solid #ddd;padding:8px;font-size:13px;vertical-align:top}
th{background:#f3f4f6}
.goal-row td{background:#eef2ff}
.task-row td{background:#f8fafc}
@media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<h1>Master Report</h1>
<p style="margin-top:2px;margin-bottom:8px">Group: ${
      groupId || "All"
    } • Generated: ${new Date().toLocaleString()}</p>

<section>
  <h2>Narratives</h2>
  ${data.goals
    .map(
      (g) => `
    <div style="margin-bottom:12px;padding:10px;border:1px solid #eee;border-radius:6px;background:#fbfbfb">
      <div style="font-weight:700;font-size:15px">${
        g.title
      } <span style="font-weight:400;color:#6b7280">• ${g.status} • ${
        g.progress ?? 0
      }%</span></div>
      <div style="margin-top:8px;padding-left:8px">
        ${(g.tasks || [])
          .map(
            (t) => `
          <div style="margin-bottom:8px">
            <div style="font-weight:600">${
              t.title
            } <span style="color:#6b7280">(${t.progress ?? 0}%)</span></div>
            ${(t.activities || [])
              .map(
                (a) => `
              <div style="margin-left:16px;margin-top:6px;padding:8px;border:1px solid #f1f5f9;border-radius:4px;background:#fff">
                <div style="font-weight:600">${a.title}</div>
                <div style="color:#6b7280;margin-top:6px">Target: ${
                  a.targetMetric ? JSON.stringify(a.targetMetric) : "-"
                }</div>
                <div style="margin-top:8px">${(a.reports || [])
                  .map(
                    (r) =>
                      `<div style="padding:6px;border-top:1px dashed #eee"><strong>#${
                        r.id
                      }</strong> • ${r.status} • ${
                        r.createdAt
                          ? new Date(r.createdAt).toLocaleString()
                          : ""
                      }<div style="margin-top:4px">${
                        r.narrative || ""
                      }</div></div>`
                  )
                  .join("")}</div>
              </div>
            `
              )
              .join("")}
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `
    )
    .join("")}
</section>

<section style="margin-top:18px">
  <h2>Data Table</h2>
  <table>
    <thead><tr><th>Title</th><th>Weight</th><th>Metric</th><th>Target</th>${columnsHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</section>

</body>
</html>`;
  }

  function exportCSV() {
    if (!master) return alert("Load a report first");
    const periods = periodColumns;
    const headers = [
      "Type",
      "Goal",
      "Task",
      "Activity",
      "Weight",
      "Metric",
      "Target",
      ...periods,
    ];
    const rows = [];
    master.goals.forEach((g) => {
      const goalRow = [
        "Goal",
        g.title,
        "",
        "",
        g.weight ?? "",
        "",
        "",
        ...periods.map(() => ""),
      ];
      rows.push(goalRow);
      (g.tasks || []).forEach((t) => {
        const taskRow = [
          "Task",
          g.title,
          t.title,
          "",
          t.weight ?? "",
          "",
          "",
          ...periods.map(() => ""),
        ];
        rows.push(taskRow);
        (t.activities || []).forEach((a) => {
          const mk = pickMetricForActivity(a, null);
          const target =
            mk && a.targetMetric && mk in a.targetMetric
              ? a.targetMetric[mk]
              : a.targetMetric?.target ?? "";
          const periodVals = periods.map((p) => {
            const v = getLatestMetricValueInPeriod(a, p, granularity, mk);
            return v === null || v === undefined
              ? ""
              : typeof v === "object"
              ? JSON.stringify(v)
              : String(v);
          });
          const actRow = [
            "Activity",
            g.title,
            t.title,
            a.title,
            a.weight ?? "",
            mk ?? "",
            target ?? "",
            ...periodVals,
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
    if (!master) return alert("Load a report first");
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
    <div className="bg-white dark:bg-gray-800 p-5 md:p-7 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-4 mb-5">
        <div className="bg-gradient-to-br from-purple-100 to-sky-50 dark:from-purple-900/20 dark:to-sky-900/10 dark:text-gray-100 dark:border-gray-300 dark:border-2 p-3 rounded-lg">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 11h7v6H3z"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-100">
            Master Report
          </h2>
          <div className="text-sm text-gray-500 dark:text-gray-300">
            Narratives and a compact data table. Export PDF or CSV.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-5">
        <div className="md:col-span-3">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
            Group ID (optional)
          </label>
          <input
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            placeholder="Enter Group ID or leave blank for all"
            className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
          />
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 mt-2">
              {error}
            </div>
          )}
        </div>
        <div className="md:col-span-2 flex gap-2 items-end">
          <button
            onClick={handleFetch}
            disabled={loading}
            className="w-full md:w-auto px-4 py-2 bg-sky-600 text-white rounded shadow"
          >
            {loading ? "Loading..." : "Load Report"}
          </button>
          <button
            onClick={exportPDF}
            className="w-full md:w-auto px-4 py-2 bg-emerald-600 text-white rounded"
          >
            Export PDF
          </button>
          <button
            onClick={exportCSV}
            className="w-full md:w-auto px-4 py-2 bg-indigo-600 text-white rounded"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex gap-4 items-center mb-4">
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Granularity
          </label>
          <div className="flex gap-2 mt-1">
            {["monthly", "quarterly", "annual"].map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`px-3 py-1 rounded ${
                  granularity === g
                    ? "bg-sky-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          Period columns: {periodColumns.length} • {granularity}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
          Narratives
        </h3>
        {!master && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            No data loaded.
          </div>
        )}
        {master && master.goals && master.goals.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            No goals found.
          </div>
        )}
        {master && master.goals && master.goals.length > 0 && (
          <div className="space-y-4">
            {master.goals.map((g) => (
              <div
                key={g.id}
                className="p-4 border rounded bg-gray-50 dark:bg-gray-900"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {g.title}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-300 mt-1">
                      {g.status} • {g.progress ?? 0}%
                    </div>
                  </div>
                </div>
                <div className="mt-4 pl-3 space-y-3">
                  {(g.tasks || []).map((t) => (
                    <div key={t.id}>
                      <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        {t.title}{" "}
                        <span className="text-sm text-gray-400">
                          ({t.progress ?? 0}%)
                        </span>
                      </div>
                      <div className="pl-3 mt-3 space-y-3">
                        {(t.activities || []).map((a) => (
                          <div
                            key={a.id}
                            className="p-3 bg-white dark:bg-gray-800 rounded border"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-base md:text-lg font-medium text-gray-800 dark:text-gray-100">
                                  {a.title}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-300 mt-1">
                                  Target:{" "}
                                  {a.targetMetric
                                    ? JSON.stringify(a.targetMetric)
                                    : "-"}
                                </div>
                              </div>
                              <div className="text-sm text-gray-400">
                                {a.status} • {a.isDone ? "Done" : "Open"}
                              </div>
                            </div>
                            <div className="mt-3 space-y-2">
                              {(a.reports || []).length === 0 ? (
                                <div className="text-xs text-gray-400">
                                  No reports.
                                </div>
                              ) : (
                                (a.reports || []).map((r) => (
                                  <div
                                    key={r.id}
                                    className="text-sm border rounded p-2 bg-gray-50 dark:bg-gray-900"
                                  >
                                    <div className="flex justify-between">
                                      <div className="text-sm font-medium">
                                        #{r.id} •{" "}
                                        <span className="text-gray-600 dark:text-gray-300">
                                          {r.status}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-400">
                                        {r.createdAt
                                          ? new Date(
                                              r.createdAt
                                            ).toLocaleString()
                                          : ""}
                                      </div>
                                    </div>
                                    <div className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                                      {r.narrative || (
                                        <em className="text-gray-400">
                                          No narrative
                                        </em>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
          Data Table
        </h3>
        <div className="overflow-auto border rounded">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="border px-3 py-3 text-left text-base text-gray-900 dark:text-gray-100">
                  Title
                </th>
                <th className="border px-3 py-3 text-sm text-gray-900 dark:text-gray-100">
                  Weight
                </th>
                <th className="border px-3 py-3 text-sm text-gray-900 dark:text-gray-100">
                  Metric
                </th>
                <th className="border px-3 py-3 text-sm text-gray-900 dark:text-gray-100">
                  Target
                </th>
                {periodColumns.map((p) => (
                  <th
                    key={p}
                    className="border px-3 py-3 text-sm text-gray-900 dark:text-gray-100"
                  >
                    {granularity === "monthly"
                      ? fmtMonthKey(p)
                      : granularity === "quarterly"
                      ? fmtQuarterKey(p)
                      : p}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {tableRows.map((row) => {
                if (row.type === "goal") {
                  return (
                    <tr
                      key={row.id}
                      className="bg-indigo-50 dark:bg-indigo-900/10"
                    >
                      <td className="border px-3 py-3 font-semibold text-gray-900 dark:text-gray-100">
                        {row.title}
                      </td>
                      <td className="border px-3 py-3 text-gray-700 dark:text-gray-200">
                        {row.weight}
                      </td>
                      <td className="border px-3 py-3">—</td>
                      <td className="border px-3 py-3">—</td>
                      {periodColumns.map((p) => (
                        <td key={p} className="border px-3 py-3">
                          —
                        </td>
                      ))}
                    </tr>
                  );
                } else if (row.type === "task") {
                  return (
                    <tr key={row.id} className="bg-gray-50 dark:bg-gray-900/20">
                      <td className="border px-3 py-3 pl-6 text-gray-900 dark:text-gray-100">
                        {row.title}
                      </td>
                      <td className="border px-3 py-3 text-gray-700 dark:text-gray-200">
                        {row.weight}
                      </td>
                      <td className="border px-3 py-3">—</td>
                      <td className="border px-3 py-3">—</td>
                      {periodColumns.map((p) => (
                        <td key={p} className="border px-3 py-3">
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
                    />
                  );
                }
              })}
              {tableRows.length === 0 && (
                <tr>
                  <td
                    className="p-6 text-center text-gray-500 dark:text-gray-400"
                    colSpan={4 + periodColumns.length}
                  >
                    No data to display
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

export default function ReportsUI() {
  const [page, setPage] = useState("review");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-5 md:p-8 max-w-8xl mx-auto transition-colors duration-200">
      <header className="mb-6 md:mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-gray-100">
              Reports Dashboard
            </h1>
            <p className="text-base md:text-lg text-gray-600 dark:text-gray-300 mt-2">
              Load, review and generate comprehensive reports
            </p>
          </div>
          <div className="hidden md:block">
            <TopRightTabs value={page} onChange={setPage} />
          </div>
        </div>
        <div className="md:hidden mt-4">
          <TopRightTabs value={page} onChange={setPage} />
        </div>
      </header>

      {page === "review" && <ReviewReportsPage />}
      {page === "master" && <MasterReportPageWrapper />}

      <footer className="mt-10 md:mt-14 text-center text-gray-500 dark:text-gray-400 text-sm">
        <p>© {new Date().getFullYear()} Report System | v2.0</p>
      </footer>
    </div>
  );
}
