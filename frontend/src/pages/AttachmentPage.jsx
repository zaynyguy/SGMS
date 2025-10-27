// src/pages/AttachmentsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
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
  if (!fileType) return <File className="h-5 w-5 transition-all duration-300 ease-in-out transform hover:scale-110" />;
  if (fileType.includes("image")) return <ImgIcon className="h-5 w-5 transition-all duration-300 ease-in-out transform hover:scale-110" />;
  if (fileType.includes("pdf")) return <FileText className="h-5 w-5 transition-all duration-300 ease-in-out transform hover:scale-110" />;
  return <File className="h-5 w-5 transition-all duration-300 ease-in-out transform hover:scale-110" />;
}

function ImagePreviewModal({ src, name, onClose, t }) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    // Trigger animation after mount
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation to complete
  };

  if (!src) return null;
  
  return (
    <div className={`fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 transition-all duration-300 ease-out ${
      isVisible ? 'opacity-100' : 'opacity-0'
    }`}>
      <div 
        className={`bg-white dark:bg-gray-900 rounded-lg overflow-auto max-w-[95vw] max-h-[95vh] shadow-2xl transform transition-all duration-300 ease-out ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700 transition-colors duration-200">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[60vw] transition-colors duration-200">
            {name}
          </div>
          <button 
            onClick={handleClose} 
            className="text-gray-600 dark:text-gray-300 px-2 py-1 text-xl leading-none transition-all duration-200 ease-in-out transform hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            aria-label={t("attachments.closePreview")} 
            title={t("attachments.closePreview")}
          >
            &times;
          </button>
        </div>
        <div className="p-4 flex items-center justify-center">
          <AuthenticatedImage
            src={src}
            alt={name}
            className="max-w-full max-h-[80vh] object-contain rounded transition-all duration-500 ease-in-out transform hover:scale-105"
            fallbackSeed={name}
            fallbackClassName="max-w-full max-h-[80vh] w-[80vw] min-h-[50vh] flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded transition-colors duration-300"
          >
            <div className="flex flex-col items-center justify-center p-8 text-center animate-pulse">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4 transition-transform duration-300 ease-in-out transform hover:scale-110" />
              <p className="font-semibold transition-colors duration-200">{t("attachments.previewErrorTitle", "Cannot load preview")}</p>
              <p className="text-sm mt-1 transition-colors duration-200">{t("attachments.previewErrorSubtitle", "The file may be corrupt or inaccessible.")}</p>
            </div>
          </AuthenticatedImage>
        </div>
      </div>
    </div>
  );
}

/* Reusable ConfirmModal */
function ConfirmModal({ open, title, message, onCancel, onConfirm, loading, confirmLabel = "Delete", cancelLabel = "Cancel" }) {
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
    <div 
      className={`fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center p-4 z-50 transition-all duration-300 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`} 
      role="alertdialog" 
      aria-modal="true"
    >
      <div 
        className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 ease-out ${
          isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        }`}
      >
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-3 transition-all duration-300 ease-in-out transform hover:scale-110">
            <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400 transition-transform duration-300" />
          </div>
          <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-200">{title}</h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 transition-colors duration-200">{message}</p>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button 
            type="button" 
            onClick={onCancel} 
            disabled={loading}
            className="flex-1 px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 ease-in-out transform hover:scale-105 disabled:transform-none disabled:hover:scale-100"
          >
            {cancelLabel}
          </button>

          <button 
            type="button" 
            onClick={onConfirm} 
            disabled={loading}
            className="flex-1 px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm transition-all duration-200 ease-in-out transform hover:scale-105 disabled:transform-none disabled:hover:scale-100"
          >
            {loading ? (<><Loader2 className="h-4 w-4 animate-spin mr-2 transition-transform duration-300" /> Deleting...</>) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Breadcrumb pills — show only when expanded */
const BreadcrumbRow = ({ at }) => {
  const pieces = [
    { label: at.groupName, key: "group" },
    { label: at.goalTitle, key: "goal" },
    { label: at.taskTitle, key: "task" },
    { label: at.activityTitle, key: "activity" },
  ].filter((p) => p.label && String(p.label).trim() !== "");

  if (pieces.length === 0) return null;

  return (
    <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 transition-all duration-300 ease-in-out">
      <nav className="flex items-center gap-2 flex-wrap">
        {pieces.map((p, i) => (
          <div key={p.key} className="flex items-center gap-2 transition-all duration-200">
            <span 
              className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-ellipsis overflow-hidden whitespace-nowrap max-w-[30ch] block transition-all duration-200 ease-in-out transform hover:scale-105 hover:bg-gray-200 dark:hover:bg-gray-600"
              title={p.label}
            >
              {p.label}
            </span>
            {i < pieces.length - 1 && (
              <span className="text-gray-400 dark:text-gray-500 transition-colors duration-200">
                ›
              </span>
            )}
          </div>
        ))}
      </nav>
    </div>
  );
};

export default function AttachmentsPage({ reportId }) {
  const { t } = useTranslation();

  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState(null);

  // UI
  const [preview, setPreview] = useState(null); // { src, name }
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState([]); // attachments with breadcrumbs visible

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (text, type = "read") => setToast({ text, type });
  const handleToastClose = () => setToast(null);

  // Confirm delete
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

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

  // short context: prefer activity > task > goal > group
  const shortContext = (at) => at.activityTitle || at.taskTitle || at.goalTitle || at.groupName || "";

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 p-4 sm:p-6 transition-all duration-500 ease-in-out">
      <div className="max-w-8xl mx-auto animate-fade-in">
        <header className="mb-6 flex flex-col gap-4 transition-all duration-300">
          <div className="flex items-center justify-between gap-4 transition-all duration-300">
            <div className="flex items-center gap-4 min-w-0 transition-all duration-300">
              <div className="p-3 rounded-lg bg-white dark:bg-gray-800 shrink-0 transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-lg">
                <Paperclip className="h-6 w-6 text-sky-600 dark:text-sky-300 transition-transform duration-300 ease-in-out transform hover:rotate-12" />
              </div>
              <div className="min-w-0 transition-all duration-300">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white truncate transition-colors duration-300">
                  {t("attachments.title")}
                </h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 truncate max-w-[60ch] transition-colors duration-300">
                  {t("attachments.subtitle")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 transition-all duration-300">
              <div className="hidden md:block transition-all duration-300">
                <TopBar />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 transition-all duration-300">
            <div className="relative flex-1 min-w-0 transition-all duration-300">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-all duration-300">
                <Search className="h-4 w-4 text-gray-400 transition-colors duration-300" />
              </div>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("attachments.searchPlaceholder")}
                className="pl-10 pr-9 py-2 w-full rounded-md border bg-white dark:bg-gray-700 text-sm sm:text-base text-gray-900 dark:text-white min-w-0 transition-all duration-300 ease-in-out focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transform hover:shadow-md"
                aria-label={t("attachments.searchAria")}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")} 
                  className="absolute right-1 top-1.5 p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 ease-in-out transform hover:scale-110"
                  aria-label={t("attachments.clearSearchAria")}
                >
                  <X className="h-4 w-4 transition-transform duration-200" />
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-700 dark:text-red-300 transition-all duration-300 ease-in-out animate-pulse">
              {error}
            </div>
          )}
        </header>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden transition-all duration-500 ease-in-out transform hover:shadow-lg">
          {loading ? (
            <div className="p-8 flex flex-col items-center justify-center transition-all duration-300">
              <Loader2 className="animate-spin h-10 w-10 text-indigo-600 dark:text-indigo-400 mb-4 transition-colors duration-300" />
              <p className="text-gray-500 dark:text-gray-400 transition-colors duration-300">{t("attachments.loading")}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center transition-all duration-300 animate-fade-in">
              <File className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3 transition-all duration-300 ease-in-out transform hover:scale-110" />
              <div className="text-lg font-medium text-gray-700 dark:text-gray-200 transition-colors duration-300">
                {t("attachments.noAttachmentsTitle")}
              </div>
              <div className="text-sm text-gray-400 dark:text-gray-500 mt-1 transition-colors duration-300">
                {t("attachments.noAttachmentsSubtitle")}
              </div>
            </div>
          ) : (
            <>
              {/* TABLE for large screens */}
              <div className="hidden lg:block overflow-hidden transition-all duration-300">
                <table className="min-w-full table-auto transition-all duration-300">
                  <thead className="bg-gray-50 dark:bg-gray-700 text-left transition-colors duration-300">
                    <tr className="transition-colors duration-300">
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider transition-colors duration-300">
                        {t("attachments.table.file")}
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider transition-colors duration-300">
                        {t("attachments.table.type")}
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider transition-colors duration-300">
                        {t("attachments.table.context") || "Context"}
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider transition-colors duration-300">
                        {t("attachments.table.uploaded")}
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-right transition-colors duration-300">
                        {t("attachments.table.actions")}
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 transition-colors duration-300">
                    {filtered.map((at, index) => {
                      const expanded = expandedIds.includes(at.id);
                      return (
                        <tr 
                          key={at.id} 
                          className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out transform hover:scale-[1.01] align-top ${
                            index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'
                          }`}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <td className="px-4 py-4 align-top transition-all duration-300">
                            <div className="flex items-center gap-3 min-w-0 transition-all duration-300">
                              <div className="flex-shrink-0 h-10 w-10 text-indigo-600 dark:text-indigo-400 transition-colors duration-300">
                                <IconForType fileType={at.fileType} />
                              </div>
                              <div className="min-w-0 flex-1 transition-all duration-300">
                                <div className="flex items-center justify-between gap-3 transition-all duration-300">
                                  <div 
                                    className="text-sm font-medium text-gray-900 dark:text-white truncate transition-colors duration-300 hover:text-indigo-600 dark:hover:text-indigo-300" 
                                    title={at.fileName}
                                  >
                                    {at.fileName}
                                  </div>
                                  <button 
                                    onClick={() => toggleExpand(at.id)} 
                                    className="ml-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-all duration-200 ease-in-out transform hover:scale-110" 
                                    aria-expanded={expanded}
                                  >
                                    {expanded ? (
                                      <ChevronUp className="h-4 w-4 transition-transform duration-300" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 transition-transform duration-300" />
                                    )}
                                  </button>
                                </div>
                                {/* only show breadcrumb when expanded (keeps row compact) */}
                                {expanded && <BreadcrumbRow at={at} />}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 align-top transition-all duration-300">
                            <div 
                              className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 truncate max-w-[22ch] transition-all duration-300 ease-in-out transform hover:scale-105 hover:bg-gray-200 dark:hover:bg-gray-600" 
                              title={at.fileType}
                            >
                              {at.fileType || t("attachments.empty")}
                            </div>
                          </td>

                          <td className="px-4 py-4 align-top transition-all duration-300">
                            <div 
                              className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-[28ch] transition-colors duration-300 hover:text-gray-900 dark:hover:text-white" 
                              title={shortContext(at)}
                            >
                              {shortContext(at)}
                            </div>
                          </td>

                          <td className="px-4 py-4 align-top text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">
                            {formatDate(at.createdAt)}
                          </td>

                          <td className="px-4 py-4 align-top text-right transition-all duration-300">
                            <div className="flex items-center justify-end gap-2 transition-all duration-300">
                              <button 
                                onClick={() => handleDownload(at)} 
                                disabled={downloading === at.id} 
                                title={t("attachments.download")} 
                                className="inline-flex items-center px-2.5 py-1.5 rounded-md text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/50 disabled:opacity-50 transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95"
                              >
                                {downloading === at.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin transition-transform duration-300" />
                                ) : (
                                  <Download className="h-4 w-4 transition-transform duration-200" />
                                )}
                              </button>

                              {String(at.fileType || "").includes("image") && (
                                <button 
                                  onClick={() => openPreview(at)} 
                                  title={t("attachments.preview")} 
                                  className="inline-flex items-center px-2.5 py-1.5 rounded-md text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95"
                                >
                                  <Eye className="h-4 w-4 transition-transform duration-200" />
                                </button>
                              )}

                              <button 
                                onClick={() => requestDelete(at.id)} 
                                disabled={deleting === at.id} 
                                title={t("attachments.delete")} 
                                className="inline-flex items-center px-2.5 py-1.5 rounded-md text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/50 disabled:opacity-50 transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95"
                              >
                                {deleting === at.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin transition-transform duration-300" />
                                ) : (
                                  <Trash2 className="h-4 w-4 transition-transform duration-200" />
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

              {/* MEDIUM / SMALL: compact cards with minimal info; breadcrumb only when expanded */}
 <div className="hidden md:grid md:grid-cols-2 lg:hidden gap-4 p-4 transition-all duration-300">
                {filtered.map((at, index) => {
                  const expanded = expandedIds.includes(at.id);
                  return (
                    <div 
                      key={at.id} 
                      className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-3 shadow-sm flex flex-col justify-between transition-all duration-500 ease-in-out transform hover:scale-[1.02] hover:shadow-lg"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start gap-3 transition-all duration-300">
                        <div className="flex-shrink-0 text-indigo-600 dark:text-indigo-300 transition-colors duration-300">
                          <IconForType fileType={at.fileType} />
                        </div>
                        <div className="min-w-0 flex-1 transition-all duration-300">
                          <div className="flex items-center justify-between transition-all duration-300">
                            <div 
                              className="text-sm font-semibold text-gray-900 dark:text-white truncate transition-colors duration-300 hover:text-indigo-600 dark:hover:text-indigo-300" 
                              title={at.fileName}
                            >
                              {at.fileName}
                            </div>
                            <button 
                              onClick={() => toggleExpand(at.id)} 
                              className="ml-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-all duration-200 ease-in-out transform hover:scale-110"
                            >
                              {expanded ? (
                                <ChevronUp className="h-4 w-4 transition-transform duration-300" />
                              ) : (
                                <ChevronDown className="h-4 w-4 transition-transform duration-300" />
                              )}
                            </button>
                          </div>

                          <div 
                            className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate max-w-[36ch] transition-colors duration-300 hover:text-gray-700 dark:hover:text-gray-300" 
                            title={shortContext(at)}
                          >
                            {shortContext(at)}
                          </div>

                          {expanded && <BreadcrumbRow at={at} />}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 transition-all duration-300">
                        <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">
                          {formatDate(at.createdAt)}
                        </div>
                        <div className="ml-auto flex items-center gap-2 transition-all duration-300">
                          <button 
                            onClick={() => handleDownload(at)} 
                            disabled={downloading === at.id} 
                            className="px-3 py-2 rounded-md text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95"
                          >
                            {downloading === at.id ? (
                              <Loader2 className="h-4 w-4 animate-spin transition-transform duration-300" />
                            ) : (
                              <Download className="h-4 w-4 transition-transform duration-200" />
                            )}
                          </button>
                          {String(at.fileType || "").includes("image") && (
                            <button 
                              onClick={() => openPreview(at)} 
                              className="px-3 py-2 rounded-md text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95"
                            >
                              <Eye className="h-4 w-4 transition-transform duration-200" />
                            </button>
                          )}
                          <button 
                            onClick={() => requestDelete(at.id)} 
                            disabled={deleting === at.id} 
                            className="px-3 py-2 rounded-md text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95"
                          >
                            {deleting === at.id ? (
                              <Loader2 className="h-4 w-4 animate-spin transition-transform duration-300" />
                            ) : (
                              <Trash2 className="h-4 w-4 transition-transform duration-200" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* MOBILE stacked list (very compact) */}
              <div className="md:hidden p-4 space-y-3 transition-all duration-300">
                {filtered.map((at, index) => {
                  const expanded = expandedIds.includes(at.id);
                  return (
                    <div 
                      key={at.id} 
                      className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-3 shadow-sm transition-all duration-500 ease-in-out transform hover:scale-[1.01] hover:shadow-md"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center gap-3 transition-all duration-300">
                        <div className="text-indigo-600 dark:text-indigo-300 transition-colors duration-300">
                          <IconForType fileType={at.fileType} />
                        </div>
                        <div className="flex-1 min-w-0 transition-all duration-300">
                          <div className="flex items-center justify-between transition-all duration-300">
                            <div 
                              className="text-sm font-medium text-gray-900 dark:text-white truncate transition-colors duration-300 hover:text-indigo-600 dark:hover:text-indigo-300" 
                              title={at.fileName}
                            >
                              {at.fileName}
                            </div>
                            <button 
                              onClick={() => toggleExpand(at.id)} 
                              className="ml-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-all duration-200 ease-in-out transform hover:scale-110"
                            >
                              {expanded ? (
                                <ChevronUp className="h-4 w-4 transition-transform duration-300" />
                              ) : (
                                <ChevronDown className="h-4 w-4 transition-transform duration-300" />
                              )}
                            </button>
                          </div>

                          <div 
                            className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate transition-colors duration-300 hover:text-gray-700 dark:hover:text-gray-300" 
                            title={shortContext(at)}
                          >
                            {shortContext(at)}
                          </div>

                          {expanded && <BreadcrumbRow at={at} />}

                          <div className="mt-2 flex items-center justify-between transition-all duration-300">
                            <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">
                              {formatDate(at.createdAt)}
                            </div>
                            <div className="flex items-center gap-2 transition-all duration-300">
                              <button 
                                onClick={() => handleDownload(at)} 
                                disabled={downloading === at.id} 
                                className="px-3 py-2 rounded-md text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95"
                              >
                                {downloading === at.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin transition-transform duration-300" />
                                ) : (
                                  <Download className="h-4 w-4 transition-transform duration-200" />
                                )}
                              </button>
                              {String(at.fileType || "").includes("image") && (
                                <button 
                                  onClick={() => openPreview(at)} 
                                  className="px-3 py-2 rounded-md text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95"
                                >
                                  <Eye className="h-4 w-4 transition-transform duration-200" />
                                </button>
                              )}
                              <button 
                                onClick={() => requestDelete(at.id)} 
                                disabled={deleting === at.id} 
                                className="px-3 py-2 rounded-md text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95"
                              >
                                {deleting === at.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin transition-transform duration-300" />
                                ) : (
                                  <Trash2 className="h-4 w-4 transition-transform duration-200" />
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
        />

        {toast && (
          <div className="fixed z-50 right-5 bottom-5 transition-all duration-500 ease-in-out animate-bounce">
            <Toast message={toast.text} type={toast.type} onClose={handleToastClose} />
          </div>
        )}
      </div>
    </div>
  );
}