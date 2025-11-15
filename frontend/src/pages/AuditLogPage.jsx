import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Download,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
} from "lucide-react";
import { fetchAuditLogs } from "../api/audit";
import TopBar from "../components/layout/TopBar";
import Toast from "../components/common/Toast";

const SKELETON_ROWS = 8;
const DEFAULT_PAGE_SIZE = 100;
const ROW_HEIGHT_PX = 56;

const SkeletonRowDesktop = () => (
  <tr className="transition-all duration-500 ease-in-out">
    <td className="px-3 py-2 align-top transition-all duration-300">
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-40 animate-pulse transition-colors duration-300" />
    </td>
    <td className="px-3 py-2 align-top transition-all duration-300">
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse transition-colors duration-300" />
    </td>
    <td className="px-3 py-2 hidden lg:table-cell align-top transition-all duration-300">
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse transition-colors duration-300" />
    </td>
    <td className="px-3 py-2 align-top transition-all duration-300">
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse transition-colors duration-300" />
    </td>
    <td className="px-3 py-2 hidden lg:table-cell align-top transition-all duration-300">
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-60 animate-pulse transition-colors duration-300" />
    </td>
    <td className="px-3 py-2 align-top transition-all duration-300">
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4 animate-pulse transition-colors duration-300" />
    </td>
  </tr>
);

const SkeletonCardMobile = () => (
  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-600 w-full transition-all duration-500 ease-in-out transform hover:scale-[1.02]">
    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2 animate-pulse transition-colors duration-300" />
    <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-1.5 animate-pulse transition-colors duration-300" />
    <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse transition-colors duration-300" />
  </div>
);

const AuditLogPage = ({ showToast: propShowToast }) => {
  const { t } = useTranslation();

  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  // local single-toast state (simple fallback / local toast system)
  const [toast, setToast] = useState(null);

  // toggle row expand with smooth animation
  const toggleRow = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const safeString = (field) => {
    if (!field) return "";
    if (typeof field === "string") return field;
    if (typeof field === "object") {
      try {
        return JSON.stringify(field);
      } catch {
        return String(field);
      }
    }
    return String(field);
  };

  // normalize toast types to match your Toast component
  const normalizeToastType = (type) => {
    if (!type) return "create"; // default
    const tLower = String(type).toLowerCase();
    if (tLower === "success") return "create";
    if (tLower === "info") return "read";
    if (tLower === "warning") return "update";
    if (["create", "read", "update", "delete", "error"].includes(tLower)) return tLower;
    return "create";
  };

  const showToastLocal = (message, type = "create") => {
    const normalized = normalizeToastType(type);
    setToast({ id: Date.now(), message, type: normalized });
  };

  // final showToast used inside this component: prefer propShowToast if provided
  const showToast = (message, type = "create") => {
    if (typeof propShowToast === "function") {
      try {
        propShowToast(message, type);
      } catch (e) {
        // fallback to local toast if prop throws
        showToastLocal(message, type);
      }
    } else {
      showToastLocal(message, type);
    }
  };

  // fetch logs for current page, from/to and page/offset
  const loadLogs = async (opts = {}) => {
    const usePage = opts.page ?? page;
    const usePageSize = opts.pageSize ?? pageSize;
    setLoading(true);
    try {
      const offset = (usePage - 1) * usePageSize;
      const resp = await fetchAuditLogs({
        from: fromDate ? new Date(fromDate).toISOString() : undefined,
        to: toDate ? new Date(toDate).toISOString() : undefined,
        limit: usePageSize,
        offset,
      });

      // backend returns { rows, total }
      const dataRows = (resp && resp.rows) || [];
      const dataTotal = (resp && typeof resp.total === "number") ? resp.total : dataRows.length;

      setLogs(dataRows);
      setFilteredLogs(dataRows);
      setTotal(dataTotal);
    } catch (err) {
      console.error("Failed to load audit logs", err);
      showToast && showToast(t("audit.loadFailed"), "error");
      setLogs([]);
      setFilteredLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // reload when from/to/page change
  useEffect(() => {
    loadLogs({ page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, page]);

  // client-side search filters only current page (keeps UI snappy)
  useEffect(() => {
    const q = String(searchQuery || "").toLowerCase();
    const temp = logs.filter((log) => {
      return (
        safeString(log.username).toLowerCase().includes(q) ||
        safeString(log.name).toLowerCase().includes(q) ||
        safeString(log.entity).toLowerCase().includes(q) ||
        safeString(log.action).toLowerCase().includes(q) ||
        safeString(log.details).toLowerCase().includes(q)
      );
    });
    setFilteredLogs(temp);
  }, [searchQuery, logs]);

  const handleApplyFilters = () => {
    setPage(1);
    loadLogs({ page: 1 });
    setShowFilters(false);
    showToast && showToast(t("audit.filters.applied"), "info");
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    setPage(1);
    loadLogs({ page: 1 });
    showToast && showToast(t("audit.filters.cleared"), "info");
  };

  const handleExportCSV = () => {
    const headers = [
      t("audit.table.timestamp"),
      t("audit.table.user"),
      t("audit.table.entity"),
      t("audit.table.action"),
      t("audit.table.details"),
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      headers.join(",") +
      "\n" +
      filteredLogs
        .map((log) =>
          [
            `"${new Date(log.createdAt || "").toLocaleString()}"`,
            `"${(safeString(log.username) || safeString(log.name)).replace(/"/g, '""')}"`,
            `"${safeString(log.entity).replace(/"/g, '""')}"`,
            `"${safeString(log.action).replace(/"/g, '""')}"`,
            `"${safeString(log.details).replace(/"/g, '""')}"`,
          ].join(",")
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", t("audit.csv.filename"));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast && showToast(t("audit.export.success"), "success");
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (page - 1) * pageSize + (logs.length > 0 ? 1 : 0);
  const endIndex = startIndex + logs.length - 1;

  // Enhanced Button style helpers with smooth animations (kept compact)
  const compactBtn = "text-xs sm:text-xs px-2 sm:px-3 py-1 sm:py-1 rounded-md transition-all duration-500 ease-in-out transform hover:-translate-y-0.5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none";
  const primaryBtn = `${compactBtn} bg-sky-600 hover:bg-sky-700 text-white shadow-sm hover:shadow-md`;
  const ghostBtn = `${compactBtn} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 hover:shadow-sm`;

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 transition-all duration-500 ease-in-out text-xs">
      <div className="p-3 sm:p-5 max-w-8xl mx-auto animate-fade-in">
        {/* Header card */}
        <div className="mb-4 transition-all duration-500 ease-in-out">
          <div className="rounded-2xl bg-white dark:bg-gray-800 backdrop-blur-xs border border-gray-200/60 dark:border-gray-700/40 shadow-sm px-4 py-3 transition-all duration-500 animate-fade-in-down">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 gap-3 items-center">
                <div className="p-2 rounded-lg bg-gray-200 dark:bg-gray-900 transition-all duration-500 ease-in-out transform hover:scale-105 hover:shadow-lg">
                  <ClipboardCheck className="h-5 w-5 text-sky-600 dark:text-sky-300 transition-all duration-500 ease-in-out transform hover:rotate-12" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100 truncate transition-colors duration-500 ease-in-out">
                    {t("audit.title")}
                  </h2>
                  <p className="mt-0.5 text-xs sm:text-xs text-gray-600 dark:text-gray-300 max-w-2xl transition-colors duration-500 ease-in-out">
                    {t("audit.subtitle")}
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0 transition-all duration-500 ease-in-out">
                <TopBar />
              </div>
            </div>
          </div>
        </div>

        {/* Card container */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-5 transition-all duration-500 ease-in-out transform hover:shadow-lg">
          {/* Actions + Search */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3 transition-all duration-500 ease-in-out">
            <div className="flex flex-col sm:flex-col md:flex-row gap-2 w-full md:w-auto transition-all duration-500 ease-in-out">
              <button
                onClick={() => setShowFilters(!showFilters)}
                aria-pressed={showFilters}
                className={`${ghostBtn} flex items-center gap-2 justify-center w-full md:w-auto transition-all duration-500 ease-in-out`}
              >
                <Filter size={14} className="transition-all duration-500 ease-in-out transform hover:scale-110" />
                <span className="select-none transition-colors duration-500 ease-in-out text-xs">
                  {showFilters ? t("audit.filters.hide") : t("audit.filters.show")}
                </span>
              </button>

              <button
                onClick={handleExportCSV}
                className={`${ghostBtn} flex items-center gap-2 justify-center w-full md:w-auto transition-all duration-500 ease-in-out`}
              >
                <Download size={14} className="transition-all duration-500 ease-in-out transform hover:scale-110" />
                <span className="select-none transition-colors duration-500 ease-in-out text-xs">{t("audit.exportCsv")}</span>
              </button>
            </div>

            <div className="relative w-full md:w-1/3 transition-all duration-500 ease-in-out">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-all duration-500 ease-in-out">
                <Search className="h-4 w-4 text-gray-400 dark:text-gray-500 transition-all duration-500 ease-in-out transform hover:scale-110" />
              </div>
              <input
                type="text"
                placeholder={t("audit.searchPlaceholder")}
                className="block w-full pl-9 pr-3 py-2 text-xs sm:text-xs border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all duration-500 ease-in-out transform hover:scale-105 focus:scale-105"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t("audit.searchAria")}
              />
            </div>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="mb-5 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg transition-all duration-500 ease-in-out animate-fade-in">
              <h3 className="text-xs font-medium text-gray-800 dark:text-gray-100 mb-2 transition-colors duration-500 ease-in-out">
                {t("audit.filters.title")}
              </h3>
              <div className="flex flex-col sm:flex-row gap-3 transition-all duration-500 ease-in-out">
                <div className="w-full sm:w-auto transition-all duration-500 ease-in-out">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-500 ease-in-out">
                    {t("audit.filters.fromDate")}
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all duration-500 ease-in-out transform hover:scale-105"
                  />
                </div>
                <div className="w-full sm:w-auto transition-all duration-500 ease-in-out">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-500 ease-in-out">
                    {t("audit.filters.toDate")}
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all duration-500 ease-in-out transform hover:scale-105"
                  />
                </div>
                <div className="flex items-end gap-2 mt-2 sm:mt-0 transition-all duration-500 ease-in-out">
                  <button
                    onClick={handleApplyFilters}
                    className={`${primaryBtn}`}
                  >
                    <span className="text-xs">{t("audit.filters.apply")}</span>
                  </button>
                  <button
                    onClick={handleClearFilters}
                    className={`${ghostBtn}`}
                  >
                    <span className="text-xs">{t("audit.filters.clear")}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Results count & paging info */}
          <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 transition-all duration-500 ease-in-out">
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-300 transition-colors duration-500 ease-in-out">
                {total > 0
                  ? t("audit.results.showing", { start: startIndex, end: endIndex, total })
                  : t("audit.results.none")}
              </p>
            </div>

            <div className="flex items-center gap-2 transition-all duration-500 ease-in-out">
              <div className="text-xs text-gray-600 dark:text-gray-300 transition-colors duration-500 ease-in-out">
                {t("audit.pageInfo", { page, totalPages })}
              </div>

              <div className="flex items-center gap-2 transition-all duration-500 ease-in-out">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className={`${compactBtn || ""} ${ghostBtn}`}
                  aria-label={t("audit.prev")}
                >
                  {t("audit.prev")}
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className={`${compactBtn || ""} ${ghostBtn}`}
                  aria-label={t("audit.next")}
                >
                  {t("audit.next")}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile stacked list */}
          <div className="sm:hidden space-y-3 transition-all duration-500 ease-in-out">
            {loading ? (
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <div key={i} className="w-full transition-all duration-500 ease-in-out" style={{ animationDelay: `${i * 100}ms` }}>
                  <SkeletonCardMobile />
                </div>
              ))
            ) : filteredLogs.length > 0 ? (
              filteredLogs.map((log, index) => {
                const expanded = expandedRows.has(log.id);
                return (
                  <div
                    key={log.id}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-600 transition-all duration-500 ease-in-out transform hover:scale-[1.02] hover:shadow-lg"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex justify-between items-center mb-2 transition-all duration-500 ease-in-out">
                      <span className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-500 ease-in-out">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-500 ease-in-out transform hover:scale-110 ${
                          log.action === "create"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : log.action === "update"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : log.action === "delete"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200"
                        }`}
                      >
                        {safeString(log.action)}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-gray-900 dark:text-gray-100 transition-colors duration-500 ease-in-out">
                      {safeString(log.username) || safeString(log.name)}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 transition-colors duration-500 ease-in-out">
                      {safeString(log.entity)}
                    </p>

                    <button
                      onClick={(e) => { e.stopPropagation(); toggleRow(log.id); }}
                      className="mt-2 text-xs text-blue-600 dark:text-blue-300 flex items-center gap-1 transition-all duration-500 ease-in-out transform hover:scale-105"
                      aria-expanded={expanded}
                    >
                      {expanded ? (
                        <>
                          {t("audit.expanded.hide")}
                          <ChevronUp size={12} className="transition-all duration-500 ease-in-out transform rotate-0 hover:scale-125" />
                        </>
                      ) : (
                        <>
                          {t("audit.expanded.show")}
                          <ChevronDown size={12} className="transition-all duration-500 ease-in-out transform rotate-0 hover:scale-125" />
                        </>
                      )}
                    </button>

                    <div className={`
                      transition-all duration-500 ease-in-out overflow-hidden
                      ${expanded ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'}
                    `}>
                      <div className="text-xs text-gray-700 dark:text-gray-200 space-y-1">
                        <p className="text-gray-600 dark:text-gray-300 transition-colors duration-500 ease-in-out">
                          <span className="font-medium text-gray-900 dark:text-gray-100 transition-colors duration-500 ease-in-out">
                            {t("audit.expanded.fullDetails")}:
                          </span>{" "}
                          {safeString(log.details)}
                        </p>
                        <p className="text-gray-600 dark:text-gray-300 transition-colors duration-500 ease-in-out">
                          <span className="font-medium text-gray-900 dark:text-gray-100 transition-colors duration-500 ease-in-out">
                            {t('audit.expanded.idLabel')}
                          </span>{" "}
                          {log.id}
                        </p>
                        <p className="text-gray-600 dark:text-gray-300 transition-colors duration-500 ease-in-out">
                          <span className="font-medium text-gray-950 dark:text-gray-100 transition-colors duration-500 ease-in-out">
                            {t('audit.expanded.ipLabel')}
                          </span>{" "}
                          {log.ipAddress || t("audit.na")}
                        </p>
                        <p className="text-gray-600 dark:text-gray-300 transition-colors duration-500 ease-in-out">
                          <span className="font-medium text-gray-900 dark:text-gray-100 transition-colors duration-500 ease-in-out">
                            {t('audit.expanded.userAgentLabel')}
                          </span>{" "}
                          {log.userAgent || t("audit.na")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 transition-all duration-500 ease-in-out animate-pulse">
                <Search className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto transition-all duration-500 ease-in-out transform hover:scale-110" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1 transition-colors duration-500 ease-in-out">
                  {t("audit.noLogs.title")}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 px-2 mx-auto max-w-md transition-colors duration-500 ease-in-out">
                  {searchQuery || fromDate || toDate ? t("audit.noLogs.tryAdjust") : t("audit.noLogs.none")}
                </p>
              </div>
            )}
          </div>

          {/* Desktop/table view */}
          <div className="hidden sm:block transition-all duration-500 ease-in-out">
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm overflow-hidden transition-all duration-500 ease-in-out transform hover:shadow-lg">
              {loading ? (
                <div className="transition-all duration-500 ease-in-out" style={{ minHeight: `${SKELETON_ROWS * ROW_HEIGHT_PX}px` }}>
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600 transition-all duration-500 ease-in-out">
                    <thead className="bg-gray-50 dark:bg-gray-700 transition-all duration-500 ease-in-out">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-56 transition-all duration-500 ease-in-out">
                          {t("audit.table.timestamp")}
                        </th>
                        <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider transition-all duration-500 ease-in-out">
                          {t("audit.table.user")}
                        </th>
                        <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell transition-all duration-500 ease-in-out">
                          {t("audit.table.entity")}
                        </th>
                        <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-28 transition-all duration-500 ease-in-out">
                          {t("audit.table.action")}
                        </th>
                        <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell transition-all duration-500 ease-in-out">
                          {t("audit.table.details")}
                        </th>
                        <th className="px-3 py-2 w-12 transition-all duration-500 ease-in-out" />
                      </tr>
                    </thead>

                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 transition-all duration-500 ease-in-out">
                      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                        <SkeletonRowDesktop key={i} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : filteredLogs.length > 0 ? (
                <div className="transition-all duration-500 ease-in-out">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600 transition-all duration-500 ease-in-out">
                    <thead className="bg-gray-50 dark:bg-gray-700 transition-all duration-500 ease-in-out">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-56 transition-all duration-500 ease-in-out">
                          {t("audit.table.timestamp")}
                        </th>
                        <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider transition-all duration-500 ease-in-out">
                          {t("audit.table.user")}
                        </th>
                        <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell transition-all duration-500 ease-in-out">
                          {t("audit.table.entity")}
                        </th>
                        <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-28 transition-all duration-500 ease-in-out">
                          {t("audit.table.action")}
                        </th>
                        <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell transition-all duration-500 ease-in-out">
                          {t("audit.table.details")}
                        </th>
                        <th className="px-3 py-2 w-12 transition-all duration-500 ease-in-out" />
                      </tr>
                    </thead>

                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 transition-all duration-500 ease-in-out">
                      {filteredLogs.map((log, index) => (
                        <React.Fragment key={log.id}>
                          <tr
                            className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-all duration-500 ease-in-out transform hover:scale-[1.01]"
                            onClick={() => toggleRow(log.id)}
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            <td className="px-3 py-4 text-[12px] text-gray-800 dark:text-gray-200 align-top truncate transition-all duration-500 ease-in-out">
                              {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
                            </td>

                            <td className="px-3 py-4 text-[12px] text-gray-800 dark:text-gray-200 align-top truncate transition-all duration-500 ease-in-out">
                              {safeString(log.username) || safeString(log.name)}
                            </td>

                            <td className="px-3 py-4 text-[12px] text-gray-800 dark:text-gray-200 hidden lg:table-cell align-top truncate max-w-[10rem] transition-all duration-500 ease-in-out">
                              {safeString(log.entity) || t("audit.na")}
                            </td>

                            <td className="px-3 py-4 text-[12px] align-top transition-all duration-500 ease-in-out">
                              <span
                                className={`px-2 py-1 rounded-full text-[11px] font-medium transition-all duration-500 ease-in-out transform hover:scale-110 ${
                                  log.action === "create"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                    : log.action === "update"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                    : log.action === "delete"
                                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                    : "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200"
                                }`}
                              >
                                {safeString(log.action)}
                              </span>
                            </td>

                            <td className="px-3 py-4 text-[12px] text-gray-800 dark:text-gray-200 hidden lg:table-cell align-top truncate max-w-[14rem] transition-all duration-500 ease-in-out">
                              {safeString(log.details) || ""}
                            </td>

                            <td className="px-3 text-[12px] text-gray-500 dark:text-gray-400 align-top transition-all duration-500 ease-in-out">
                              <div className="transform transition-all duration-500 ease-in-out">
                                {/* Make the chevron an actual button and stop propagation so click doesn't bubble to the row */}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); toggleRow(log.id); }}
                                  aria-expanded={expandedRows.has(log.id)}
                                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-all duration-200 ease-in-out transform hover:scale-110"
                                  title={expandedRows.has(log.id) ? t("audit.expanded.hide") : t("audit.expanded.show")}
                                >
                                  {expandedRows.has(log.id) ? (
                                    <ChevronUp size={14} className="transition-all duration-500 ease-in-out transform" />
                                  ) : (
                                    <ChevronDown size={14} className="transition-all duration-500 ease-in-out transform" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>

                          <tr className={`
                            bg-gray-50 dark:bg-gray-700 transition-all duration-500 ease-in-out overflow-hidden
                            ${expandedRows.has(log.id) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
                          `}>
                            <td colSpan="6" className="px-3 py-0 transition-all duration-500 ease-in-out">
                              <div className={`
                                transition-all duration-500 ease-in-out overflow-hidden
                                ${expandedRows.has(log.id) ? 'max-h-96 opacity-100 py-3' : 'max-h-0 opacity-0 py-0'}
                              `}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 transition-all duration-500 ease-in-out">
                                  <div>
                                    <h4 className="font-medium mb-1 text-xs text-gray-900 dark:text-gray-100 transition-colors duration-500 ease-in-out">
                                      {t("audit.expanded.fullDetails")}
                                    </h4>
                                    <pre className="whitespace-pre-wrap break-words bg-gray-100 dark:bg-gray-600 p-3 rounded text-xs text-gray-700 dark:text-gray-200 transition-all duration-500 ease-in-out transform hover:scale-[1.02]">
                                      {safeString(log.details)}
                                    </pre>
                                  </div>
                                  <div className="mt-2 md:mt-0 transition-all duration-500 ease-in-out">
                                    <h4 className="font-medium mb-1 text-xs text-gray-900 dark:text-gray-100 transition-colors duration-500 ease-in-out">
                                      {t("audit.expanded.additionalInfo")}
                                    </h4>
                                    <div className="text-xs space-y-1 text-gray-700 dark:text-gray-300 transition-all duration-500 ease-in-out">
                                      <p className="text-gray-600 dark:text-gray-300 transition-colors duration-500 ease-in-out">
                                        <span className="font-medium text-gray-900 dark:text-gray-100 transition-colors duration-500 ease-in-out">
                                          {t("audit.expanded.idLabel")}
                                        </span>{" "}
                                        {log.id}
                                      </p>
                                      <p className="text-gray-600 dark:text-gray-300 transition-colors duration-500 ease-in-out">
                                        <span className="font-medium text-gray-900 dark:text-gray-100 transition-colors duration-500 ease-in-out">
                                          {t("audit.expanded.entityLabel")}
                                        </span>{" "}
                                        {safeString(log.entity) || t("audit.na")}
                                      </p>
                                      <p className="text-gray-600 dark:text-gray-300 transition-colors duration-500 ease-in-out">
                                        <span className="font-medium text-gray-900 dark:text-gray-100 transition-colors duration-500 ease-in-out">
                                          {t("audit.expanded.ipLabel")}
                                        </span>{" "}
                                        {log.ipAddress || t("audit.na")}
                                      </p>
                                      <p className="text-gray-600 dark:text-gray-300 transition-colors duration-500 ease-in-out">
                                        <span className="font-medium text-gray-900 dark:text-gray-100 transition-colors duration-500 ease-in-out">
                                          {t("audit.expanded.userAgentLabel")}
                                        </span>{" "}
                                        {log.userAgent || t("audit.na")}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 bg-white dark:bg-gray-800 transition-all duration-500 ease-in-out animate-fade-in">
                  <div className="flex justify-center mb-4 transition-all duration-500 ease-in-out">
                    <Search className="h-12 w-12 text-gray-400 dark:text-gray-500 transition-all duration-500 ease-in-out transform hover:scale-110" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1 transition-colors duration-500 ease-in-out">
                    {t("audit.noLogs.title")}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 px-2 mx-auto max-w-md transition-colors duration-500 ease-in-out">
                    {searchQuery || fromDate || toDate ? t("audit.noLogs.tryAdjust") : t("audit.noLogs.none")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Simple bottom pagination (desktop & mobile) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 transition-all duration-500 ease-in-out">
          <div className="text-xs text-gray-600 dark:text-gray-300 transition-colors duration-500 ease-in-out">
            {t("audit.pageFooter", {
              showing: logs.length,
              page,
              totalPages,
              total,
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 transition-all duration-500 ease-in-out">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1 || loading}
              className={`${compactBtn} ${ghostBtn}`}
              aria-label={t("audit.first")}
            >
              {t("audit.first")}
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className={`${compactBtn} ${ghostBtn}`}
              aria-label={t("audit.prev")}
            >
              {t("audit.prev")}
            </button>

            <div className="px-2 py-1 text-xs text-gray-700 dark:text-gray-200 transition-colors duration-500 ease-in-out">
              {t("audit.gotoPage")} <strong className="mx-1 transition-colors duration-500 ease-in-out">{page}</strong> / <strong className="transition-colors duration-500 ease-in-out">{totalPages}</strong>
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className={`${compactBtn} ${ghostBtn}`}
              aria-label={t("audit.next")}
            >
              {t("audit.next")}
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || loading}
              className={`${compactBtn} ${ghostBtn}`}
              aria-label={t("audit.last")}
            >
              {t("audit.last")}
            </button>
          </div>
        </div>
      </div>

      {/* Render the toast (single at a time). If a parent passed showToast, it will be used instead. */}
      {toast && (
        <div className="fixed z-50 right-5 bottom-5 transition-all duration-500 ease-in-out animate-bounce">
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
};

export default AuditLogPage;
