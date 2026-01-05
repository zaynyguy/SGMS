import React, { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  Trash2,
  Download,
  File,
  FileText,
  Image as ImgIcon,
  Eye,
  X,
  Search,
  Paperclip,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { fetchAttachments, deleteAttachment, downloadAttachment } from "../api/attachments";
import TopBar from "../components/layout/TopBar";
import Toast from "../components/common/Toast";
import AuthenticatedImage from "../components/common/AuthenticatedImage";

/* Small util: format date nicely */
const formatDate = (d) => {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(d));
  } catch {
    return d;
  }
};

function IconForType({ fileType }) {
  if (!fileType) return <File className="h-4 w-4 transition-all duration-300 ease-in-out transform hover:scale-110" />;
  if (fileType.includes("image")) return <ImgIcon className="h-4 w-4 transition-all duration-300 ease-in-out transform hover:scale-110" />;
  if (fileType.includes("pdf")) return <FileText className="h-4 w-4 transition-all duration-300 ease-in-out transform hover:scale-110" />;
  return <File className="h-4 w-4 transition-all duration-300 ease-in-out transform hover:scale-110" />;
}

/* --------------------
  ModalPortal
  - Creates DOM node on mount
  - Handles ESC to close
  - Prevents body scroll while open
  - Backdrop click closes
  -------------------- */
function ModalPortal({ children, onClose, ariaLabel }) {
  const elRef = useRef(null);
  useEffect(() => {
    const node = document.createElement("div");
    node.className = "modal-portal-root";
    elRef.current = node;
    document.body.appendChild(node);
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      if (elRef.current) document.body.removeChild(elRef.current);
      document.body.style.overflow = prevOverflow;
      elRef.current = null;
    };
  }, [onClose]);
  if (!elRef.current) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-gray-900/80"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || "Dialog"}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--scrim)]/[0.6] dark:bg-gray-900/80 transition-opacity"
        onClick={onClose}
      />
      {/* Dialog container */}
      <div
        className="relative w-fit max-w-3xl max-h-[95vh] overflow-auto bg-[var(--surface-container-lowest)] dark:bg-gray-800 rounded-2xl shadow-xl transform transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    elRef.current
  );
}

/* ImagePreviewModal: now uses ModalPortal for proper centering/stacking */
function ImagePreviewModal({ src, name, onClose, t }) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    // small entrance animation
    if (src) requestAnimationFrame(() => setIsVisible(true));
    return () => setIsVisible(false);
  }, [src]);

  if (!src) return null;

  return (
    <ModalPortal onClose={onClose} ariaLabel={t("attachments.preview") || "Preview"}>
      <div className={`rounded-2xl overflow-hidden shadow-xl transform transition-all duration-300 ease-out ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--outline-variant)] dark:border-gray-700 transition-colors duration-200">
          <div className="text-sm font-medium text-[var(--on-surface)] dark:text-white truncate max-w-[60vw] transition-colors duration-200">
            {name}
          </div>
          <button
            onClick={onClose}
            className="text-[var(--on-surface-variant)] dark:text-gray-300 px-2 py-1 text-lg leading-none transition-all duration-200 ease-in-out transform hover:scale-110 hover:bg-[var(--surface-container-low)] dark:hover:bg-gray-700 rounded-full"
            aria-label={t("attachments.closePreview")}
            title={t("attachments.closePreview")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 flex items-center justify-center">
          <AuthenticatedImage
            src={src}
            alt={name}
            className="max-w-full max-h-[80vh] object-contain rounded-xl transition-all duration-500 ease-in-out transform hover:scale-105"
            fallbackSeed={name}
            fallbackClassName="max-w-full max-h-[80vh] w-[80vw] min-h-[50vh] flex flex-col items-center justify-center bg-[var(--surface-container-low)] dark:bg-gray-700 text-[var(--on-surface-variant)] dark:text-gray-400 rounded-xl transition-colors duration-300"
          >
            <div className="flex flex-col items-center justify-center p-8 text-center animate-pulse">
              <AlertTriangle className="w-10 h-10 text-[var(--primary-container)] dark:text-green-500 mb-3 transition-transform duration-300 ease-in-out transform hover:scale-110" />
              <p className="font-semibold text-sm text-[var(--on-surface)] dark:text-white">{t("attachments.previewErrorTitle", "Cannot load preview")}</p>
              <p className="text-xs mt-1 text-[var(--on-surface-variant)] dark:text-gray-400">{t("attachments.previewErrorSubtitle", "The file may be corrupt or inaccessible.")}</p>
            </div>
          </AuthenticatedImage>
        </div>
      </div>
    </ModalPortal>
  );
}

/* ConfirmModal: uses ModalPortal for consistent positioning and ESC/backdrop behavior */
function ConfirmModal({ open, title, message, onCancel, onConfirm, loading, confirmLabel = "Delete", cancelLabel = "Cancel", t }) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <ModalPortal onClose={onCancel} ariaLabel={title}>
      <div className={`p-5 rounded-2xl w-full max-w-sm transform transition-all duration-300 ease-out ${isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'} shadow-xl border border-[var(--outline-variant)] dark:border-gray-700`}>
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-[var(--error-container)] dark:bg-red-900 mb-3 transition-all duration-300 ease-in-out transform hover:scale-110">
            <Trash2 className="h-6 w-6 text-[var(--on-error-container)] dark:text-red-300 transition-transform duration-300" />
          </div>
          <h3 className="mt-2 text-lg font-semibold text-[var(--on-surface)] dark:text-white transition-colors duration-200">{title}</h3>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 transition-colors duration-200">{message}</p>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm rounded-full border border-[var(--outline-variant)] dark:border-gray-600 text-[var(--on-surface)] dark:text-white hover:bg-[var(--surface-container-low)] dark:hover:bg-gray-700 transition-all duration-200 ease-in-out transform hover:scale-105 disabled:opacity-60 shadow-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm rounded-full bg-[var(--error)] dark:bg-red-700 hover:bg-[var(--error-container)] dark:hover:bg-red-600 text-[var(--on-error)] dark:text-white font-medium transition-all duration-200 ease-in-out transform hover:scale-105 disabled:opacity-60 shadow-[0_2px_6px_rgba(179,38,30,0.3)]"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--on-error)] dark:border-white border-t-transparent"></div>
                <span>{t("attachments.deleting")}</span>
              </div>
            ) : confirmLabel}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}

/* Breadcrumb pills — show only when expanded */
const BreadcrumbRow = ({ at, t }) => {
  const pieces = [
    { label: at.groupName, key: "group" },
    { label: at.goalTitle, key: "goal" },
    { label: at.taskTitle, key: "task" },
    { label: at.activityTitle, key: "activity" },
  ].filter((p) => p.label && String(p.label).trim() !== "");

  if (pieces.length === 0) return null;

  return (
    <div className="mt-1 text-xs text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-300 ease-in-out">
      <nav className="flex items-center gap-1.5 flex-wrap">
        {pieces.map((p, i) => (
          <React.Fragment key={p.key}>
            <span
              className="px-2 py-0.5 rounded-full bg-[var(--surface-container-low)] dark:bg-gray-700 text-ellipsis overflow-hidden whitespace-nowrap max-w-[25ch] block transition-all duration-200 ease-in-out transform hover:scale-105 hover:bg-[var(--surface-container)] dark:hover:bg-gray-600"
              title={p.label}
            >
              {p.label}
            </span>
            {i < pieces.length - 1 && (
              <span className="text-[var(--on-surface-variant)] dark:text-gray-500 text-xs transition-colors duration-200">/</span>
            )}
          </React.Fragment>
        ))}
      </nav>
    </div>
  );
};

const App = ({ reportId }) => {
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

  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState(null);

  // UI
  const [preview, setPreview] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState([]);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (text, type = "read") => setToast({ text, type });
  const handleToastClose = () => setToast(null);

  // Confirm delete
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Input validation constants
  const MAX_LENGTH = 100;
  const ATTACHMENT_SEARCH_REGEX = /^[\p{L}0-9\s._\-()]*$/gu;

  const handleAttachmentSearchChange = (e) => {
    const value = e.target.value;

    // prevent abuse
    if (value.length > MAX_LENGTH) return;

    // safe characters only
    if (!ATTACHMENT_SEARCH_REGEX.test(value)) return;

    setSearchTerm(value);
  };

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAttachments(reportId);
      const items = Array.isArray(data) ? data : data?.rows ?? [];
      setAttachments(items);
    } catch (err) {
      console.error("Error loading attachments:", err);
      const msg = err?.message || t("attachments.messages.failedLoad");
      setError(msg);
      setAttachments([]);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (at) => {
    try {
      setDownloading(at.id);
      const res = await downloadAttachment(at.id);
      if (res.url && !res.blob) {
        const w = window.open(res.url, "_blank");
        if (!w) window.location.href = res.url;
        showToast(t("attachments.toasts.downloadStarted") || "Download started", "read");
        return;
      }
      const { blob, filename } = res;
      if (!blob) throw new Error(t("attachments.messages.noFileReturned"));
      const name = filename || at.fileName || `attachment-${at.id}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      showToast(t("attachments.toasts.downloadStarted") || "Download started", "read");
    } catch (err) {
      console.error("Download error:", err);
      const msg = err?.message || t("attachments.messages.downloadFailed");
      showToast(msg, "error");
    } finally {
      setDownloading(null);
    }
  };

  const requestDelete = (id) => {
    const at = attachments.find((a) => a.id === id) || { id, fileName: "" };
    setToDelete(at);
    setConfirmOpen(true);
  };

  const performDelete = async () => {
    if (!toDelete) {
      setConfirmOpen(false);
      return;
    }
    const id = toDelete.id;
    try {
      setDeleting(id);
      await deleteAttachment(id);
      setAttachments((p) => p.filter((x) => x.id !== id));
      showToast(t("attachments.toasts.deleted") || "Deleted", "delete");
    } catch (err) {
      console.error("Delete error:", err);
      const msg = err?.message || t("attachments.messages.deleteFailed");
      showToast(msg, "error");
    } finally {
      setDeleting(null);
      setConfirmOpen(false);
      setToDelete(null);
    }
  };

  const toggleExpand = (id) => {
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const openPreview = (at) => {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
    const src = `${API_URL}/api/reports/attachments/${encodeURIComponent(at.id)}/download`;
    setPreview({ src, name: at.fileName });
  };

  const filtered = useMemo(() => {
    const q = String(searchTerm || "").trim().toLowerCase();
    if (!q) return attachments;
    return attachments.filter((a) => {
      const name = String(a.fileName || "").toLowerCase();
      const id = String(a.id || "").toLowerCase();
      const type = String(a.fileType || "").toLowerCase();
      const activity = String(a.activityTitle || "").toLowerCase();
      const task = String(a.taskTitle || "").toLowerCase();
      const goal = String(a.goalTitle || "").toLowerCase();
      const group = String(a.groupName || "").toLowerCase();
      return (
        name.includes(q) ||
        id.includes(q) ||
        type.includes(q) ||
        activity.includes(q) ||
        task.includes(q) ||
        goal.includes(q) ||
        group.includes(q)
      );
    });
  }, [attachments, searchTerm]);

  const shortContext = (at) => at.activityTitle || at.taskTitle || at.goalTitle || at.groupName || "";

  return (
    <div className={`min-h-screen bg-slate-100 dark:bg-gray-900 font-sans transition-colors duration-300 ${mounted ? 'animate-fade-in' : ''}`}
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
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 300ms cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes material-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="min-w-7xl mx-auto p-4 bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
        {/* Header Card with Material 3 elevation */}
        <div className="mb-6">
          <div className="bg-[var(--surface-container-low)] dark:bg-gray-800 rounded-xl border border-[var(--outline-variant)] dark:border-gray-700 shadow-2xl p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center justify-center gap-4 min-w-0 flex-1">
                <div className="p-3 rounded-xl bg-[var(--primary-container)] dark:bg-indigo-900">
                  <Paperclip className="h-6 w-6 text-[var(--on-primary-container)] dark:text-indigo-200 transition-transform duration-300 ease-in-out transform hover:rotate-12" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-bold text-[var(--on-surface)] dark:text-white">
                    {t("attachments.title")}
                  </h1>
                  <p className="mt-0.5 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 truncate max-w-[60ch]">
                    {t("attachments.subtitle")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 z-50">
                  <TopBar />
                </div>
              </div>
            </div>
            {/* Search Bar with Material 3 styling */}
        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1 min-w-0">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-[var(--on-surface-variant)] dark:text-gray-400 transition-colors duration-300" />
            </div>
            <input
              value={searchTerm}
              onChange={handleAttachmentSearchChange}
              placeholder={t("attachments.searchPlaceholder")}
              className="pl-10 pr-10 py-2.5 text-sm w-full rounded-xl border border-[var(--outline-variant)] dark:border-gray-600 bg-[var(--surface-container-low)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white transition-all duration-300 ease-in-out focus:bg-[var(--surface-container)] dark:focus:bg-gray-600"
              aria-label={t("attachments.searchAria")}
            />
            {searchTerm && (
              <button
                onClick={handleAttachmentSearchChange}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-[var(--on-surface-variant)] dark:text-gray-400 hover:bg-[var(--surface-container)] dark:hover:bg-gray-600 transition-all duration-200 ease-in-out transform hover:scale-110"
                aria-label={t("attachments.clearSearchAria")}
              >
                <X className="h-4 w-4 transition-transform duration-200" />
              </button>
            )}
          </div>
        </div>
          </div>
        </div>

        

        {/* Main Content Card with Material 3 elevation */}
        <div className="bg-[var(--surface-container-low)] dark:bg-gray-800 rounded-xl border border-[var(--outline-variant)] dark:border-gray-700 shadow-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 flex flex-col items-center justify-center min-h-[440px]">
              <Loader2 className="animate-spin h-8 w-8 text-[var(--primary)] dark:text-green-500 mb-3 transition-colors duration-300" />
              <p className="text-base font-medium text-[var(--on-surface-variant)] dark:text-gray-400 transition-colors duration-300">{t("attachments.loading")}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center transition-all duration-300">
              <div className="bg-[var(--surface-container)] dark:bg-gray-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <File className="h-8 w-8 text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-300 ease-in-out transform hover:scale-110" />
              </div>
              <div className="text-lg font-medium text-[var(--on-surface)] dark:text-white transition-colors duration-300">
                {t("attachments.noAttachmentsTitle")}
              </div>
              <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400 mt-1 transition-colors duration-300">
                {t("attachments.noAttachmentsSubtitle")}
              </div>
            </div>
          ) : (
            <>
              {/* TABLE for large screens */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full table-auto text-sm">
                  <thead className="bg-[var(--surface-container)] dark:bg-gray-700 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider">
                        {t("attachments.table.file")}
                      </th>
                      <th className="px-4 py-3 font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider">
                        {t("attachments.table.type")}
                      </th>
                      <th className="px-4 py-3 font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider">
                        {t("attachments.table.context") || "Context"}
                      </th>
                      <th className="px-4 py-3 font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider">
                        {t("attachments.table.uploaded")}
                      </th>
                      <th className="px-4 py-3 font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider text-right">
                        {t("attachments.table.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--outline-variant)] dark:divide-gray-700">
                    {filtered.map((at, index) => {
                      const expanded = expandedIds.includes(at.id);
                      return (
                        <tr
                          key={at.id}
                          className={`hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 transition-all duration-300 ease-in-out transform hover:scale-[1.005] align-top ${
                            index % 2 === 0 ? 'bg-[var(--surface-container-low)] dark:bg-gray-800' : 'bg-[var(--surface-container)] dark:bg-gray-700'
                          }`}
                          style={{ animation: `material-in 0.4s ease-out forwards`, animationDelay: `${index * 0.05}s` }}
                        >
                          <td className="px-4 py-4 align-top">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-[var(--surface-container)] dark:bg-gray-700 flex items-center justify-center text-[var(--primary)] dark:text-indigo-400 border border-[var(--outline-variant)] dark:border-gray-600">
                                <IconForType fileType={at.fileType} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div
                                    className={`font-medium text-[var(--on-surface)] dark:text-white truncate ${String(at.fileType || "").includes("image") ? 'cursor-pointer hover:text-[var(--primary)] dark:hover:text-green-400' : ''}`}
                                    title={at.fileName}
                                    onClick={() => String(at.fileType || "").includes("image") && openPreview(at)}
                                  >
                                    {at.fileName}
                                  </div>
                                  <button
                                    onClick={() => toggleExpand(at.id)}
                                    className="ml-1 p-1.5 rounded-full hover:bg-[var(--surface-container)] dark:hover:bg-gray-600 text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-200 ease-in-out transform hover:scale-110"
                                    aria-expanded={expanded}
                                  >
                                    {expanded ? (
                                      <ChevronUp className="h-4 w-4 transition-transform duration-300" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 transition-transform duration-300" />
                                    )}
                                  </button>
                                </div>
                                {expanded && <BreadcrumbRow at={at} t={t} />}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div
                              className="inline-block px-2.5 py-1 font-medium rounded-full bg-[var(--surface-container)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white truncate max-w-[18ch] transition-all duration-300 ease-in-out transform hover:scale-105 hover:bg-[var(--surface-container-high)] dark:hover:bg-gray-600"
                              title={at.fileType}
                            >
                              {at.fileType || t("attachments.empty")}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div
                              className="text-[var(--on-surface-variant)] dark:text-gray-400 max-w-[25ch] hover:text-[var(--on-surface)] dark:hover:text-white cursor-pointer"
                              title={shortContext(at)}
                              onClick={() => toggleExpand(at.id)}
                            >
                              {shortContext(at)}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-[var(--on-surface-variant)] dark:text-gray-400">
                            {formatDate(at.createdAt)}
                          </td>
                          <td className="px-4 py-4 align-top text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleDownload(at)}
                                disabled={downloading === at.id}
                                title={t("attachments.download")}
                                className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm bg-[var(--primary-container)] dark:bg-green-900 hover:bg-[var(--primary)] dark:hover:bg-green-700 text-[var(--on-primary-container)] dark:text-green-200 hover:text-[var(--on-primary)] disabled:opacity-60 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 shadow-sm"
                              >
                                {downloading === at.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-[var(--on-primary-container)]" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </button>
                              {String(at.fileType || "").includes("image") && (
                                <button
                                  onClick={() => openPreview(at)}
                                  title={t("attachments.preview")}
                                  className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm bg-[var(--secondary-container)] dark:bg-blue-900 hover:bg-[var(--secondary)] dark:hover:bg-blue-700 text-[var(--on-secondary-container)] dark:text-blue-200 hover:text-[var(--on-secondary)] transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 shadow-sm"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => requestDelete(at.id)}
                                disabled={deleting === at.id}
                                title={t("attachments.delete")}
                                className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm bg-[var(--error-container)] dark:bg-red-900 hover:bg-[var(--error)] dark:hover:bg-red-700 text-[var(--on-error-container)] dark:text-red-200 hover:text-[var(--on-error)] disabled:opacity-60 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 shadow-sm"
                              >
                                {deleting === at.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-[var(--on-error-container)]" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MEDIUM / SMALL: compact cards */}
              <div className="hidden md:grid md:grid-cols-1 lg:hidden gap-4 p-4">
                {filtered.map((at, index) => {
                  const expanded = expandedIds.includes(at.id);
                  return (
                    <div
                      key={at.id}
                      className="bg-[var(--surface-container-low)] dark:bg-gray-800 border border-[var(--outline-variant)] dark:border-gray-700 rounded-xl p-4 shadow-sm flex flex-col justify-between transition-all duration-500 ease-in-out transform hover:scale-[1.015] hover:shadow-md"
                      style={{ animation: `material-in 0.4s ease-out forwards`, animationDelay: `${index * 0.06}s` }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 text-[var(--primary)] dark:text-green-400">
                          <div className="h-10 w-10 rounded-xl bg-[var(--surface-container)] dark:bg-gray-700 flex items-center justify-center border border-[var(--outline-variant)] dark:border-gray-600">
                            <IconForType fileType={at.fileType} />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <div
                              className={`text-sm font-medium text-[var(--on-surface)] dark:text-white truncate ${String(at.fileType || "").includes("image") ? 'cursor-pointer hover:text-[var(--primary)] dark:hover:text-green-400' : ''}`}
                              title={at.fileName}
                              onClick={() => String(at.fileType || "").includes("image") && openPreview(at)}
                            >
                              {at.fileName}
                            </div>
                            <button
                              onClick={() => toggleExpand(at.id)}
                              className="ml-1 p-1 rounded-full hover:bg-[var(--surface-container)] dark:hover:bg-gray-600 text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-200 ease-in-out transform hover:scale-110"
                            >
                              {expanded ? (
                                <ChevronUp className="h-4 w-4 transition-transform duration-300" />
                              ) : (
                                <ChevronDown className="h-4 w-4 transition-transform duration-300" />
                              )}
                            </button>
                          </div>
                          <div
                            className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400 mt-1 max-w-[30ch] hover:text-[var(--on-surface)] dark:hover:text-white cursor-pointer"
                            title={shortContext(at)}
                            onClick={() => toggleExpand(at.id)}
                          >
                            {shortContext(at)}
                          </div>
                          {expanded && <BreadcrumbRow at={at} t={t} />}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between pt-3 border-t border-[var(--outline-variant)] dark:border-gray-700">
                        <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400">
                          {formatDate(at.createdAt)}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownload(at)}
                            disabled={downloading === at.id}
                            className="px-3 py-1.5 rounded-xl text-sm bg-[var(--primary-container)] dark:bg-green-900 hover:bg-[var(--primary)] dark:hover:bg-green-700 text-[var(--on-primary-container)] dark:text-green-200 hover:text-[var(--on-primary)] transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 shadow-sm"
                          >
                            {downloading === at.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--on-primary-container)]" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </button>
                          {String(at.fileType || "").includes("image") && (
                            <button
                              onClick={() => openPreview(at)}
                              className="px-3 py-1.5 rounded-xl text-sm bg-[var(--secondary-container)] dark:bg-blue-900 hover:bg-[var(--secondary)] dark:hover:bg-blue-700 text-[var(--on-secondary-container)] dark:text-blue-200 hover:text-[var(--on-secondary)] transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 shadow-sm"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => requestDelete(at.id)}
                            disabled={deleting === at.id}
                            className="px-3 py-1.5 rounded-xl text-sm bg-[var(--error-container)] dark:bg-red-900 hover:bg-[var(--error)] dark:hover:bg-red-700 text-[var(--on-error-container)] dark:text-red-200 hover:text-[var(--on-error)] transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 shadow-sm"
                          >
                            {deleting === at.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--on-error-container)]" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* MOBILE stacked list */}
              <div className="md:hidden p-3 space-y-3">
                {filtered.map((at, index) => {
                  const expanded = expandedIds.includes(at.id);
                  return (
                    <div
                      key={at.id}
                      className="bg-[var(--surface-container-low)] dark:bg-gray-800 border border-[var(--outline-variant)] dark:border-gray-700 rounded-xl p-3 shadow-sm transition-all duration-500 ease-in-out transform hover:scale-[1.01] hover:shadow-sm"
                      style={{ animation: `material-in 0.4s ease-out forwards`, animationDelay: `${index * 0.04}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-[var(--primary)] dark:text-green-400">
                          <div className="h-9 w-9 rounded-xl bg-[var(--surface-container)] dark:bg-gray-700 flex items-center justify-center border border-[var(--outline-variant)] dark:border-gray-600">
                            <IconForType fileType={at.fileType} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div
                              className={`text-sm font-medium text-[var(--on-surface)] dark:text-white truncate ${String(at.fileType || "").includes("image") ? 'cursor-pointer hover:text-[var(--primary)] dark:hover:text-green-400' : ''}`}
                              title={at.fileName}
                              onClick={() => String(at.fileType || "").includes("image") && openPreview(at)}
                            >
                              {at.fileName}
                            </div>
                            <button
                              onClick={() => toggleExpand(at.id)}
                              className="ml-1 p-1 rounded-full hover:bg-[var(--surface-container)] dark:hover:bg-gray-600 text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-200 ease-in-out transform hover:scale-110"
                            >
                              {expanded ? (
                                <ChevronUp className="h-4 w-4 transition-transform duration-300" />
                              ) : (
                                <ChevronDown className="h-4 w-4 transition-transform duration-300" />
                              )}
                            </button>
                          </div>
                          <div
                            className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400 mt-0.5 hover:text-[var(--on-surface)] dark:hover:text-white cursor-pointer"
                            title={shortContext(at)}
                            onClick={() => toggleExpand(at.id)}
                          >
                            {shortContext(at)}
                          </div>
                          {expanded && <BreadcrumbRow at={at} t={t} />}
                          <div className="mt-3 flex items-center justify-between pt-3 border-t border-[var(--outline-variant)] dark:border-gray-700">
                            <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400">
                              {formatDate(at.createdAt)}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleDownload(at)}
                                disabled={downloading === at.id}
                                className="p-1.5 rounded-xl bg-[var(--primary-container)] dark:bg-green-900 hover:bg-[var(--primary)] dark:hover:bg-green-700 text-[var(--on-primary-container)] dark:text-green-200 hover:text-[var(--on-primary)] transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95 shadow-sm"
                              >
                                {downloading === at.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-[var(--on-primary-container)]" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </button>
                              {String(at.fileType || "").includes("image") && (
                                <button
                                  onClick={() => openPreview(at)}
                                  className="p-1.5 rounded-xl bg-[var(--secondary-container)] dark:bg-blue-900 hover:bg-[var(--secondary)] dark:hover:bg-blue-700 text-[var(--on-secondary-container)] dark:text-blue-200 hover:text-[var(--on-secondary)] transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95 shadow-sm"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => requestDelete(at.id)}
                                disabled={deleting === at.id}
                                className="p-1.5 rounded-xl bg-[var(--error-container)] dark:bg-red-900 hover:bg-[var(--error)] dark:hover:bg-red-700 text-[var(--on-error-container)] dark:text-red-200 hover:text-[var(--on-error)] transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95 shadow-sm"
                              >
                                {deleting === at.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-[var(--on-error-container)]" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Preview & Confirm modals (now portal-based) */}
        <ImagePreviewModal src={preview?.src} name={preview?.name} onClose={() => setPreview(null)} t={t} />
        <ConfirmModal
          open={confirmOpen}
          title={t("attachments.deleteConfirmTitle") || "Delete attachment"}
          message={
            toDelete ? (t("attachments.deleteConfirmMessage", { name: toDelete.fileName }) || `Delete "${toDelete.fileName}"?`) : (t("attachments.deleteConfirmMessageGeneric") || "Delete this attachment?")
          }
          onCancel={() => { setConfirmOpen(false); setToDelete(null); }}
          onConfirm={performDelete}
          loading={Boolean(deleting)}
          confirmLabel={t("attachments.delete") || "Delete"}
          cancelLabel={t("attachments.cancel") || "Cancel"}
          t={t}
        />

        {/* Toast portal bottom-right (keeps same Toast API usage) */}
        {toast &&
          createPortal(
            <div className="z-50 pointer-events-none">
              <div className="fixed inset-x-0 bottom-0 p-4 md:inset-auto md:right-4 md:bottom-4">
                <div className="pointer-events-auto">
                  <Toast message={toast.message ?? toast.text} type={toast.type} onClose={handleToastClose} />
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
};

export default App;