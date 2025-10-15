import React, { useState, useEffect, useMemo } from "react";

import { Loader, FileText, ChevronRight, User } from "lucide-react";

import { fetchReports, reviewReport, fetchMasterReport } from "../api/reports";

import { fetchAttachments, downloadAttachment } from "../api/attachments";

import { useTranslation } from "react-i18next";

import TopBar from "../components/layout/TopBar";

import { useAuth } from "../context/AuthContext";

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

/* -------------------------
Pills (desktop center) + Mobile bottom nav
------------------------- */
function TabsPills({ value, onChange }) {
  const { t } = useTranslation();
  const options = [
    {
      id: "review",
      labelKey: "reports.tabs.review",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 5v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "master",
      labelKey: "reports.tabs.master",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
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
    <>
      <div className="hidden md:flex items-center justify-end flex-1">
        <div role="tablist" aria-label="reports mode" className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-full p-1 gap-1">
          {options.map((opt) => {
            const active = value === opt.id;
            return (
              <button
                key={opt.id}
                role="tab"
                aria-selected={active}
                aria-pressed={active}
                onClick={() => onChange(opt.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold transition ${
                  active
                    ? "bg-white dark:bg-gray-700 shadow text-sky-700 dark:text-sky-300"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                <span className="opacity-90">{opt.icon}</span>
                <span className="hidden sm:inline">{t(opt.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <nav aria-label="reports tabs" className="md:hidden fixed left-4 right-4 bottom-4 z-40">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-2 flex justify-between items-center">
          {options.map((opt) => {
            const active = value === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onChange(opt.id)}
                aria-pressed={active}
                aria-current={active ? "true" : undefined}
                className={`flex-1 flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition ${
                  active
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <div className="flex items-center justify-center">{opt.icon}</div>
                <span className="text-xs mt-0.5">{t(opt.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

/* -------------------------
REVIEW PAGE
------------------------- */

function BreadcrumbsCompact({ group_name, goal_title, task_title, activity_title }) {
  // Renders a compact breadcrumb with collapse/expand behavior to handle long titles.
  const segments = [
    { label: group_name || null, key: "group" },
    { label: goal_title || null, key: "goal" },
    { label: task_title || null, key: "task" },
    { label: activity_title || null, key: "activity" },
  ].filter((s) => s.label);

  const [expanded, setExpanded] = useState(false);

  if (segments.length === 0) return null;

  if (segments.length <= 3) {
    // short path: show all truncated with tooltips
    return (
      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 min-w-0 flex-wrap">
        {segments.map((s, i) => (
          <React.Fragment key={s.key}>
            <span className="font-medium truncate max-w-[180px]" title={s.label}>
              {s.label}
            </span>
            {i < segments.length - 1 && <ChevronRight className="h-4 w-4 text-gray-400 mx-1 flex-shrink-0" />}
          </React.Fragment>
        ))}
      </div>
    );
  }

  // long path: show first, ellipsis toggle, last; expanded view reveals all
  const first = segments[0];
  const last = segments[segments.length - 1];
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 min-w-0">
      <div className="flex items-center gap-1 min-w-0 overflow-hidden">
        <span className="font-medium truncate max-w-[160px]" title={first.label}>
          {first.label}
        </span>
        <ChevronRight className="h-4 w-4 text-gray-400 mx-1 flex-shrink-0" />
      </div>

      {!expanded ? (
        <>
          <button
            onClick={() => setExpanded(true)}
            aria-expanded={expanded}
            className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            title="Show full path"
          >
            …
          </button>
          <div className="flex items-center gap-1 min-w-0">
            <span className="font-semibold truncate max-w-[160px]" title={last.label}>
              {last.label}
            </span>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-1 max-w-[60vw] overflow-x-auto whitespace-nowrap">
          {segments.map((s, i) => (
            <React.Fragment key={s.key}>
              <span className="font-medium truncate px-1" style={{ maxWidth: 220 }} title={s.label}>
                {s.label}
              </span>
              {i < segments.length - 1 && <ChevronRight className="h-4 w-4 text-gray-400 mx-1 flex-shrink-0" />}
            </React.Fragment>
          ))}
          <button
            onClick={() => setExpanded(false)}
            className="ml-2 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            title="Collapse path"
          >
            ←
          </button>
        </div>
      )}
    </div>
  );
}

function ReviewReportsPage({ permissions, readonly = false }) {
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

  // attachments cache per reportId
  const [attachmentsMap, setAttachmentsMap] = useState({}); // { [reportId]: [attachments] }
  const [attachmentDownloading, setAttachmentDownloading] = useState({}); // { [attachmentId]: bool }

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

  function formatDateLocal(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // when expanding, prefill admin fields + fetch attachments if needed
  useEffect(() => {
    if (!expanded) return;
    const r = reports.find((x) => x.id === expanded);
    if (!r) return;
    setActionState((s) => ({
      ...s,
      [expanded]: {
        ...(s[expanded] || {}),
        comment: r.adminComment || "",
        deadline: r.resubmissionDeadline ? formatDateLocal(r.resubmissionDeadline) : "",
      },
    }));

    // FETCH ATTACHMENTS if not already cached
    (async () => {
      try {
        if (!attachmentsMap[expanded]) {
          const fetched = await fetchAttachments(expanded);
          // fetched may be array or object; ensure array
          const arr = Array.isArray(fetched) ? fetched : fetched.rows || [];
          setAttachmentsMap((m) => ({ ...m, [expanded]: arr }));
        }
      } catch (err) {
        console.error("fetchAttachments error for report", expanded, err);
        // keep silent; attachments not critical
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  async function handleReview(id, status) {
    const adminComment = actionState[id]?.comment || null;
    const resubmissionDeadline = actionState[id]?.deadline || null;
    const actionKey = status === "Approved" ? "approving" : "rejecting";

    try {
      setActionLoading((s) => ({ ...s, [id]: actionKey }));
      await reviewReport(id, { status, adminComment, resubmissionDeadline });
      await loadReports();
      setActionState((s) => ({
        ...s,
        [id]: {
          ...(s[id] || {}),
          _lastResult: t("reports.action.updatedTo", { status }),
          _lastError: null,
        },
      }));
    } catch (err) {
      console.error("review error", err);
      setActionState((s) => ({
        ...s,
        [id]: {
          ...(s[id] || {}),
          _lastError: err?.message || t("reports.action.failed"),
          _lastResult: null,
        },
      }));
    } finally {
      setActionLoading((s) => ({ ...s, [id]: null }));
    }
  }

  async function handleDownloadAttachment(attachment) {
    if (!attachment || !attachment.id) return;
    const aid = attachment.id;
    try {
      setAttachmentDownloading((s) => ({ ...s, [aid]: true }));
      const res = await downloadAttachment(aid);
      if (res && res.url) {
        // open signed url in new tab
        window.open(res.url, "_blank");
      } else if (res && res.blob) {
        const blob = res.blob;
        const filename = res.filename || attachment.fileName || attachment.attachment_name || `attachment_${aid}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        // fallback: open direct endpoint (browser will attempt download)
        window.open(`/api/reports/attachments/${encodeURIComponent(aid)}/download`, "_blank");
      }
    } catch (err) {
      console.error("downloadAttachment error", err);
      alert(err?.message || "Download failed");
    } finally {
      setAttachmentDownloading((s) => ({ ...s, [aid]: false }));
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

  // Header text: use different title when readonly for users
  const headerTitle = readonly ? t("reports.myReports.title", "My Reports") : t("reports.review.title");
  const headerSubtitle = readonly
    ? t("reports.myReports.subtitle", "Your submitted reports and their review status.")
    : t("reports.review.subtitle");

  return (
    <div className="bg-white dark:bg-gray-800 p-4 md:p-6 lg:p-7 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 dark:text-gray-100">{headerTitle}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">{headerSubtitle}</p>
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="opacity-80">
              <path d="M21 12A9 9 0 1 0 6 20.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
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
                statusFilter === s.id ? "bg-sky-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {t(s.key)}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-gray-500 dark:text-gray-400">{t("reports.pagination.showingPage", { page, totalPages, total })}</div>
      </div>

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: Math.min(5, pageSize) }).map((_, i) => (
            <div key={`skeleton-${i}`} className="border rounded-lg overflow-hidden animate-pulse">
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
            {reports.map((r) => {
              const isLoading = !!actionLoading[r.id];
              const approving = actionLoading[r.id] === "approving";
              const rejecting = actionLoading[r.id] === "rejecting";
              return (
                <div key={r.id} className="border rounded-lg overflow-hidden transition-all">
                  <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 md:gap-4">
                        <div className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">Report #{r.id}</div>
                        <div
                          className={`px-2 py-1 md:px-3 md:py-1.5 rounded-full text-xs md:text-sm font-medium ${
                            r.status === "Approved"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : r.status === "Rejected"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}
                        >
                          {t(`reports.status.${r.status}`, { defaultValue: r.status })}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:justify-between gap-x-4 gap-y-1 mt-2">
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center flex-wrap min-w-0">
                          {r.group_name && (
                            <>
                              <BreadcrumbsCompact
                                group_name={r.group_name}
                                goal_title={r.goal_title}
                                task_title={r.task_title}
                                activity_title={r.activity_title}
                              />
                              <ChevronRight className="h-4 w-4 text-gray-400 mx-1 flex-shrink-0" />
                            </>
                          )}

                          {/* final activity title shown as bold (if not inside BreadcrumbsCompact) */}
                          {!r.group_name && (
                            <span className="text-gray-800 dark:text-gray-100 font-semibold truncate" title={r.activity_title || "Activity"}>
                              {r.activity_title || "Activity"}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full whitespace-nowrap self-start sm:self-center">
                          <User className="h-3.5 w-3.5" />
                          <span>{r.user_name || "Unknown User"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 items-center pl-4">
                      <button
                        onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                        aria-expanded={expanded === r.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <svg className={`transition-transform ${expanded === r.id ? "rotate-180" : "rotate-0"}`} width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {expanded === r.id && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 space-y-4">
                      <div>
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t("reports.narrative")}</div>
                        <div className="text-sm md:text-base text-gray-700 dark:text-gray-200 mt-1 whitespace-pre-wrap p-2 bg-white dark:bg-gray-900/30 rounded border border-gray-200 dark:border-gray-700">
                          {r.narrative || <em className="text-gray-400">{t("reports.noNarrative")}</em>}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t("reports.metrics.title", "Current Metrics")}</div>
                        <div className="mt-2">{renderMetricsList(r.metrics_data)}</div>
                      </div>

                      {((attachmentsMap[r.id] && attachmentsMap[r.id].length) || (Array.isArray(r.attachments) && r.attachments.length)) && (
                        <div>
                          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t("reports.attachments")}</div>
                          <ul className="mt-2 space-y-2">
                            {((attachmentsMap[r.id] && attachmentsMap[r.id].length ? attachmentsMap[r.id] : r.attachments) || []).map((a) => (
                              <li key={a.id} className="flex items-center justify-between gap-3 p-2 bg-white dark:bg-gray-900/30 rounded border border-gray-200 dark:border-gray-700">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleDownloadAttachment(a);
                                  }}
                                  className="text-left text-sky-600 dark:text-sky-400 hover:underline text-sm flex-1 truncate"
                                  title={a.fileName || a.attachment_name || `attachment-${a.id}`}
                                >
                                  {a.fileName || a.attachment_name || `attachment-${a.id}`}
                                </button>

                                <div className="flex items-center gap-2">
                                  {a.size && <div className="text-xs text-gray-400 hidden sm:inline">{(a.size / 1024).toFixed(1)} KB</div>}
                                  {a.mimeType && <div className="text-xs text-gray-400 hidden sm:inline">{a.mimeType}</div>}
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleDownloadAttachment(a);
                                    }}
                                    className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-xs"
                                    aria-label={`Download ${a.fileName || a.attachment_name || a.id}`}
                                  >
                                    {attachmentDownloading[a.id] ? <Loader className="h-4 w-4 animate-spin" /> : t("reports.attachments.download", "Download")}
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {!readonly ? (
                        <div className="pt-2">
                          <div className="flex flex-col md:flex-row md:items-start gap-3">
                            <textarea
                              rows={3}
                              placeholder={t("reports.adminComment_placeholder.placeholder")}
                              value={actionState[r.id]?.comment || ""}
                              onChange={(e) =>
                                setActionState((s) => ({
                                  ...s,
                                  [r.id]: { ...(s[r.id] || {}), comment: e.target.value },
                                }))
                              }
                              className="flex-1 px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-y"
                              disabled={isLoading}
                              aria-label={t("reports.adminComment_placeholder.placeholder")}
                            />

                            <div className="w-full md:w-56 flex flex-col gap-2">
                              <input
                                type="date"
                                value={actionState[r.id]?.deadline || ""}
                                onChange={(e) =>
                                  setActionState((s) => ({
                                    ...s,
                                    [r.id]: { ...(s[r.id] || {}), deadline: e.target.value },
                                  }))
                                }
                                className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent w-full"
                                disabled={isLoading}
                                aria-label={t("reports.deadline")}
                              />

                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleReview(r.id, "Approved")}
                                  className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-green-700 transition-colors disabled:opacity-60"
                                  disabled={isLoading}
                                  aria-busy={approving}
                                >
                                  {approving ? <Loader className="h-4 w-4 animate-spin" /> : t("reports.actions.approve")}
                                </button>

                                <button
                                  onClick={() => handleReview(r.id, "Rejected")}
                                  className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-red-700 transition-colors disabled:opacity-60"
                                  disabled={isLoading}
                                  aria-busy={rejecting}
                                >
                                  {rejecting ? <Loader className="h-4 w-4 animate-spin" /> : t("reports.actions.reject")}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 pt-2">
                          {r.adminComment && (
                            <div>
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t("reports.adminComment")}</div>
                              <div className="mt-1 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900/50 p-2 rounded">{r.adminComment}</div>
                            </div>
                          )}

                          {r.resubmissionDeadline && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {t("reports.resubmissionDeadline")}: {new Date(r.resubmissionDeadline).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      )}

                      {actionState[r.id]?._lastResult && <div className="text-sm text-green-700 dark:text-green-300">{actionState[r.id]._lastResult}</div>}
                      {actionState[r.id]?._lastError && <div className="text-sm text-red-600 dark:text-red-400">{actionState[r.id]._lastError}</div>}
                    </div>
                  )}
                </div>
              );
            })}
            {reports.length === 0 && !loading && <div className="text-center text-gray-500 dark:text-gray-400 py-6">{t("reports.noReports")}</div>}
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
          <label className="text-sm text-gray-500 dark:text-gray-400">{t("reports.pageSize")}</label>
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
 NEW HELPERS: extraction + parsing
------------------------- */

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
 REWRITTEN: reliable period lookup + latest metric extraction
------------------------- */

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
Master Report page wrapper
------------------------- */
function MasterReportPageWrapper() {
  const { t } = useTranslation();

  const [groupId, setGroupId] = useState("");
  const [loading, setLoading] = useState(false);
  const [master, setMaster] = useState(null);
  const [error, setError] = useState(null);
  const [granularity, setGranularity] = useState("monthly");

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
@media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p style="margin-top:2px;margin-bottom:8px">${escapeHtml(groupLabel)}: ${escapeHtml(String(groupId || "All"))} • ${escapeHtml(generated)}</p>

<section>
<h2>${escapeHtml(narratives)}</h2>
${data.goals
      .map(
        (g, goalIndex) => {
          const goalNum = `${goalIndex + 1}`;
          return `
<div style="margin-bottom:12px;padding:10px;border:1px solid #eee;border-radius:6px;background:#fbfbfb">
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

  function exportCSV() {
    if (!master) return alert(t("reports.master.loadFirstAlert"));
    const periods = periodColumns;
    const headers = [t("reports.table.type"), t("reports.table.goal"), t("reports.table.task"), t("reports.table.activity"), t("reports.table.weight"), t("reports.table.metric"), t("reports.table.target"), ...periods];
    const rows = [];
    master.goals.forEach((g, goalIndex) => {
      const goalNum = `${goalIndex + 1}`;
      const goalRow = [t("reports.table.goal"), `${goalNum}. ${g.title}`, "", "", g.weight ?? "", "", "", ...periods.map(() => "")];
      rows.push(goalRow);
      (g.tasks || []).forEach((task, taskIndex) => {
        const taskNum = `${goalNum}.${taskIndex + 1}`;
        const taskRow = [t("reports.table.task"), `${goalNum}. ${g.title}`, `${taskNum}. ${task.title}`, "", task.weight ?? "", "", "", ...periods.map(() => "")];
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
          const actRow = [t("reports.table.activity"), `${goalNum}. ${g.title}`, `${taskNum}. ${task.title}`, `${activityNum}. ${a.title}`, a.weight ?? "", mk ?? "", target ?? "", ...periodVals];
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

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-5">
        <div className="md:col-span-3">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">{t("reports.master.groupIdLabel")}</label>
          <input value={groupId} onChange={(e) => setGroupId(e.target.value)} placeholder={t("reports.master.groupIdPlaceholder")} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
          {error && <div className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</div>}
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
              <button key={g} onClick={() => setGranularity(g)} className={`px-3 py-1.5 rounded-lg transition-colors ${granularity === g ? "bg-sky-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
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
Main wrapper - switch between review & master
------------------------- */
export default function ReportsUI() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [page, setPage] = useState("review");

  const isAdmin = Array.isArray(user?.permissions) && user.permissions.includes("manage_reports");

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 p-4 md:p-6 lg:p-8 max-w-8xl mx-auto transition-colors duration-200">
      <header className="mb-6 md:mb-8">
        <div className="flex items-start md:items-center justify-between gap-4">
          <div className="flex items-center min-w-0 gap-4">
            <div className="p-3 rounded-lg bg-white dark:bg-gray-800">
              <FileText className="h-6 w-6 text-sky-600 dark:text-sky-300" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-gray-100 truncate">{t("reports.header.title")}</h1>
              <p className="text-base text-gray-600 dark:text-gray-300 mt-2">{t("reports.header.subtitle")}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            {isAdmin && (
              <div className="mt-4 hidden md:block">
                <TabsPills value={page} onChange={setPage} />
              </div>
            )}
            <div className="flex-shrink-0 ml-4">
              <TopBar />
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="md:hidden">
            <TabsPills value={page} onChange={setPage} />
          </div>
        )}
      </header>

      {isAdmin ? (
        page === "review" ? (
          <ReviewReportsPage permissions={user.permissions} readonly={false} />
        ) : (
          <MasterReportPageWrapper />
        )
      ) : (
        // Non-admin users see read-only "My Reports" page
        <ReviewReportsPage permissions={user?.permissions} readonly={true} />
      )}

      <footer className="flex justify-center mt-10 md:mt-14 text-center text-gray-500 dark:text-gray-400 text-sm">
        <p>© {new Date().getFullYear()} {t("reports.footer.systemName")} | v2.0</p>
      </footer>
    </div>
  );
}
