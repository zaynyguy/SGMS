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
  AlertTriangle, // For fallback
} from "lucide-react";
import { fetchAttachments, deleteAttachment, downloadAttachment } from "../api/attachments";
import TopBar from "../components/layout/TopBar";
import Toast from "../components/common/Toast";
import AuthenticatedImage from "../components/common/AuthenticatedImage"; // <-- IMPORT THE NEW COMPONENT

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
  if (!fileType) return <File className="h-5 w-5" />;
  if (fileType.includes("image")) return <ImgIcon className="h-5 w-5" />;
  if (fileType.includes("pdf")) return <FileText className="h-5 w-5" />;
  return <File className="h-5 w-5" />;
}

function ImagePreviewModal({ src, name, onClose, t }) {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg overflow-auto max-w-[95vw] max-h-[95vh] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[60vw]">{name}</div>
          <button onClick={onClose} className="text-gray-600 dark:text-gray-300 px-2 py-1 text-xl leading-none" aria-label={t("attachments.closePreview")} title={t("attachments.closePreview")}>
            &times;
          </button>
        </div>
        <div className="p-4 flex items-center justify-center">
          {/* --- UPDATED --- */}
          <AuthenticatedImage
            src={src}
            alt={name}
            className="max-w-full max-h-[80vh] object-contain rounded"
            fallbackSeed={name}
            fallbackClassName="max-w-full max-h-[80vh] w-[80vw] min-h-[50vh] flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded"
          >
            {/* Custom child for fallback state */}
            <div className="flex flex-col items-center justify-center p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
                <p className="font-semibold">{t("attachments.previewErrorTitle", "Cannot load preview")}</p>
                <p className="text-sm mt-1">{t("attachments.previewErrorSubtitle", "The file may be corrupt or inaccessible.")}</p>
            </div>
          </AuthenticatedImage>
          {/* --- END UPDATE --- */}
        </div>
      </div>
    </div>
  );
}

/* Reusable ConfirmModal (in-file) */
function ConfirmModal({ open, title, message, onCancel, onConfirm, loading, confirmLabel = "Delete", cancelLabel = "Cancel" }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center p-4 z-50"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
    >
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-3">
            <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>

          <h3 id="confirm-modal-title" className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>

          <p id="confirm-modal-desc" className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {message}
          </p>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm transition-colors disabled:opacity-60 flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>{confirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AttachmentsPage({ reportId }) {
  const { t } = useTranslation();

  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState(null);

  // UI state
  const [preview, setPreview] = useState(null); // { src, name }
  const [searchTerm, setSearchTerm] = useState("");

  // Toast state
  const [toast, setToast] = useState(null);
  const showToast = (text, type = "read") => setToast({ text, type });
  const handleToastClose = () => setToast(null);

  // Confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null); // object { id, fileName }

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

  // Request delete (open confirm modal)
  const requestDelete = (id) => {
    const at = attachments.find((a) => a.id === id) || { id, fileName: "" };
    setToDelete(at);
    setConfirmOpen(true);
  };

  // Perform delete after confirmation
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
      showToast(t("attachments.toasts.deleted") || t("attachments.deleteSuccess") || "Deleted", "delete");
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

  // --- UPDATED ---
  // We no longer need to fetch. Just set the secure URL.
  // The AuthenticatedImage component inside the modal will handle fetching.
  const openPreview = (at) => {
    // We need the *absolute secure URL* for the attachment.
    // The `at.filePath` from the backend *is* this URL.
    let src = at.filePath; // e.g., "http://localhost:5000/api/reports/attachments/123/download"
    
    // This logic might be from an old version, but we'll keep it just in case
    // some attachments are still relative paths (which they shouldn't be).
    if (src && src.startsWith("/")) {
       src = `${window.location.origin}${src}`;
    }
    
    // If filePath is not a full URL (e.g., old "local" provider filename),
    // we must construct the full download path.
    // The backend `listAttachments` doesn't seem to provide the full path,
    // only the `filePath` (which might be a filename or a Cloudinary URL).
    // The `downloadAttachment` *API* call in `api/attachments.js`
    // points to `/api/reports/attachments/${id}/download`. This is the secure path.
    // Let's assume `at.filePath` is *not* the path, but `at.id` is what we need.
    
    // Let's correct this. The secure URL is the one we use for downloading.
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
    src = `${API_URL}/api/reports/attachments/${encodeURIComponent(at.id)}/download`;
    
    console.log("Setting preview src to:", src);
    setPreview({ src, name: at.fileName });
  };
  // --- END UPDATE ---

  const filtered = useMemo(() => {
    const q = String(searchTerm || "").trim().toLowerCase();
    if (!q) return attachments;
    return attachments.filter((a) => {
      const name = String(a.fileName || "").toLowerCase();
      const id = String(a.id || "").toLowerCase();
      const type = String(a.fileType || "").toLowerCase();
      return name.includes(q) || id.includes(q) || type.includes(q);
    });
  }, [attachments, searchTerm]);

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 p-4 sm:p-6 transition-colors duration-200">
      <div className="max-w-8xl mx-auto">
        {/* HEADER: Title | Controls | TopBar */}
        <header className="mb-6">
          <div className="flex-1 items-center gap-3">
            <div className="order-1 flex min-w-0 justify-between gap-2">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-white dark:bg-gray-800">
                  <Paperclip className="h-6 w-6 text-sky-600 dark:text-sky-300" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white truncate">{t("attachments.title")}</h1>
                  <p className="mt-1 text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-2xl">
                    {t("attachments.subtitle")}
                  </p>
                </div>
              </div>

              <div className="order-2 md:order-3 flex-shrink-0">
                <TopBar />
              </div>
            </div>

            <div className="order-3 w-full md:order-2 md:w-auto">
              <div className="mt-3 md:mt-0 flex items-center gap-3">
                <div className="relative flex-1 min-w-0">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t("attachments.searchPlaceholder")}
                    className="pl-10 pr-9 py-2 w-full rounded-md border bg-white dark:bg-gray-700 text-sm sm:text-base text-gray-900 dark:text-white min-w-0"
                    aria-label={t("attachments.searchAria")}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-1 top-1.5 p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                      aria-label={t("attachments.clearSearchAria")}
                      title={t("attachments.clearSearchTitle")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Removed view toggle – always use table-style presentation */}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </header>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 flex flex-col items-center justify-center">
              <Loader2 className="animate-spin h-10 w-10 text-indigo-600 dark:text-indigo-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">{t("attachments.loading")}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <File className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
              <div className="text-lg font-medium text-gray-700 dark:text-gray-200">{t("attachments.noAttachmentsTitle")}</div>
              <div className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t("attachments.noAttachmentsSubtitle")}</div>
            </div>
          ) : (
            <>
              {/* ---------- TABLE: large screens (lg+) ---------- */}
              <div className="hidden lg:block overflow-auto">
                <table className="min-w-full table-auto">
                  <thead className="bg-gray-50 dark:bg-gray-700 text-left">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t("attachments.table.file")}</th>
                      <th className="px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t("attachments.table.type")}</th>
                      <th className="px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t("attachments.table.uploaded")}</th>
                      <th className="px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-right">{t("attachments.table.actions")}</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filtered.map((at) => (
                      <tr key={at.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors align-top">
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center min-w-0">
                            <div className="flex-shrink-0 h-10 w-10 text-indigo-600 dark:text-indigo-400">
                              <IconForType fileType={at.fileType} />
                            </div>
                            <div className="ml-3 min-w-0">
                              <div className="text-sm sm:text-base font-medium text-gray-900 dark:text-white truncate max-w-[60ch]" title={at.fileName}>
                                {at.fileName}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{t("attachments.idPrefix")} {at.id}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div className="inline-block px-2 py-1 text-xs sm:text-sm font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 max-w-[22ch] truncate" title={at.fileType}>
                            {at.fileType || t("attachments.empty")}
                          </div>
                        </td>

                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {t("attachments.uploadedPrefix")} {formatDate(at.createdAt)}
                        </td>

                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleDownload(at)}
                              disabled={downloading === at.id}
                              title={t("attachments.download")}
                              aria-label={t("attachments.download")}
                              className="inline-flex items-center px-2.5 py-1.5 rounded-md text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/50 disabled:opacity-50 transition-colors"
                            >
                              {downloading === at.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />}
                              <span className="hidden xl:inline ml-2">{t("attachments.download")}</span>
                            </button>

                            {String(at.fileType || "").includes("image") && (
                              <button
                                onClick={() => openPreview(at)}
                                title={t("attachments.preview")}
                                aria-label={t("attachments.preview")}
                                className="inline-flex items-center px-2.5 py-1.5 rounded-md text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              >
                                <Eye className="h-4 w-4" />
                                <span className="hidden xl:inline ml-2">{t("attachments.preview")}</span>
                              </button>
                            )}

                            <button
                              onClick={() => requestDelete(at.id)}
                              disabled={deleting === at.id}
                              title={t("attachments.delete")}
                              aria-label={t("attachments.delete")}
                              className="inline-flex items-center px-2.5 py-1.5 rounded-md text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/50 disabled:opacity-50 transition-colors"
                            >
                              {deleting === at.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                              <span className="hidden xl:inline ml-2">{t("attachments.delete")}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ---------- COMPACT GRID / CARD LIST: medium screens (md/lg breakpoints) ---------- */}
              <div className="hidden md:grid lg:hidden grid-cols-2 gap-4 p-4">
                {filtered.map((at) => (
                  <div key={at.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-3 shadow-sm flex flex-col justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 text-indigo-600 dark:text-indigo-300">
                        <IconForType fileType={at.fileType} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={at.fileName}>
                          {at.fileName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("attachments.idPrefix")} {at.id}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("attachments.uploadedPrefix")} {formatDate(at.createdAt)}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handleDownload(at)}
                        disabled={downloading === at.id}
                        title={t("attachments.download")}
                        aria-label={t("attachments.download")}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-800/50 disabled:opacity-60"
                      >
                        {downloading === at.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />}
                        <span>{t("attachments.download")}</span>
                      </button>

                      {String(at.fileType || "").includes("image") && (
                        <button
                          onClick={() => openPreview(at)}
                          title={t("attachments.preview")}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="xl:inline ml-2">{t("attachments.preview")}</span>
                        </button>
                      )}

                      <button
                        onClick={() => requestDelete(at.id)}
                        disabled={deleting === at.id}
                        title={t("attachments.delete")}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800/50 disabled:opacity-60"
                      >
                        {deleting === at.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                        <span>{t("attachments.delete")}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ---------- STACKED CARDS: small screens (sm) ---------- */}
              <div className="md:hidden p-4 space-y-3">
                {filtered.map((at) => (
                  <div key={at.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-3 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 text-indigo-600 dark:text-indigo-300">
                        <IconForType fileType={at.fileType} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={at.fileName}>
                          {at.fileName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("attachments.idPrefix")} {at.id}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("attachments.uploadedPrefix")} {formatDate(at.createdAt)}</div>
                        <div className="mt-2">
                          <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 truncate">{at.fileType || t("attachments.empty")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleDownload(at)}
                        disabled={downloading === at.id}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-800/50 disabled:opacity-60"
                        aria-label={t("attachments.download")}
                        title={t("attachments.download")}
                      >
                        {downloading === at.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />}
                        <span>{t("attachments.download")}</span>
                      </button>

                      {String(at.fileType || "").includes("image") && (
                        <button
                          onClick={() => openPreview(at)}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                          aria-label={t("attachments.preview")}
                          title={t("attachments.preview")}
                        >
                          <Eye className="h-4 w-4" />
                          <span>{t("attachments.preview")}</span>
                        </button>
                      )}

                      <button
                        onClick={() => requestDelete(at.id)}
                        disabled={deleting === at.id}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800/50 disabled:opacity-60"
                        aria-label={t("attachments.delete")}
                        title={t("attachments.delete")}
                      >
                        {deleting === at.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                        <span>{t("attachments.delete")}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <ImagePreviewModal src={preview?.src} name={preview?.name} onClose={() => setPreview(null)} t={t} />
      </div>

      {/* Confirm Modal for delete */}
      <ConfirmModal
        open={confirmOpen}
        title={t("attachments.deleteConfirmTitle") || "Delete attachment"}
        message={
          toDelete
            ? (t("attachments.deleteConfirmMessage", { name: toDelete.fileName }) || `Are you sure you want to delete "${toDelete.fileName}"?`)
            : (t("attachments.deleteConfirmMessageGeneric") || "Are you sure you want to delete this attachment?")
        }
        onCancel={() => {
          setConfirmOpen(false);
          setToDelete(null);
        }}
        onConfirm={performDelete}
        loading={Boolean(deleting)}
        confirmLabel={t("attachments.delete") || "Delete"}
        cancelLabel={t("attachments.cancel") || "Cancel"}
      />

      {/* Toast UI */}
      {toast && <div className="fixed z-50 right-5 bottom-5"><Toast message={toast.text} type={toast.type} onClose={handleToastClose} /></div>}
    </div>
  );
}
