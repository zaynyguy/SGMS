import React, { useState, useEffect } from "react";
import { Loader, ChevronRight, User, CheckCircle, Eye, Info } from "lucide-react";
import { fetchReports, reviewReport } from "../api/reports";
import { fetchAttachments, downloadAttachment } from "../api/attachments";
import { useTranslation } from "react-i18next";
import { fetchGroups } from "../api/groups";
import Toast from "../components/common/Toast";

/* -------------------------
REVIEW PAGE
MODIFIED:
- Subtler animations and shorter durations.
- Attachment hover/sizes toned down (smaller scale, smaller shadows).
- Filenames and narrative now break long unbroken text so they don't overflow horizontally.
- Admin textarea limited by viewport height (max-h) and made to scroll when very long.
------------------------- */

function BreadcrumbsCompact({ group_name, goal_title, task_title, activity_title }) {
  const segments = [
    { label: group_name || null, key: "group" },
    { label: goal_title || null, key: "goal" },
    { label: task_title || null, key: "task" },
    { label: activity_title || null, key: "activity" },
  ].filter((s) => s.label);

  const [expanded, setExpanded] = useState(false);
  if (segments.length === 0) return null;

  if (segments.length <= 3) {
    return (
      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 min-w-0 flex-wrap transition-all duration-150">
        {segments.map((s, i) => (
          <React.Fragment key={s.key}>
            <span
              className="font-medium truncate max-w-[180px] transition-all duration-150 hover:text-gray-800 dark:hover:text-gray-100"
              title={s.label}
            >
              {s.label}
            </span>
            {i < segments.length - 1 && (
              <ChevronRight className="h-4 w-4 text-gray-400 mx-0.5 flex-shrink-0 transition-transform duration-150" />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  const first = segments[0];
  const last = segments[segments.length - 1];
  const middle = segments.slice(1, segments.length - 1);

  return (
    <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 min-w-0 flex-wrap transition-all duration-150">
      {/* Always render first segment */}
      <span
        className="font-medium truncate max-w-[160px] transition-all duration-150 hover:text-gray-800 dark:hover:text-gray-100"
        title={first.label}
      >
        {first.label}
      </span>
      <ChevronRight className="h-4 w-4 text-gray-400 mx-0.5 flex-shrink-0 transition-transform duration-150" />

      {!expanded ? (
        <>
          <button
            onClick={() => setExpanded(true)}
            aria-expanded={expanded}
            className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-150 transform hover:scale-[1.01] active:scale-100"
            title="Show full path"
          >
            …
          </button>
          <ChevronRight className="h-4 w-4 text-gray-400 mx-0.5 flex-shrink-0 transition-transform duration-150" />
        </>
      ) : (
        <>
          {/* Render middle segments when expanded */}
          {middle.map((s) => (
            <React.Fragment key={s.key}>
              <span
                className="font-medium truncate max-w-[180px] transition-all duration-150 hover:text-gray-800 dark:hover:text-gray-100"
                title={s.label}
              >
                {s.label}
              </span>
              <ChevronRight className="h-4 w-4 text-gray-400 mx-0.5 flex-shrink-0 transition-transform duration-150" />
            </React.Fragment>
          ))}
        </>
      )}

      {/* Always render last segment (if different from first) */}
      {segments.length > 1 && (
        <span
          className="font-medium truncate max-w-[160px] transition-all duration-150 hover:text-gray-800 dark:hover:text-gray-100"
          title={last.label}
        >
          {last.label}
        </span>
      )}

      {/* Show collapse button if expanded */}
      {expanded && (
        <button
          onClick={() => setExpanded(false)}
          className="ml-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-150 transform hover:scale-[1.01] active:scale-100"
          title="Collapse path"
        >
          &lt;
        </button>
      )}
    </div>
  );
}

export default function ReviewReportsPage({ permissions, readonly = false }) {
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

  // groups for filtering
  const [groups, setGroups] = useState([]);
  const [groupFilter, setGroupFilter] = useState("All");

  // attachments cache per reportId
  const [attachmentsMap, setAttachmentsMap] = useState({});
  const [attachmentDownloading, setAttachmentDownloading] = useState({});
  const [attachmentPreviewing, setAttachmentPreviewing] = useState({}); // New state for preview loading

  // Toast state
  const [toast, setToast] = useState(null); // { text, type }
  const showToast = (message, semanticType = "info") => {
    const map = { success: "create", info: "read", update: "update", delete: "delete", error: "error" };
    const tType = map[semanticType] || semanticType || "create";
    setToast({ text: message, type: tType });
  };
  const handleToastClose = () => setToast(null);

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter, groupFilter]);

  // Load group options for the group filter.
  useEffect(() => {
    async function loadGroups() {
      try {
        const res = await fetchGroups();
        const items = Array.isArray(res) ? res : res?.rows ?? [];
        const normalized = items
          .map((g) => (g && g.id ? { id: g.id, name: g.name || String(g.id) } : null))
          .filter(Boolean);

        setGroups([{ id: "All", name: t("reports.filters.groupAll", "All Groups") }, ...normalized]);
      } catch (err) {
        console.error("Failed to fetch groups for filter:", err);
        setGroups([{ id: "All", name: t("reports.filters.groupAll", "All Groups") }]);
      }
    }
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]); // Run once on load

  async function loadReports(opts = {}) {
    setLoading(true);
    try {
      const usePage = opts.page || page;
      const useSize = opts.pageSize || pageSize;
      const status = statusFilter === "All" ? undefined : statusFilter;
      const q = opts.q !== undefined ? opts.q : search ? search : undefined;

      // call backend (expected signature fetchReports(page, pageSize, status, q))
      // This now returns activity_target_metric and activity_current_metric
      const data = await fetchReports(usePage, useSize, status, q);

      // Ensure rows array
      const rows = Array.isArray(data.rows) ? data.rows : Array.isArray(data) ? data : [];

      // If groupFilter is set, apply client-side filtering (robust if backend doesn't accept group param)
      const filteredRows = groupFilter && groupFilter !== "All" ? rows.filter((r) => String(r.group_id) === String(groupFilter)) : rows;

      setReports(filteredRows);
      setPage(data.page || usePage);
      setPageSize(data.pageSize || useSize);
      setTotal(data.total || filteredRows.length || 0);
    } catch (err) {
      console.error("loadReports error:", err);
      setReports([]);
      setTotal(0);
      showToast(err?.message || t("reports.loadFailed", "Failed to load reports"), "error");
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

    (async () => {
      try {
        if (!attachmentsMap[expanded]) {
          const fetched = await fetchAttachments(expanded);
          const arr = Array.isArray(fetched) ? fetched : fetched.rows || [];
          setAttachmentsMap((m) => ({ ...m, [expanded]: arr }));
        }
      } catch (err) {
        console.error("fetchAttachments error for report", expanded, err);
        showToast(err?.message || t("reports.attachments.fetchFailed", "Failed to load attachments"), "error");
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
      // reload current page after action
      await loadReports();
      setActionState((s) => ({
        ...s,
        [id]: {
          ...(s[id] || {}),
          _lastResult: t("reports.action.updatedTo", { status }),
          _lastError: null,
        },
      }));
      showToast(t("reports.action.updatedTo", { status }), "update");
    } catch (err) {
      console.error("review error", err);
      setActionState((s) => ({
        ...s,
        [id]: {
          ...(s[id] || {}),
          _lastError: err?.message || t("reports.action.failed", "Action failed"),
          _lastResult: null,
        },
      }));
      showToast(err?.message || t("reports.action.failed", "Action failed"), "error");
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
        window.open(`/api/reports/attachments/${encodeURIComponent(aid)}/download`, "_blank");
      }
    } catch (err) {
      console.error("downloadAttachment error", err);
      showToast(err?.message || t("reports.attachments.downloadFailed", "Download failed"), "error");
    } finally {
      setAttachmentDownloading((s) => ({ ...s, [aid]: false }));
    }
  }

  // New function for handling previews
  async function handlePreviewAttachment(attachment) {
    if (!attachment || !attachment.id) return;
    const aid = attachment.id;
    try {
      setAttachmentPreviewing((s) => ({ ...s, [aid]: true }));
      const res = await downloadAttachment(aid); // Re-use the same download API

      if (res && res.url) {
        // If API provides a direct URL, open it
        window.open(res.url, "_blank");
      } else if (res && res.blob) {
        // If API provides a blob, check if it's a type the browser can preview
        const blob = res.blob;
        const mimeType = blob.type || attachment.mimeType;
        const previewableTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "text/plain", "image/svg+xml"];

        if (previewableTypes.includes(mimeType)) {
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
          // Note: This URL is not revoked, which is a minor memory leak,
          // but required to keep the blob alive for the new tab.
        } else {
          // If not previewable (e.g., .zip, .docx), just trigger the original download
          handleDownloadAttachment(attachment);
        }
      } else {
        // Fallback to the generic download endpoint, attempting to open in new tab
        window.open(`/api/reports/attachments/${encodeURIComponent(aid)}/download`, "_blank");
      }
    } catch (err) {
      console.error("previewAttachment error", err);
      showToast(err?.message || t("reports.attachments.previewFailed", "Preview failed. Please try downloading."), "error");
    } finally {
      setAttachmentPreviewing((s) => ({ ...s, [aid]: false }));
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
    <div className="bg-white dark:bg-gray-800 p-4 md:p-6 lg:p-7 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 transition-all duration-150">
      {/* Enhanced Toast with subtle animations */}
      {toast && (
        <div className="fixed z-50 right-5 bottom-5 animate-slide-in-right">
          <Toast message={toast.text} type={toast.type} onClose={handleToastClose} />
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.995);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes slideOutDown {
          to {
            opacity: 0;
            transform: translateY(8px) scale(0.995);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.01); }
        }
        @keyframes bounce {
          0%, 20%, 53%, 80%, 100% {
            transform: translate3d(0,0,0);
          }
          40%, 43% {
            transform: translate3d(0, -6px, 0);
          }
          70% {
            transform: translate3d(0, -3px, 0);
          }
          90% {
            transform: translate3d(0, -1px, 0);
          }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .animate-slide-in-up {
          animation: slideInUp 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .animate-slide-out-down {
          animation: slideOutDown 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
        .animate-pulse-custom {
          animation: pulse 3s infinite;
        }
        .animate-bounce-custom {
          animation: bounce 0.9s ease-in-out;
        }
        .animate-shake {
          animation: shake 0.35s ease-in-out;
        }
        .report-item-enter {
          animation: slideInUp 0.25s ease-out forwards;
        }
        .attachment-item-enter {
          animation: slideInUp 0.22s ease-out;
        }
      `}</style>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5 animate-fade-in">
        <div className="transition-all duration-150 transform origin-left">
          <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 dark:text-gray-100 transition-colors duration-150">
            {readonly ? t("reports.myReports.title", "My Reports") : t("reports.review.title")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-300 mt-1 transition-colors duration-150">
            {readonly ? t("reports.myReports.subtitle", "Your submitted reports and their review status.") : t("reports.review.subtitle")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full lg:w-auto transition-all duration-150">
          <div className="flex-1 min-w-0 transition-all duration-150">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={t("reports.search.placeholder")}
              className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 min-w-0 focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all duration-150 hover:border-gray-400 dark:hover:border-gray-500"
            />
          </div>

          <button
            onClick={() => {
              setPage(1);
              loadReports({ page: 1, q: search });
            }}
            className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 dark:text-white text-sm whitespace-nowrap hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-150 transform hover:scale-[1.01] active:scale-100 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 transition-transform duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {t("reports.search.button")}
          </button>
          <button
            onClick={handleRefresh}
            className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 dark:text-white text-sm whitespace-nowrap flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-150 transform hover:scale-[1.01] active:scale-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="opacity-80 transition-transform duration-150 hover:rotate-180">
              <path d="M21 12A9 9 0 1 0 6 20.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("reports.refresh")}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 animate-fade-in">
        <div className="flex flex-wrap gap-2 items-center transition-all duration-150">
          {statusOptions.map((s, index) => (
            <button
              key={s.id}
              onClick={() => {
                setPage(1);
                setStatusFilter(s.id);
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 transform ${
                statusFilter === s.id 
                  ? "bg-sky-600 text-white shadow-sm animate-pulse-custom" 
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {t(s.key)}
            </button>
          ))}

          {/* Enhanced Group Filter Select */}
          <select
            value={groupFilter}
            onChange={(e) => {
              setPage(1);
              setGroupFilter(e.target.value);
            }}
            className="ml-2 px-3 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-150 transform hover:scale-[1.01]"
            aria-label={t("reports.filters.groupLabel", "Group")}
          >
            {groups && groups.length > 0
              ? groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))
              : <option value="All">{t("reports.filters.groupAll", "All Groups")}</option>
            }
          </select>
        </div>
        <div className="ml-auto text-xs text-gray-500 dark:text-gray-400 transition-colors duration-150">
          {t("reports.pagination.showingPage", { page, totalPages, total })}
        </div>
      </div>

      <div className="space-y-4 transition-all duration-150">
        {loading ? (
          Array.from({ length: Math.min(5, pageSize) }).map((_, i) => (
            <div 
              key={`skeleton-${i}`} 
              className="border rounded-lg overflow-hidden animate-pulse transition-all duration-150 transform hover:scale-[1.01]"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900">
                <div className="min-w-0 w-full">
                  <div className="flex items-center gap-4">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24 transition-colors duration-150"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 transition-colors duration-150"></div>
                  </div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-40 mt-3 transition-colors duration-150"></div>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded transition-colors duration-150"></div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2 transition-colors duration-150"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full transition-colors duration-150"></div>
              </div>
            </div>
          ))
        ) : (
          <>
            {reports.map((r, index) => {
              const isLoading = !!actionLoading[r.id];
              const approving = actionLoading[r.id] === "approving";
              const rejecting = actionLoading[r.id] === "rejecting";

              const isDone = String(r.new_status || "").toLowerCase() === "done";

              return (
                <div 
                  key={r.id} 
                  className="report-item-enter border rounded-lg overflow-hidden transition-all duration-150 transform hover:scale-[1.01] hover:shadow-sm group relative"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  {isDone && (
                    <div className="absolute top-3 left-0 -translate-x-4 -rotate-12 bg-green-600 text-white text-xs font-bold px-3 py-0.5 rounded shadow-sm animate-bounce-custom" title={t("reports.newStatusDoneTooltip", "This report marked as Done (finalized)")}>
                      DONE
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 transition-colors duration-150 group-hover:bg-gray-50 dark:group-hover:bg-gray-800/50">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 md:gap-4">
                        <div className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 transition-colors duration-150 group-hover:text-sky-600 dark:group-hover:text-sky-400">
                          Report #{r.id}
                        </div>
                        <div
                          className={`px-2 py-1 md:px-3 md:py-1.5 rounded-full text-xs md:text-sm font-medium transition-all duration-150 transform hover:scale-[1.01] ${
                            r.status === "Approved"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
                              : r.status === "Rejected"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 animate-pulse-custom"
                          }`}
                        >
                          {t(`reports.status.${r.status}`, { defaultValue: r.status })}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:justify-between gap-x-4 gap-y-1 mt-2">
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center flex-wrap min-w-0 transition-colors duration-150 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                          {r.group_name ? (
                            <BreadcrumbsCompact
                              group_name={r.group_name}
                              goal_title={r.goal_title}
                              task_title={r.task_title}
                              activity_title={r.activity_title}
                            />
                          ) : (
                            <span className="text-gray-800 dark:text-gray-100 font-semibold truncate transition-colors duration-150 group-hover:text-sky-600 dark:group-hover:text-sky-400" title={r.activity_title || "Activity"}>
                              {r.activity_title || "Activity"}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full whitespace-nowrap self-start sm:self-center transition-all duration-150 transform hover:scale-[1.01]">
                          <User className="h-3.5 w-3.5 transition-transform duration-150" />
                          <span>{r.user_name || "Unknown User"}</span>

                          {isDone && (
                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs transition-all duration-150 transform hover:scale-[1.01]" title={t("reports.newStatusDoneTooltip", "This report marked as Done (finalized). Approving this runs progress calculations across the system.")}>
                              <CheckCircle className="h-3.5 w-3.5 transition-transform duration-150" />
                              <span className="font-semibold">{t("reports.done", "Done")}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 items-center pl-4">
                      <button
                        onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                        aria-expanded={expanded === r.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-150 transform hover:scale-[1.02] active:scale-100"
                      >
                        <svg 
                          className={`transition-transform duration-150 ${expanded === r.id ? "rotate-180" : "rotate-0"}`} 
                          width="18" 
                          height="18" 
                          viewBox="0 0 24 24" 
                          fill="none"
                        >
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {expanded === r.id && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 space-y-4 animate-slide-in-up">
                      {/* Enhanced Activity Context Section */}
                      {!readonly && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg transition-all duration-150 transform hover:scale-[1.01]">
                          <div className="flex items-center gap-2 mb-3">
                            <Info className="h-5 w-5 text-blue-600 dark:text-blue-300 transition-transform duration-150 hover:scale-[1.02]" />
                            <h4 className="text-base font-semibold text-blue-800 dark:text-blue-200 transition-colors duration-150">
                              {t("reports.activityContext.title", "Activity Context")}
                            </h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="transition-all duration-150 hover:scale-[1.01] transform origin-left">
                              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 transition-colors duration-150">
                                {t("reports.activityContext.target", "Activity Target")}
                              </div>
                              <div className="mt-2">{renderMetricsList(r.activity_target_metric)}</div>
                            </div>
                            <div className="transition-all duration-150 hover:scale-[1.01] transform origin-left">
                              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 transition-colors duration-150">
                                {t("reports.activityContext.current", "Activity Current (Before Report)")}
                              </div>
                              <div className="mt-2">{renderMetricsList(r.activity_current_metric)}</div>
                            </div>
                          </div>
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-3 transition-colors duration-150">
                            {t("reports.activityContext.help", "This shows the activity's metrics *before* this report is applied. Approving the report will add the new metrics to the 'Current' values.")}
                          </p>
                        </div>
                      )}
                      {/* --- END NEW SECTION --- */}

                      <div className="transition-all duration-150 hover:scale-[1.01] transform origin-left">
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 transition-colors duration-150">
                          {t("reports.narrative")}
                        </div>
                        <div
                          className="text-sm md:text-base text-gray-700 dark:text-gray-200 mt-1 p-2 bg-white dark:bg-gray-900/30 rounded border border-gray-200 dark:border-gray-700 transition-all duration-150 hover:border-gray-300 dark:hover:border-gray-600 break-words max-w-full"
                          style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
                        >
                          {r.narrative || <em className="text-gray-400 transition-colors duration-150">{t("reports.noNarrative")}</em>}
                        </div>
                      </div>

                      <div className="transition-all duration-150 hover:scale-[1.01] transform origin-left">
                        {/* MODIFIED: Label clarifies these are the report's metrics */}
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 transition-colors duration-150">
                          {t("reports.reportMetrics", "Metrics in this Report")}
                        </div>
                        <div className="mt-2">{renderMetricsList(r.metrics_data)}</div>
                      </div>

                      {((attachmentsMap[r.id] && attachmentsMap[r.id].length) || (Array.isArray(r.attachments) && r.attachments.length)) && (
                        <div className="transition-all duration-150">
                          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 transition-colors duration-150">
                            {t("reports.attachments")}
                          </div>
                          <ul className="mt-2 space-y-2">
                            {((attachmentsMap[r.id] && attachmentsMap[r.id].length ? attachmentsMap[r.id] : r.attachments) || []).map((a, idx) => (
                              <li 
                                key={a.id} 
                                className="attachment-item-enter flex items-center justify-between gap-3 p-2 bg-white dark:bg-gray-900/30 rounded border border-gray-200 dark:border-gray-700 transition-all duration-150 transform hover:scale-[1.01] hover:shadow-sm"
                                style={{ animationDelay: `${idx * 40}ms` }}
                              >
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleDownloadAttachment(a); // This button can still be the filename
                                  }}
                                  className="text-left text-sky-600 dark:text-sky-400 hover:underline text-sm flex-1 break-words overflow-hidden transition-all duration-150"
                                  title={a.fileName || a.attachment_name || `attachment-${a.id}`}
                                  style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
                                >
                                  {a.fileName || a.attachment_name || `attachment-${a.id}`}
                                </button>

                                <div className="flex items-center gap-2">
                                  {a.size && <div className="text-xs text-gray-400 hidden sm:inline transition-colors duration-150">{(a.size / 1024).toFixed(1)} KB</div>}
                                  {a.mimeType && <div className="text-xs text-gray-400 hidden sm:inline transition-colors duration-150">{a.mimeType}</div>}
                                  {/* ENHANCED PREVIEW BUTTON */}
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handlePreviewAttachment(a);
                                    }}
                                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-xs text-gray-700 dark:text-gray-300 transition-all duration-150 transform hover:scale-[1.02] active:scale-100"
                                    aria-label={`Preview ${a.fileName || a.attachment_name || a.id}`}
                                    title={t("reports.attachments.preview", "Preview")}
                                  >
                                    {attachmentPreviewing[a.id] ? <Loader className="h-4 w-4 animate-spin transition-transform duration-150" /> : <Eye className="h-4 w-4 transition-transform duration-150" />}
                                  </button>

                                  {/* ENHANCED DOWNLOAD BUTTON */}
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleDownloadAttachment(a);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 text-xs flex items-center gap-1 transition-all duration-150 transform hover:scale-[1.01] active:scale-100"
                                    aria-label={`Download ${a.fileName || a.attachment_name || a.id}`}
                                    title={t("reports.attachments.download", "Download")}
                                  >
                                    {attachmentDownloading[a.id] ? <Loader className="h-4 w-4 animate-spin transition-transform duration-150" /> : t("reports.attachmentsDownload.download", "Download")}
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {!readonly ? (
                        <div className="pt-2 transition-all duration-150">
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
                              className="flex-1 px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-y transition-all duration-150 hover:border-gray-400 dark:hover:border-gray-500 break-words max-h-[40vh] overflow-auto min-w-0"
                              disabled={isLoading}
                              aria-label={t("reports.adminComment_placeholder.placeholder")}
                            />

                            <div className="w-full md:w-56 flex flex-col gap-2 transition-all duration-150">
                              <input
                                type="date"
                                value={actionState[r.id]?.deadline || ""}
                                onChange={(e) =>
                                  setActionState((s) => ({
                                    ...s,
                                    [r.id]: { ...(s[r.id] || {}), deadline: e.target.value },
                                  }))
                                }
                                className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent w-full transition-all duration-150 hover:border-gray-400 dark:hover:border-gray-500"
                                disabled={isLoading}
                                aria-label={t("reports.deadline")}
                              />

                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleReview(r.id, "Approved")}
                                  className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-green-700 transition-all duration-150 transform hover:scale-[1.01] active:scale-100 disabled:opacity-60 disabled:transform-none"
                                  disabled={isLoading}
                                  aria-busy={approving}
                                >
                                  {approving ? <Loader className="h-4 w-4 animate-spin transition-transform duration-150" /> : t("reports.actions.approve")}
                                </button>

                                <button
                                  onClick={() => handleReview(r.id, "Rejected")}
                                  className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-red-700 transition-all duration-150 transform hover:scale-[1.01] active:scale-100 disabled:opacity-60 disabled:transform-none"
                                  disabled={isLoading}
                                  aria-busy={rejecting}
                                >
                                  {rejecting ? <Loader className="h-4 w-4 animate-spin transition-transform duration-150" /> : t("reports.actions.reject")}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 pt-2 transition-all duration-150">
                          {r.adminComment && (
                            <div className="transition-all duration-150 hover:scale-[1.01] transform origin-left">
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 transition-colors duration-150">
                                {t("reports.adminComment")}
                              </div>
                              <div className="mt-1 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900/50 p-2 rounded transition-colors duration-150 break-words">
                                {r.adminComment}
                              </div>
                            </div>
                          )}

                          {r.resubmissionDeadline && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-150">
                              {t("reports.resubmissionDeadline")}: {new Date(r.resubmissionDeadline).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      )}

                      {actionState[r.id]?._lastResult && (
                        <div className="text-sm text-green-700 dark:text-green-300 transition-all duration-150 animate-slide-in-up">
                          {actionState[r.id]._lastResult}
                        </div>
                      )}
                      {actionState[r.id]?._lastError && (
                        <div className="text-sm text-red-600 dark:text-red-400 transition-all duration-150 animate-shake">
                          {actionState[r.id]._lastError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {reports.length === 0 && !loading && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-6 transition-all duration-150 transform hover:scale-[1.01]">
                {t("reports.noReports")}
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-gray-900 dark:text-gray-300 transition-all duration-150">
        <div className="flex flex-wrap items-center gap-2 transition-all duration-150">
          <button
            disabled={page <= 1}
            onClick={() => {
              setPage(1);
              loadReports({ page: 1 });
            }}
            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-150 transform hover:scale-[1.01] active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {t("reports.pagination.first")}
          </button>
          <button
            disabled={page <= 1}
            onClick={() => {
              const next = Math.max(1, page - 1);
              setPage(next);
              loadReports({ page: next });
            }}
            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-150 transform hover:scale-[1.01] active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {t("reports.pagination.prev")}
          </button>
          <div className="px-3 py-1.5 text-sm transition-colors duration-150">
            {page} / {totalPages}
          </div>
          <button
            disabled={page >= totalPages}
            onClick={() => {
              const next = Math.min(totalPages, page + 1);
              setPage(next);
              loadReports({ page: next });
            }}
            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-150 transform hover:scale-[1.01] active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {t("reports.pagination.next")}
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => {
              setPage(totalPages);
              loadReports({ page: totalPages });
            }}
            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-150 transform hover:scale-[1.01] active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {t("reports.pagination.last")}
          </button>
        </div>

        <div className="flex items-center gap-2 transition-all duration-150">
          <label className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-150">
            {t("reports.pageSize")}
          </label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="px-2 py-1.5 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all duration-150 transform hover:scale-[1.01]"
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
Enhanced helper: render metrics nicely (object or JSON) with subtle animations
------------------------- */
function renderMetricsList(metrics) {
  if (!metrics) return <div className="text-xs text-gray-400 transition-colors duration-150">—</div>;

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
      <div className="text-xs font-mono break-words p-2 bg-white dark:bg-gray-900 rounded border text-gray-800 dark:text-gray-100 transition-all duration-150 transform hover:scale-[1.01]">
        {s}
      </div>
    );
  }

  if (!obj || typeof obj !== "object") {
    return <div className="text-xs text-gray-400 transition-colors duration-150">—</div>;
  }
  const keys = Object.keys(obj);
  if (keys.length === 0) return <div className="text-xs text-gray-400 transition-colors duration-150">—</div>;

  return (
    <div className="space-y-1 transition-all duration-150">
      {keys.map((k, index) => {
        const value = obj[k];
        const displayValue =
          value !== null && typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
        return (
          <div
            key={k}
            className="flex items-start justify-between bg-white dark:bg-gray-900 rounded px-2 py-1 border dark:border-gray-700 gap-4 transition-all duration-150 transform hover:scale-[1.01] hover:shadow-sm"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <div className="text-xs text-gray-600 dark:text-gray-300 pt-px transition-colors duration-150">{k}</div>
            <div className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all text-right whitespace-pre-wrap transition-colors duration-150">
              {displayValue}
            </div>
          </div>
        );
      })}
    </div>
  );
}
