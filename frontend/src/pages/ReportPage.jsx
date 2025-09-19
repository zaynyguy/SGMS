// src/pages/ReportsUI.jsx
import React, { useState, useEffect, useMemo } from "react";
import { Loader } from "lucide-react";
import { fetchReports, reviewReport, fetchMasterReport } from "../api/reports";
import { useTranslation } from "react-i18next";
import TopBar from "../components/layout/TopBar";

/* -------------------------
   Small helper: render metrics nicely (object or JSON)
------------------------- */
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
    // not JSON — show raw string (shortened)
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
      {keys.map((k) => (
        <div
          key={k}
          className="flex items-center justify-between bg-white dark:bg-gray-900 rounded px-2 py-1 border dark:border-gray-700"
        >
          <div className="text-xs text-gray-600 dark:text-gray-300">{k}</div>
          <div className="text-xs font-medium text-gray-900 dark:text-gray-100 break-words">
            {String(obj[k])}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------
   Top-right tab group
------------------------- */
function TopRightTabs({ value, onChange }) {
  const { t } = useTranslation();

  const options = [
    {
      id: "review",
      labelKey: "reports.tabs.review",
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
      labelKey: "reports.tabs.master",
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
    <div className="flex justify-end items-center space-x-4">
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
            <span className="hidden sm:inline">{t(opt.labelKey)}</span>
          </button>
        ))}
      </div>
        <TopBar/>
    </div>
  );
}

/* -------------------------
   REVIEW PAGE
------------------------- */
function ReviewReportsPage() {
  const { t } = useTranslation();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [actionState, setActionState] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter]);

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
      setActionLoading((s) => ({ ...s, [id]: true }));
      await reviewReport(id, { status, adminComment, resubmissionDeadline });
      await loadReports();
      setActionState((s) => ({
        ...s,
        [id]: {
          ...(s[id] || {}),
          _lastResult: t("reports.action.updatedTo", { status }),
        },
      }));
    } catch (err) {
      console.error("review error", err);
      setActionState((s) => ({
        ...s,
        [id]: {
          ...(s[id] || {}),
          _lastError: err?.message || t("reports.action.failed"),
        },
      }));
    } finally {
      setActionLoading((s) => ({ ...s, [id]: false }));
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

  const statusOptions = [
    { id: "All", key: "reports.filters.all" },
    { id: "Pending", key: "reports.filters.pending" },
    { id: "Approved", key: "reports.filters.approved" },
    { id: "Rejected", key: "reports.filters.rejected" },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 p-4 md:p-6 lg:p-7 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 dark:text-gray-100">
            {t("reports.review.title")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
            {t("reports.review.subtitle")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full lg:w-auto">
          <div className="flex-1 min-w-0">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={t("reports.search.placeholder")}
              className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 min-w-0 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={() => {
              setPage(1);
              loadReports({ page: 1, q: search });
            }}
            className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 dark:text-white text-sm whitespace-nowrap hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {t("reports.search.button")}
          </button>
          <button
            onClick={handleRefresh}
            className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 dark:text-white text-sm whitespace-nowrap flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              className="opacity-80"
            >
              <path
                d="M21 12A9 9 0 1 0 6 20.1"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M21 3v6h-6"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t("reports.refresh")}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setPage(1);
                setStatusFilter(s.id);
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === s.id
                  ? "bg-sky-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {t(s.key)}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-gray-500 dark:text-gray-400">
          {t("reports.pagination.showingPage", { page, totalPages, total })}
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
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
              <div
                key={r.id}
                className="border rounded-lg overflow-hidden transition-all"
              >
                <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 md:gap-4">
                      <div className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">
                        Report #{r.id}
                      </div>
                      <div
                        className={`px-2 py-1 md:px-3 md:py-1.5 rounded-full text-xs md:text-sm font-medium ${
                          r.status === "Approved"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : r.status === "Rejected"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}
                      >
                        {t(`reports.status.${r.status}`, {
                          defaultValue: r.status,
                        })}
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
                      className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                        {t("reports.narrative")}
                      </div>
                      <div className="text-sm md:text-base text-gray-700 dark:text-gray-200 mt-1">
                        {r.narrative || (
                          <em className="text-gray-400">
                            {t("reports.noNarrative")}
                          </em>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {t("reports.metrics")}
                      </div>
                      <div className="mt-2">
                        {renderMetricsList(r.metrics_data)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        placeholder={t("reports.adminComment.placeholder")}
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
                        className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        disabled={!!actionLoading[r.id]}
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
                        className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        disabled={!!actionLoading[r.id]}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview(r.id, "Approved")}
                          className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
                          disabled={!!actionLoading[r.id]}
                          aria-busy={!!actionLoading[r.id]}
                        >
                          {actionLoading[r.id] ? (
                            <Loader className="h-4 w-4 animate-spin" />
                          ) : (
                            t("reports.actions.approve")
                          )}
                        </button>
                        <button
                          onClick={() => handleReview(r.id, "Rejected")}
                          className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-red-700 transition-colors"
                          disabled={!!actionLoading[r.id]}
                          aria-busy={!!actionLoading[r.id]}
                        >
                          {actionLoading[r.id] ? (
                            <Loader className="h-4 w-4 animate-spin" />
                          ) : (
                            t("reports.actions.reject")
                          )}
                        </button>
                      </div>
                    </div>

                    {/* small inline result / error */}
                    {actionState[r.id]?._lastResult && (
                      <div className="text-xs text-green-700 dark:text-green-300">
                        {actionState[r.id]._lastResult}
                      </div>
                    )}
                    {actionState[r.id]?._lastError && (
                      <div className="text-xs text-red-600 dark:text-red-400">
                        {actionState[r.id]._lastError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {reports.length === 0 && !loading && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-6">
                {t("reports.noReports")}
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => {
              setPage(1);
              loadReports({ page: 1 });
            }}
            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("reports.pagination.first")}
          </button>
          <button
            disabled={page <= 1}
            onClick={() => {
              setPage((p) => Math.max(1, p - 1));
              loadReports({ page: Math.max(1, page - 1) });
            }}
            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("reports.pagination.prev")}
          </button>
          <div className="px-3 py-1.5 text-sm">
            {page} / {totalPages}
          </div>
          <button
            disabled={page >= totalPages}
            onClick={() => {
              setPage((p) => Math.min(totalPages, p + 1));
              loadReports({ page: Math.min(totalPages, page + 1) });
            }}
            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("reports.pagination.next")}
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => {
              setPage(totalPages);
              loadReports({ page: totalPages });
            }}
            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("reports.pagination.last")}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400">
            {t("reports.pageSize")}
          </label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="px-2 py-1.5 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
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

/* -------------------------
   Master report helpers & table row
------------------------- */

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
  (masterJson?.goals || []).forEach((g) => {
    (g.tasks || []).forEach((task) => {
      (task.activities || []).forEach((a) => {
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

/* ActivityRow updated so metrics look clean and readable (not raw JSON) */
function ActivityRow({ activity, periods, granularity }) {
  const { t } = useTranslation();

  const metricKey = pickMetricForActivity(activity, null);
  const targetObj = activity.targetMetric || {};
  const targetValue =
    metricKey && metricKey in targetObj
      ? targetObj[metricKey]
      : typeof targetObj === "number"
      ? targetObj
      : targetObj.target ?? null;

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
        if (val === null || val === undefined) {
          return (
            <td
              key={p}
              className="border px-3 py-3 text-sm text-gray-700 dark:text-gray-200"
            >
              -
            </td>
          );
        }

        // If numeric and target exists show percent badge
        let display =
          typeof val === "object" ? JSON.stringify(val) : String(val);
        let pct = null;
        if (targetValue && !isNaN(Number(display))) {
          pct = (Number(display) / Number(targetValue)) * 100;
        }

        return (
          <td
            key={p}
            className="border px-3 py-3 text-sm text-gray-700 dark:text-gray-200"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{display}</div>
              {pct !== null && !isNaN(pct) && (
                <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  {pct.toFixed(0)}%
                </div>
              )}
            </div>
          </td>
        );
      })}
    </tr>
  );
}

/* -------------------------
   Master Report page wrapper
------------------------- */
function MasterReportPageWrapper() {
  const { t } = useTranslation();

  const [groupId, setGroupId] = useState("");
  const [loading, setLoading] = useState(false);
  const [master, setMaster] = useState(null);
  const [error, setError] = useState(null);
  const [granularity, setGranularity] = useState("monthly");

  // small helper to escape text when generating HTML for print
  function escapeHtml(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  async function handleFetch() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMasterReport(groupId || undefined);
      setMaster(data);
    } catch (err) {
      // Distinguish auth errors from other network / server errors
      if (err && err.status === 401) {
        setError(
          "Unauthorized — your session may have expired. Please sign in again."
        );
        setMaster(null);
        // optional: force a client-side redirect to login page (uncomment if desired)
        // window.location.href = "/login";
      } else {
        setError(err?.message || t("reports.master.fetchFailed"));
        setMaster(null);
      }
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
      (g.tasks || []).forEach((task) => {
        rows.push({
          type: "task",
          id: `t-${task.id}`,
          title: task.title,
          weight: task.weight ?? "-",
          progress: task.progress ?? "-",
          task: task,
          parentGoal: g,
          raw: task,
        });
        (task.activities || []).forEach((a) => {
          rows.push({
            type: "activity",
            id: `a-${a.id}`,
            title: a.title,
            weight: a.weight ?? "-",
            activity: a,
            parentTask: task,
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
        return `<th style="padding:8px;border:1px solid #ddd;background:#f3f4f6">${escapeHtml(
          label
        )}</th>`;
      })
      .join("");

    const rowsHtml = tableRows
      .map((row) => {
        if (row.type === "goal") {
          return `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:700">${escapeHtml(
            row.title
          )}</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(
            String(row.weight)
          )}</td><td style="padding:8px;border:1px solid #ddd">—</td><td style="padding:8px;border:1px solid #ddd">—</td>${periods
            .map(() => `<td style="padding:8px;border:1px solid #ddd">—</td>`)
            .join("")}</tr>`;
        } else if (row.type === "task") {
          return `<tr><td style="padding:8px;border:1px solid #ddd;padding-left:20px">${escapeHtml(
            row.title
          )}</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(
            String(row.weight)
          )}</td><td style="padding:8px;border:1px solid #ddd">—</td><td style="padding:8px;border:1px solid #ddd">—</td>${periods
            .map(() => `<td style="padding:8px;border:1px solid #ddd">—</td>`)
            .join("")}</tr>`;
        } else {
          const mk = pickMetricForActivity(row.activity, null);
          // robust target resolution
          let targetVal = "";
          if (typeof row.activity.targetMetric === "number")
            targetVal = row.activity.targetMetric;
          else if (
            mk &&
            row.activity.targetMetric &&
            mk in row.activity.targetMetric
          )
            targetVal = row.activity.targetMetric[mk];
          else if (
            row.activity.targetMetric &&
            typeof row.activity.targetMetric === "object" &&
            "target" in row.activity.targetMetric
          )
            targetVal = row.activity.targetMetric.target;
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
              return `<td style="padding:8px;border:1px solid #ddd">${escapeHtml(
                String(typeof v === "object" ? JSON.stringify(v) : String(v))
              )}</td>`;
            })
            .join("");
          return `<tr><td style="padding:8px;border:1px solid #ddd;padding-left:34px">${escapeHtml(
            row.title
          )}</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(
            String(row.weight)
          )}</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(
            mk ?? "-"
          )}</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(
            String(targetVal ?? "-")
          )}</td>${periodCells}</tr>`;
        }
      })
      .join("");

    const title = t("reports.master.title");
    const groupLabel = t("reports.master.groupLabel");
    const narratives = t("reports.master.narratives");
    const dataTable = t("reports.master.dataTable");
    const generated = t("reports.master.generatedAt", {
      date: new Date().toLocaleString(),
    });

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
@media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p style="margin-top:2px;margin-bottom:8px">${escapeHtml(
      groupLabel
    )}: ${escapeHtml(String(groupId || "All"))} • ${escapeHtml(generated)}</p>

<section>
  <h2>${escapeHtml(narratives)}</h2>
  ${data.goals
    .map(
      (g) => `
    <div style="margin-bottom:12px;padding:10px;border:1px solid #eee;border-radius:6px;background:#fbfbfb">
      <div style="font-weight:700;font-size:15px">${escapeHtml(
        g.title
      )} <span style="font-weight:400;color:#6b7280">• ${escapeHtml(
        String(g.status || "—")
      )} • ${escapeHtml(String(g.progress ?? 0))}% • weight: ${escapeHtml(
        String(g.weight ?? "-")
      )}</span></div>
      <div style="margin-top:8px;padding-left:8px">
        ${(g.tasks || [])
          .map(
            (task) => `
          <div style="margin-bottom:8px">
            <div style="font-weight:600">${escapeHtml(
              task.title
            )} <span style="color:#6b7280">(${escapeHtml(
              String(task.progress ?? 0)
            )}%) • weight: ${escapeHtml(
              String(task.weight ?? "-")
            )}</span></div>
            ${(task.activities || [])
              .map(
                (activity) => `
              <div style="margin-left:16px;margin-top:6px;padding:8px;border:1px solid #f1f5f9;border-radius:4px;background:#fff">
                <div style="font-weight:600">${escapeHtml(activity.title)}</div>
                <div style="color:#6b7280;margin-top:6px">${escapeHtml(
                  t("reports.master.targetLabel")
                )}: ${
                  activity.targetMetric
                    ? escapeHtml(JSON.stringify(activity.targetMetric))
                    : "-"
                }</div>
                <div style="margin-top:8px">${(activity.reports || [])
                  .map(
                    (r) =>
                      `<div style="padding:6px;border-top:1px dashed #eee"><strong>#${escapeHtml(
                        String(r.id)
                      )}</strong> • ${escapeHtml(String(r.status || "—"))} • ${
                        r.createdAt
                          ? escapeHtml(new Date(r.createdAt).toLocaleString())
                          : ""
                      }<div style="margin-top:4px">${escapeHtml(
                        r.narrative || ""
                      )}</div></div>`
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
  <h2>${escapeHtml(dataTable)}</h2>
  <table>
    <thead><tr><th>${escapeHtml(t("reports.table.title"))}</th><th>${escapeHtml(
      t("reports.table.weight")
    )}</th><th>${escapeHtml(t("reports.table.metric"))}</th><th>${escapeHtml(
      t("reports.table.target")
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
    const headers = [
      t("reports.table.type"),
      t("reports.table.goal"),
      t("reports.table.task"),
      t("reports.table.activity"),
      t("reports.table.weight"),
      t("reports.table.metric"),
      t("reports.table.target"),
      ...periods,
    ];
    const rows = [];
    master.goals.forEach((g) => {
      const goalRow = [
        t("reports.table.goal"),
        g.title,
        "",
        "",
        g.weight ?? "",
        "",
        "",
        ...periods.map(() => ""),
      ];
      rows.push(goalRow);
      (g.tasks || []).forEach((task) => {
        const taskRow = [
          t("reports.table.task"),
          g.title,
          task.title,
          "",
          task.weight ?? "",
          "",
          "",
          ...periods.map(() => ""),
        ];
        rows.push(taskRow);
        (task.activities || []).forEach((a) => {
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
            t("reports.table.activity"),
            g.title,
            task.title,
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
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-gray-100">
            {t("reports.master.title")}
          </h2>
          <div className="text-sm text-gray-500 dark:text-gray-300">
            {t("reports.master.subtitle")}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-5">
        <div className="md:col-span-3">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
            {t("reports.master.groupIdLabel")}
          </label>
          <input
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            placeholder={t("reports.master.groupIdPlaceholder")}
            className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          />
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 mt-2">
              {error}
            </div>
          )}
        </div>
        <div className="md:col-span-2 flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
          <button
            onClick={handleFetch}
            disabled={loading}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg shadow flex items-center justify-center gap-2 hover:bg-sky-700 transition-colors"
          >
            {loading ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              t("reports.master.loadButton")
            )}
          </button>
          <button
            onClick={exportPDF}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            {t("reports.master.exportPDF")}
          </button>
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {t("reports.master.exportCSV")}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-300">
            {t("reports.master.granularityLabel")}
          </label>
          <div className="flex gap-2 mt-1">
            {["monthly", "quarterly", "annual"].map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  granularity === g
                    ? "bg-sky-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {t(`reports.master.granularities.${g}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          {t("reports.master.periodColumns", {
            count: periodColumns.length,
            granularity,
          })}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xl md:text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
          {t("reports.master.narrativesTitle")}
        </h3>
        {!master && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t("reports.master.noData")}
          </div>
        )}
        {master && master.goals && master.goals.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t("reports.master.noGoals")}
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
                  {(g.tasks || []).map((task) => (
                    <div key={task.id}>
                      <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        {task.title}{" "}
                        <span className="text-sm text-gray-400">
                          ({task.progress ?? 0}%)
                        </span>
                      </div>
                      <div className="pl-3 mt-3 space-y-3">
                        {(task.activities || []).map((a) => (
                          <div
                            key={a.id}
                            className="p-3 bg-white dark:bg-gray-800 rounded border"
                          >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                              <div>
                                <div className="text-base md:text-lg font-medium text-gray-800 dark:text-gray-100">
                                  {a.title}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-300 mt-1">
                                  {t("reports.master.targetText")}:{" "}
                                  <span className="font-medium text-gray-800 dark:text-gray-100">
                                    {a.targetMetric ? "" : "-"}
                                  </span>
                                </div>
                                <div className="mt-2">
                                  {a.targetMetric
                                    ? renderMetricsList(a.targetMetric)
                                    : null}
                                </div>
                              </div>
                              <div className="text-sm text-gray-400">
                                {a.status} •{" "}
                                {a.isDone
                                  ? t("reports.master.done")
                                  : t("reports.master.open")}
                              </div>
                            </div>

                            <div className="mt-3 space-y-2">
                              {(a.reports || []).length === 0 ? (
                                <div className="text-xs text-gray-400">
                                  {t("reports.master.noReports")}
                                </div>
                              ) : (
                                (a.reports || []).map((r) => (
                                  <div
                                    key={r.id}
                                    className="text-sm border rounded p-2 bg-gray-50 dark:bg-gray-900"
                                  >
                                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
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
                                          {t("reports.noNarrative")}
                                        </em>
                                      )}
                                    </div>
                                    {r.metrics && (
                                      <div className="mt-2">
                                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                          {t("reports.metrics")}
                                        </div>
                                        <div className="mt-1">
                                          {renderMetricsList(r.metrics)}
                                        </div>
                                      </div>
                                    )}
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
        <h3 className="text-xl md:text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
          {t("reports.table.titleFull")}
        </h3>
        <div className="overflow-auto border rounded">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="border px-3 py-3 text-left text-base text-gray-900 dark:text-gray-100">
                  {t("reports.table.title")}
                </th>
                <th className="border px-3 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {t("reports.table.weight")}
                </th>
                <th className="border px-3 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {t("reports.table.metric")}
                </th>
                <th className="border px-3 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {t("reports.table.target")}
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
   Main wrapper - switch between review & master
------------------------- */
export default function ReportsUI() {
  const { t } = useTranslation();
  const [page, setPage] = useState("review");

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 p-4 md:p-6 lg:p-8 max-w-8xl mx-auto transition-colors duration-200">
      <header className="mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-gray-100">
              {t("reports.header.title")}
            </h1>
            <p className="text-base text-gray-600 dark:text-gray-300 mt-2">
              {t("reports.header.subtitle")}
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
        <p>
          © {new Date().getFullYear()} {t("reports.footer.systemName")} | v2.0
        </p>
      </footer>
    </div>
  );
}
