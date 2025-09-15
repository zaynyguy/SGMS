import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  Trash,
  Download,
  File,
  FileText,
  Image as ImgIcon,
  Eye,
  List,
  X,
  Search,
  Grid
} from "lucide-react";
import { fetchAttachments, deleteAttachment, downloadAttachment } from "../api/attachments";

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

/* Pill toggle (keeps visible and compact) */
function PillToggle({ value, onChange, t }) {
  return (
    <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-full p-1 gap-1 shadow-sm" role="tablist">
      <button
        onClick={() => onChange("grid")}
        aria-pressed={value === "grid"}
        className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition ${
          value === "grid"
            ? "bg-white dark:bg-gray-700 shadow text-sky-700 dark:text-sky-300"
            : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
        title={t("attachments.view.gridTitle")}
      >
        <Grid className="h-4 w-4" />
        <span className="hidden sm:inline">{t("attachments.view.grid")}</span>
      </button>
      <button
        onClick={() => onChange("table")}
        aria-pressed={value === "table"}
        className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition ${
          value === "table"
            ? "bg-white dark:bg-gray-700 shadow text-sky-700 dark:text-sky-300"
            : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
        title={t("attachments.view.tableTitle")}
      >
        <List className="h-4 w-4" />
        <span className="hidden sm:inline">{t("attachments.view.table")}</span>
      </button>
    </div>
  );
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
          <img src={src} alt={name} className="max-w-full max-h-[80vh] object-contain rounded" />
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
  const [viewMode, setViewMode] = useState("grid");
  const [preview, setPreview] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

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
      setError(err?.message || t("attachments.messages.failedLoad"));
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (at) => {
    try {
      setDownloading(at.id);
      const res = await downloadAttachment(at.id);

      if (res.url && !res.blob) {
        // open external url in new tab (for cloud/redirects)
        const w = window.open(res.url, "_blank");
        if (!w) window.location.href = res.url; // fallback
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
    } catch (err) {
      console.error("Download error:", err);
      // show friendly message localized
      alert(err?.message || t("attachments.messages.downloadFailed"));
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("attachments.confirmDelete"))) return;
    try {
      setDeleting(id);
      await deleteAttachment(id);
      setAttachments((p) => p.filter((x) => x.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
      alert(err?.message || t("attachments.messages.deleteFailed"));
    } finally {
      setDeleting(null);
    }
  };

  const openPreview = (at) => {
    // build absolute URL for /uploads local files
    let src = at.filePath || at.url || at.url;
    if (src && src.startsWith("/")) src = `${window.location.origin}${src}`;
    setPreview({ src, name: at.fileName });
  };

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
        {/* Header row: left title, right controls. We force them to stay in one line by using flex, min-w-0 on search. */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("attachments.title")}</h1>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none min-w-0">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("attachments.searchPlaceholder")}
                className="pl-10 pr-9 py-2 w-full sm:w-72 rounded-md border bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white min-w-0"
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

            <div className="flex-shrink-0">
              <PillToggle value={viewMode} onChange={setViewMode} t={t} />
            </div>
          </div>
        </div>

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
          ) : viewMode === "table" ? (
            <div className="overflow-auto">
              <table className="min-w-full table-auto">
                <thead className="bg-gray-50 dark:bg-gray-700 text-left">
                  <tr>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t("attachments.table.file")}</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t("attachments.table.type")}</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">{t("attachments.table.uploaded")}</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-right">{t("attachments.table.actions")}</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filtered.map((at) => (
                    <tr key={at.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors align-top">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center min-w-0">
                          <div className="flex-shrink-0 h-10 w-10 text-indigo-600 dark:text-indigo-400">
                            <IconForType fileType={at.fileType} />
                          </div>
                          <div className="ml-4 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[60ch]" title={at.fileName}>
                              {at.fileName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{t("attachments.idPrefix")} {at.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 max-w-[22ch] truncate" title={at.fileType}>
                          {at.fileType || t("attachments.empty")}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        {t("attachments.uploadedPrefix")} {formatDate(at.createdAt)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button
                            onClick={() => handleDownload(at)}
                            disabled={downloading === at.id}
                            title={t("attachments.download")}
                            aria-label={t("attachments.download")}
                            className="inline-flex items-center px-2.5 py-1.5 rounded-md text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/50 disabled:opacity-50 transition-colors"
                          >
                            {downloading === at.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />}
                            <span className="hidden md:inline ml-2">{t("attachments.download")}</span>
                          </button>

                          {String(at.fileType || "").includes("image") && (
                            <button
                              onClick={() => openPreview(at)}
                              title={t("attachments.preview")}
                              aria-label={t("attachments.preview")}
                              className="inline-flex items-center px-2.5 py-1.5 rounded-md text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="hidden md:inline ml-2">{t("attachments.preview")}</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(at.id)}
                            disabled={deleting === at.id}
                            title={t("attachments.delete")}
                            aria-label={t("attachments.delete")}
                            className="inline-flex items-center px-2.5 py-1.5 rounded-md text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/50 disabled:opacity-50 transition-colors"
                          >
                            {deleting === at.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash className="h-4 w-4" />}
                            <span className="hidden md:inline ml-2">{t("attachments.delete")}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            // Grid view responsive columns: 1 / 2 / 3
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((at) => (
                  <div key={at.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 text-indigo-600 dark:text-indigo-300">
                        <IconForType fileType={at.fileType} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={at.fileName}>
                          {at.fileName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{t("attachments.idPrefix")} {at.id}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{t("attachments.uploadedPrefix")} {formatDate(at.createdAt)}</div>

                        <div className="mt-2">
                          <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 max-w-[18ch] truncate" title={at.fileType}>
                            {at.fileType || t("attachments.empty")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2 items-center flex-wrap">
                      <button
                        onClick={() => handleDownload(at)}
                        disabled={downloading === at.id}
                        title={t("attachments.download")}
                        className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-800/50 disabled:opacity-60"
                      >
                        {downloading === at.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />}
                        <span className="hidden md:inline">{t("attachments.download")}</span>
                      </button>

                      {String(at.fileType || "").includes("image") && (
                        <button
                          onClick={() => openPreview(at)}
                          title={t("attachments.preview")}
                          className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden md:inline">{t("attachments.preview")}</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(at.id)}
                        disabled={deleting === at.id}
                        title={t("attachments.delete")}
                        className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800/50 disabled:opacity-60"
                      >
                        {deleting === at.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash className="h-4 w-4" />}
                        <span className="hidden md:inline">{t("attachments.delete")}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <ImagePreviewModal src={preview?.src} name={preview?.name} onClose={() => setPreview(null)} t={t} />
      </div>
    </div>
  );
}
