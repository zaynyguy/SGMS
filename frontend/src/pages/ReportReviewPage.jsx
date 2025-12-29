import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader, ChevronRight, User, CheckCircle, Eye, Info, Search, ClipboardCheck } from "lucide-react";
import { fetchReports, reviewReport } from "../api/reports";
import { fetchAttachments, downloadAttachment } from "../api/attachments";
import { useTranslation } from "react-i18next";
import { fetchGroups } from "../api/groups";
import TopBar from "../components/layout/TopBar";
import Toast from "../components/common/Toast";

/* -------------------------
REVIEW PAGE with Material Design 3
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
      <div className="flex items-center gap-1 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 min-w-0 flex-wrap transition-all duration-200">
        {segments.map((s, i) => (
          <React.Fragment key={s.key}>
            <span
              className="font-medium truncate max-w-[140px] transition-all duration-200 hover:text-[var(--on-surface)] dark:hover:text-white"
              title={s.label}
            >
              {s.label}
            </span>
            {i < segments.length - 1 && (
              <ChevronRight className="h-4 w-4 text-[var(--on-surface-variant)] dark:text-gray-400 mx-0.5 flex-shrink-0 transition-transform duration-200" />
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
    <div className="flex items-center gap-1 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 min-w-0 flex-wrap transition-all duration-200">
      <span
        className="font-medium truncate max-w-[120px] transition-all duration-200 hover:text-[var(--on-surface)] dark:hover:text-white"
        title={first.label}
      >
        {first.label}
      </span>
      <ChevronRight className="h-4 w-4 text-[var(--on-surface-variant)] dark:text-gray-400 mx-0.5 flex-shrink-0 transition-transform duration-200" />
      {!expanded ? (
        <>
          <button
            onClick={() => setExpanded(true)}
            aria-expanded={expanded}
            className="px-2 py-0.5 rounded-full bg-[var(--surface-container-low)] dark:bg-gray-700 text-sm text-[var(--on-surface)] dark:text-white hover:bg-[var(--surface-container)] dark:hover:bg-gray-600 transition-all duration-200 transform hover:scale-[1.02] active:scale-100"
            title="Show full path"
          >
            …
          </button>
          <ChevronRight className="h-4 w-4 text-[var(--on-surface-variant)] dark:text-gray-400 mx-0.5 flex-shrink-0 transition-transform duration-200" />
        </>
      ) : (
        <>
          {middle.map((s) => (
            <React.Fragment key={s.key}>
              <span
                className="font-medium truncate max-w-[140px] transition-all duration-200 hover:text-[var(--on-surface)] dark:hover:text-white"
                title={s.label}
              >
                {s.label}
              </span>
              <ChevronRight className="h-4 w-4 text-[var(--on-surface-variant)] dark:text-gray-400 mx-0.5 flex-shrink-0 transition-transform duration-200" />
            </React.Fragment>
          ))}
        </>
      )}
      {segments.length > 1 && (
        <span
          className="font-medium truncate max-w-[120px] transition-all duration-200 hover:text-[var(--on-surface)] dark:hover:text-white"
          title={last.label}
        >
          {last.label}
        </span>
      )}
      {expanded && (
        <button
          onClick={() => setExpanded(false)}
          className="ml-1 px-2 py-0.5 rounded-full bg-[var(--surface-container-low)] dark:bg-gray-700 text-sm text-[var(--on-surface)] dark:text-white hover:bg-[var(--surface-container)] dark:hover:bg-gray-600 transition-all duration-200 transform hover:scale-[1.02] active:scale-100"
          title="Collapse path"
        >
          &lt;
        </button>
      )}
    </div>
  );
}

const App = ({ permissions, readonly = false }) => {
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
  const [attachmentPreviewing, setAttachmentPreviewing] = useState({});
  // Toast state
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => setMounted(false);
  }, []);

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
  }, [t]);

  async function loadReports(opts = {}) {
    setLoading(true);
    try {
      const usePage = opts.page || page;
      const useSize = opts.pageSize || pageSize;
      const status = statusFilter === "All" ? undefined : statusFilter;
      const q = opts.q !== undefined ? opts.q : search ? search : undefined;
      // call backend (expected signature fetchReports(page, pageSize, status, q))
      const data = await fetchReports(usePage, useSize, status, q);
      // Ensure rows array
      const rows = Array.isArray(data.rows) ? data.rows : Array.isArray(data) ? data : [];
      // If groupFilter is set, apply client-side filtering
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
      const res = await downloadAttachment(aid);
      if (res && res.url) {
        window.open(res.url, "_blank");
      } else if (res && res.blob) {
        const blob = res.blob;
        const mimeType = blob.type || attachment.mimeType;
        const previewableTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "text/plain", "image/svg+xml"];
        if (previewableTypes.includes(mimeType)) {
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
        } else {
          // If not previewable, just trigger the original download
          handleDownloadAttachment(attachment);
        }
      } else {
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
    { id: "All", key: "reports.filters.all",
      classes: "bg-sky-100 text-sky-800 hover:bg-sky-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800",
      active: "bg-sky-600 text-white shadow-[0_6px_18px_rgba(0,0,0,0.12)] dark:bg-blue-700 dark:shadow-[0_6px_18px_rgba(0,0,0,0.3)]"
    },
    { id: "Pending", key: "reports.filters.pending",
      classes: "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-yellow-900 dark:text-yellow-200 dark:hover:bg-yellow-800",
      active: "bg-amber-600 text-white shadow-[0_6px_18px_rgba(245,158,11,0.18)] dark:bg-yellow-700 dark:shadow-[0_6px_18px_rgba(245,158,11,0.3)]"
    },
    { id: "Approved", key: "reports.filters.approved",
      classes: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800",
      active: "bg-emerald-600 text-white shadow-[0_6px_18px_rgba(16,185,129,0.18)] dark:bg-green-700 dark:shadow-[0_6px_18px_rgba(16,185,129,0.3)]"
    },
    { id: "Rejected", key: "reports.filters.rejected",
      classes: "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800",
      active: "bg-red-600 text-white shadow-[0_6px_18px_rgba(220,38,38,0.18)] dark:bg-red-700 dark:shadow-[0_6px_18px_rgba(220,38,38,0.3)]"
    },
  ];

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
      `}</style>
      <div className="min-w-7xl mx-auto px-4 py-6">
        {/* Enhanced Toast with subtle animations */}
        {toast &&
          createPortal(
            <div className="z-50 pointer-events-none">
              {/* container that is fixed to viewport.
                  mobile: full-width bottom; desktop: bottom-right small container */}
              <div className="fixed inset-x-0 bottom-0 p-4 md:inset-auto md:right-4 md:bottom-4">
                {/* use pointer-events-auto on the toast itself so buttons stay clickable */}
                <div className="pointer-events-auto">
                  <Toast
                    message={toast.message ?? toast.text}
                    type={toast.type}
                    onClose={handleToastClose}
                  />
                </div>
              </div>
            </div>,
            document.body
          )}
        <div className="mb-6">
          <div className="bg-[var(--on-primary)] dark:bg-gray-800 rounded-2xl dark:border-gray-800 surface-elevation-3 px-4 py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex min-w-0 gap-4 items-center">
                <div className="p-3 rounded-xl bg-[var(--primary-container)] dark:bg-indigo-900">
                  <ClipboardCheck className="h-6 w-6 text-[var(--on-primary-container)] dark:text-indigo-200" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-[var(--on-surface)] dark:text-white truncate transition-colors duration-300">
                    {readonly ? t("reports.myReports.title", "My Reports") : t("reports.review.title")}
                  </h1>
                  <p className="mt-0.5 text-base text-[var(--on-surface-variant)] dark:text-gray-400 max-w-2xl transition-colors duration-300">
                    {readonly ? t("reports.myReports.subtitle", "Your submitted reports and their review status.") : t("reports.review.subtitle")}
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
        <div className="bg-[var(--on-primary)] dark:bg-gray-800 rounded-2xl dark:border-gray-800 surface-elevation-3 p-4 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full">
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-[var(--on-surface-variant)] dark:text-gray-400" />
                  </div>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={onSearchKeyDown}
                    placeholder={t("reports.search.placeholder")}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--outline-variant)] dark:border-gray-600 bg-[var(--on-primary)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white text-base placeholder-[var(--on-surface-variant)] dark:placeholder-gray-400 transition-all duration-300"
                  />
                </div>
              </div>
              {/* keep buttons fixed-size and prevent them from shrinking */}
              <div className="flex gap-3 flex-shrink-0">
                <button
                  onClick={() => {
                    setPage(1);
                    loadReports({ page: 1, q: search });
                  }}
                  className="px-4 py-2.5 rounded-full  bg-[var(--on-primary)] dark:bg-gray-700 border border-[var(--outline-variant)] dark:border-gray-600 text-[var(--on-surface)] dark:text-white hover:bg-[var(--surface-container-high)] dark:hover:bg-gray-600 transition-all duration-300 flex items-center justify-center gap-2 surface-elevation-1 whitespace-nowrap"
                >
                  <Search className="h-4 w-4" />
                  <span className="text-base">{t("reports.search.button")}</span>
                </button>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2.5 rounded-full  bg-[var(--on-primary)] dark:bg-gray-700 border border-[var(--outline-variant)] dark:border-gray-600 text-[var(--on-surface)] dark:text-white hover:bg-[var(--surface-container-high)] dark:hover:bg-gray-600 transition-all duration-300 flex items-center justify-center gap-2 surface-elevation-1 whitespace-nowrap"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="opacity-80 transition-transform duration-300 hover:rotate-180">
                    <path d="M21 12A9 9 0 1 0 6 20.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-base">{t("reports.refresh")}</span>
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-between sm:flex-row sm:items-center gap-3 mb-5">
            <div className="flex flex-wrap gap-2 items-center">
              {statusOptions.map((s, index) => {
                const isActive = statusFilter === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setPage(1); setStatusFilter(s.id); }}
                    aria-pressed={isActive}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                      isActive ? s.active : s.classes
                    }`}
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    {t(s.key)}
                  </button>
                );
              })}
            </div>
            <div>
              <select
                value={groupFilter}
                onChange={(e) => {
                  setPage(1);
                  setGroupFilter(e.target.value);
                }}
                className="px-3 py-1.5 rounded-xl  bg-[var(--on-primary)] dark:bg-gray-700 border border-[var(--outline-variant)] dark:border-gray-600 text-[var(--on-surface)] dark:text-white focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] hover:bg-[var(--surface-container)] dark:hover:bg-gray-600 transition-all duration-300 text-sm"
                aria-label={t("reports.filters.groupLabel", "Group")}
              >
                {groups && groups.length > 0
                  ? groups.map((g) => (
                      <option key={g.id} value={g.id} className="bg-white dark:bg-gray-700">
                        {g.name}
                      </option>
                    ))
                  : <option value="All">{t("reports.filters.groupAll", "All Groups")}</option>
                }
              </select>
            </div>
          </div>
          <div className="space-y-4">
            {loading ? (
              Array.from({ length: Math.min(5, pageSize) }).map((_, i) => (
                <div 
                  key={`skeleton-${i}`} 
                  className="border border-[var(--outline-variant)] dark:border-gray-700 rounded-xl overflow-hidden animate-pulse surface-elevation-1"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-center justify-between p-4 bg-[var(--surface-container-low)] dark:bg-gray-800">
                    <div className="min-w-0 w-full">
                      <div className="flex items-center gap-3">
                        <div className="h-5 bg-[var(--surface-container)] dark:bg-gray-700 rounded w-24"></div>
                        <div className="h-3 bg-[var(--surface-container)] dark:bg-gray-700 rounded w-20"></div>
                      </div>
                      <div className="h-3 bg-[var(--surface-container)] dark:bg-gray-700 rounded w-40 mt-2"></div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="h-6 w-6 bg-[var(--surface-container)] dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                  <div className="p-4 bg-[var(--surface-container-lowest)] dark:bg-gray-800">
                    <div className="h-3 bg-[var(--surface-container)] dark:bg-gray-700 rounded w-full mb-2"></div>
                    <div className="h-3 bg-[var(--surface-container)] dark:bg-gray-700 rounded w-full"></div>
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
                      className="border border-[var(--outline-variant)] dark:border-gray-700 rounded-xl overflow-hidden surface-elevation-1 transition-all duration-200 hover:surface-elevation-2"
                      style={{ animation: `material-in 0.4s ease-out forwards`, animationDelay: `${index * 60}ms` }}
                    >
                      {isDone && (
                        <div className="absolute top-3 left-0 -translate-x-3 -rotate-12 bg-[var(--secondary-container)] dark:bg-blue-900 text-[var(--on-secondary-container)] dark:text-blue-200 text-sm font-bold px-3 py-1 rounded-full shadow-md">
                          DONE
                        </div>
                      )}
                      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 transition-colors duration-200 hover:bg-[var(--surface-container)] dark:hover:bg-gray-700">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-lg font-semibold text-[var(--on-surface)] dark:text-white transition-colors duration-200 hover:text-[var(--primary)] dark:hover:text-green-400">
                              Report #{r.id}
                            </div>
                            <div
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                r.status === "Approved"
                                  ? "bg-[var(--primary-container)] dark:bg-green-900 text-[var(--on-primary-container)] dark:text-green-200"
                                  : r.status === "Rejected"
                                  ? "bg-[var(--error-container)] dark:bg-red-900 text-[var(--on-error-container)] dark:text-red-200"
                                  : "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200"
                              }`}
                            >
                              {t(`reports.status.${r.status}`, { defaultValue: r.status })}
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:justify-between gap-3 mt-2">
                            <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400 flex items-center flex-wrap min-w-0 transition-colors duration-200">
                              {r.group_name ? (
                                <BreadcrumbsCompact
                                  group_name={r.group_name}
                                  goal_title={r.goal_title}
                                  task_title={r.task_title}
                                  activity_title={r.activity_title}
                                />
                              ) : (
                                <span className="text-[var(--on-surface)] dark:text-white font-semibold truncate transition-colors duration-200 hover:text-[var(--primary)] dark:hover:text-green-400" title={r.activity_title || "Activity"}>
                                  {r.activity_title || "Activity"}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 bg-[var(--surface-container)] dark:bg-gray-700 px-2.5 py-1 rounded-full whitespace-nowrap self-start sm:self-center">
                              <User className="h-4 w-4" />
                              <span>{r.user_name || "Unknown User"}</span>
                              {isDone && (
                                <span className="ml-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--secondary-container)] dark:bg-blue-900 text-[var(--on-secondary-container)] dark:text-blue-200 text-sm font-medium" title={t("reports.newStatusDoneTooltip", "This report marked as Done (finalized). Approving this runs progress calculations across the system.")}>
                                  <CheckCircle className="h-4 w-4" />
                                  <span className="font-medium">{t("reports.done", "Done")}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 items-center pl-2">
                          <button
                            onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                            aria-expanded={expanded === r.id}
                            className="flex items-center gap-1 p-2 rounded-full bg-[var(--surface-container)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white hover:bg-[var(--surface-container-high)] dark:hover:bg-gray-600 transition-all duration-200"
                          >
                            <svg 
                              className={`transition-transform duration-200 ${expanded === r.id ? "rotate-180" : ""}`} 
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
                        <div className="p-4 bg-[var(--surface-container-lowest)] dark:bg-gray-800 space-y-4 animate-slide-in-up">
                          {/* Enhanced Activity Context Section */}
                          {!readonly && (
                            <div className="p-3 bg-[var(--secondary-container)] dark:bg-blue-900 border border-[var(--secondary)] dark:border-blue-700 rounded-xl transition-all duration-200">
                              <div className="flex items-center gap-2 mb-3">
                                <Info className="h-5 w-5 text-[var(--on-secondary-container)] dark:text-blue-200" />
                                <h4 className="text-base font-semibold text-[var(--on-secondary-container)] dark:text-blue-200">
                                  {t("reports.activityContext.title", "Activity Context")}
                                </h4>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="transition-all duration-200 hover:scale-[1.01]">
                                  <div className="text-sm font-medium text-[var(--on-surface)] dark:text-white mb-1">
                                    {t("reports.activityContext.target", "Activity Target")}
                                  </div>
                                  <div className="mt-1">{renderMetricsList(r.activity_target_metric)}</div>
                                </div>
                                <div className="transition-all duration-200 hover:scale-[1.01]">
                                  <div className="text-sm font-medium text-[var(--on-surface)] dark:text-white mb-1">
                                    {t("reports.activityContext.current", "Activity Current (Before Report)")}
                                  </div>
                                  <div className="mt-1">{renderMetricsList(r.activity_current_metric)}</div>
                                </div>
                              </div>
                              <p className="text-sm text-[var(--on-secondary-container)] dark:text-blue-200 mt-3">
                                {t("reports.activityContext.help", "This shows the activity's metrics *before* this report is applied. Approving the report will add the new metrics to the 'Current' values.")}
                              </p>
                            </div>
                          )}
                          <div className="transition-all duration-200">
                            <div className="text-sm font-medium text-[var(--on-surface)] dark:text-white mb-1">
                              {t("reports.narrative")}
                            </div>
                            <div
                              className="text-base text-[var(--on-surface-variant)] dark:text-gray-400 mt-1 p-3 bg-[var(--surface-container-low)] dark:bg-gray-700 rounded-xl border border-[var(--outline-variant)] dark:border-gray-600 transition-all duration-200 hover:border-[var(--outline)] dark:hover:border-gray-500 break-words"
                              style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
                            >
                              {r.narrative || <em className="text-[var(--on-surface-variant)] dark:text-gray-500">{t("reports.noNarrative")}</em>}
                            </div>
                          </div>
                          <div className="transition-all duration-200">
                            <div className="text-sm font-medium text-[var(--on-surface)] dark:text-white mb-1">
                              {t("reports.reportMetrics", "Metrics in this Report")}
                            </div>
                            <div className="mt-1">{renderMetricsList(r.metrics_data)}</div>
                          </div>
                          {((attachmentsMap[r.id] && attachmentsMap[r.id].length) || (Array.isArray(r.attachments) && r.attachments.length)) && (
                            <div>
                              <div className="text-sm font-medium text-[var(--on-surface)] dark:text-white mb-2">
                                {t("reports.attachments")}
                              </div>
                              <ul className="space-y-2">
                                {((attachmentsMap[r.id] && attachmentsMap[r.id].length ? attachmentsMap[r.id] : r.attachments) || []).map((a, idx) => (
                                  <li 
                                    key={a.id} 
                                    className="flex items-center justify-between gap-3 p-3 bg-[var(--surface-container-low)] dark:bg-gray-700 rounded-xl border border-[var(--outline-variant)] dark:border-gray-600 transition-all duration-200 hover:surface-elevation-1"
                                    style={{ animationDelay: `${idx * 30}ms` }}
                                  >
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleDownloadAttachment(a);
                                      }}
                                      className="text-left text-[var(--primary)] dark:text-green-400 hover:underline text-base flex-1 break-words overflow-hidden transition-all duration-200"
                                      title={a.fileName || a.attachment_name || `attachment-${a.id}`}
                                      style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
                                    >
                                      {a.fileName || a.attachment_name || `attachment-${a.id}`}
                                    </button>
                                    <div className="flex items-center gap-2">
                                      {a.size && <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400 hidden sm:inline">{(a.size / 1024).toFixed(1)} KB</div>}
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          handlePreviewAttachment(a);
                                        }}
                                        className="p-2 rounded-full bg-[var(--surface-container)] dark:bg-gray-700 hover:bg-[var(--surface-container-high)] dark:hover:bg-gray-600 text-[var(--on-surface)] dark:text-white transition-all duration-200"
                                        aria-label={`Preview ${a.fileName || a.attachment_name || a.id}`}
                                        title={t("reports.attachments.preview", "Preview")}
                                      >
                                        {attachmentPreviewing[a.id] ? <Loader className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          handleDownloadAttachment(a);
                                        }}
                                        className="px-3 py-1.5 rounded-full bg-[var(--surface-container-lowest)] dark:bg-gray-800 border border-[var(--outline-variant)] dark:border-gray-600 text-[var(--on-surface)] dark:text-white hover:bg-[var(--surface-container-low)] dark:hover:bg-gray-700 text-sm flex items-center gap-1 transition-all duration-200"
                                        aria-label={`Download ${a.fileName || a.attachment_name || a.id}`}
                                        title={t("reports.attachments.download", "Download")}
                                      >
                                        {attachmentDownloading[a.id] ? <Loader className="h-3.5 w-3.5 animate-spin" /> : t("reports.attachmentsDownload.download", "Download")}
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
                                  className="flex-1 px-3 py-2.5 rounded-xl border border-[var(--outline-variant)] dark:border-gray-600 bg-[var(--surface-container-lowest)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] resize-y transition-all duration-200 hover:border-[var(--outline)] dark:hover:border-gray-500 break-words max-h-[30vh] overflow-auto min-w-0 text-base"
                                  disabled={isLoading}
                                  aria-label={t("reports.adminComment_placeholder.placeholder")}
                                />
                                <div className="w-full md:w-60 flex flex-col gap-3">
                                  <input
                                    type="date"
                                    value={actionState[r.id]?.deadline || ""}
                                    onChange={(e) =>
                                      setActionState((s) => ({
                                        ...s,
                                        [r.id]: { ...(s[r.id] || {}), deadline: e.target.value },
                                      }))
                                    }
                                    className="px-3 py-2.5 rounded-xl border border-[var(--outline-variant)] dark:border-gray-600 bg-[var(--surface-container-lowest)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] w-full text-base"
                                    disabled={isLoading}
                                    aria-label={t("reports.deadline")}
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleReview(r.id, "Approved")}
                                      className="flex-1 bg-[var(--primary)] dark:bg-green-700 text-[var(--on-primary)] dark:text-white px-4 py-2.5 rounded-full flex items-center justify-center gap-2 hover:bg-[var(--primary-container)] dark:hover:bg-green-600 transition-all duration-200 disabled:opacity-60 text-base surface-elevation-1"
                                      disabled={isLoading}
                                      aria-busy={approving}
                                    >
                                      {approving ? <Loader className="h-4 w-4 animate-spin" /> : t("reports.actions.approve")}
                                    </button>
                                    <button
                                      onClick={() => handleReview(r.id, "Rejected")}
                                      className="flex-1 bg-[var(--error)] dark:bg-red-700 text-[var(--on-error)] dark:text-white px-4 py-2.5 rounded-full flex items-center justify-center gap-2 hover:bg-[var(--error-container)] dark:hover:bg-red-600 transition-all duration-200 disabled:opacity-60 text-base surface-elevation-1"
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
                                  <div className="text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 mb-1">
                                    {t("reports.adminComment")}
                                  </div>
                                  <div className="mt-1 text-base text-[var(--on-surface-variant)] dark:text-gray-400 bg-[var(--surface-container-low)] dark:bg-gray-700 p-3 rounded-xl transition-colors duration-200 break-words">
                                    {r.adminComment}
                                  </div>
                                </div>
                              )}
                              {r.resubmissionDeadline && (
                                <div className="text-base text-[var(--on-surface-variant)] dark:text-gray-400">
                                  {t("reports.resubmissionDeadline")}: {new Date(r.resubmissionDeadline).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          )}
                          {actionState[r.id]?._lastResult && (
                            <div className="text-base text-[var(--primary)] dark:text-green-400 transition-all duration-200 animate-slide-in-up">
                              {actionState[r.id]._lastResult}
                            </div>
                          )}
                          {actionState[r.id]?._lastError && (
                            <div className="text-base text-[var(--error)] dark:text-red-400 transition-all duration-200">
                              {actionState[r.id]._lastError}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {reports.length === 0 && !loading && (
                  <div className="text-center text-[var(--on-surface-variant)] dark:text-gray-400 py-8 transition-all duration-200 text-base">
                    {t("reports.noReports")}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[var(--on-surface)] dark:text-white">
            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => {
                  setPage(1);
                  loadReports({ page: 1 });
                }}
                className="px-4 py-2.5 rounded-full bg-[var(--surface-container)] dark:bg-gray-700 text-base hover:bg-[var(--surface-container-high)] dark:hover:bg-gray-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="px-4 py-2.5 rounded-full bg-[var(--surface-container)] dark:bg-gray-700 text-base hover:bg-[var(--surface-container-high)] dark:hover:bg-gray-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("reports.pagination.prev")}
              </button>
              <div className="ml-auto text-base text-[var(--on-surface-variant)] dark:text-gray-400">
                {t("reports.pagination.showingPage", { page, totalPages, total })}
              </div>
              <button
                disabled={page >= totalPages}
                onClick={() => {
                  const next = Math.min(totalPages, page + 1);
                  setPage(next);
                  loadReports({ page: next });
                }}
                className="px-4 py-2.5 rounded-full bg-[var(--surface-container)] dark:bg-gray-700 text-base hover:bg-[var(--surface-container-high)] dark:hover:bg-gray-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("reports.pagination.next")}
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => {
                  setPage(totalPages);
                  loadReports({ page: totalPages });
                }}
                className="px-4 py-2.5 rounded-full bg-[var(--surface-container)] dark:bg-gray-700 text-base hover:bg-[var(--surface-container-high)] dark:hover:bg-gray-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("reports.pagination.last")}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-base text-[var(--on-surface-variant)] dark:text-gray-400">
                {t("reports.pageSize")}
              </label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-[var(--surface-container-lowest)] dark:bg-gray-700 text-base focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all duration-200 dark:text-white"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n} className="bg-white dark:bg-gray-700">
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------
Enhanced helper: render metrics nicely (object or JSON) with subtle animations
------------------------- */
function renderMetricsList(metrics) {
  if (!metrics) return <div className="text-base text-[var(--on-surface-variant)] dark:text-gray-400">—</div>;
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
      <div className="text-base font-mono break-words p-3 bg-[var(--surface-container-low)] dark:bg-gray-700 rounded-xl border border-[var(--outline-variant)] dark:border-gray-600 text-[var(--on-surface)] dark:text-white transition-all duration-200">
        {s}
      </div>
    );
  }
  if (!obj || typeof obj !== "object") {
    return <div className="text-base text-[var(--on-surface-variant)] dark:text-gray-400">—</div>;
  }
  const keys = Object.keys(obj);
  if (keys.length === 0) return <div className="text-base text-[var(--on-surface-variant)] dark:text-gray-400">—</div>;
  return (
    <div className="space-y-2">
      {keys.map((k, index) => {
        const value = obj[k];
        const displayValue =
          value !== null && typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
        return (
          <div
            key={k}
            className="flex items-start justify-between bg-[var(--surface-container-low)] dark:bg-gray-700 rounded-xl px-3 py-2 border border-[var(--outline-variant)] dark:border-gray-600 gap-3 transition-all duration-200 hover:surface-elevation-1"
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <div className="text-base text-[var(--on-surface-variant)] dark:text-gray-400 pt-px">{k}</div>
            <div className="text-base font-mono text-[var(--on-surface)] dark:text-white break-all text-right whitespace-pre-wrap">
              {displayValue}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default App;