// src/pages/AuditLogPage.jsx
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

/**
 * UI tweaks:
 * - compact responsive pagination buttons for mobile
 * - dark-mode friendly text everywhere
 * - hover/focus/active feedback on buttons
 * - skeletons keep reserved vertical space (no jitter)
 *
 * Functionality preserved.
 */

const SKELETON_ROWS = 8;
const DEFAULT_PAGE_SIZE = 100;
const ROW_HEIGHT_PX = 56; // approximate desktop table row height used to reserve vertical space

const SkeletonRowDesktop = () => (
  <tr>
    <td className="px-4 py-3 align-top">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-44 animate-pulse" />
    </td>
    <td className="px-4 py-3 align-top">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-36 animate-pulse" />
    </td>
    <td className="px-4 py-3 hidden lg:table-cell align-top">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-28 animate-pulse" />
    </td>
    <td className="px-4 py-3 align-top">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse" />
    </td>
    <td className="px-4 py-3 hidden lg:table-cell align-top">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
    </td>
    <td className="px-4 py-3 align-top">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4 animate-pulse" />
    </td>
  </tr>
);

const SkeletonCardMobile = () => (
  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-600 w-full">
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3 animate-pulse" />
    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2 animate-pulse" />
    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
  </div>
);

const AuditLogPage = ({ showToast }) => {
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

  const toggleRow = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedRows(newExpanded);
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

  // Button style helpers
  const compactBtn = "text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1 rounded-md transition-transform transform hover:-translate-y-0.5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const primaryBtn = `${compactBtn} bg-sky-600 hover:bg-sky-700 text-white shadow-sm`;
  const ghostBtn = `${compactBtn} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600`;

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 transition-colors duration-200">
      <div className="p-4 sm:p-6 max-w-8xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex min-w-0 gap-4 items-center">
            <div className="p-3 rounded-lg bg-white dark:bg-gray-800">
              <ClipboardCheck className="h-6 w-6 text-sky-600 dark:text-sky-300" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 truncate">
                {t("audit.title")}
              </h2>
              <p className="mt-1 text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-2xl">
                {t("audit.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <TopBar />
          </div>
        </div>

        {/* Card container */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 transition-colors duration-200">
          {/* Actions + Search */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div className="flex flex-col sm:flex-col md:flex-row gap-2 w-full md:w-auto">
              <button
                onClick={() => setShowFilters(!showFilters)}
                aria-pressed={showFilters}
                className={`${ghostBtn} flex items-center gap-2 justify-center w-full md:w-auto`}
              >
                <Filter size={14} />
                <span className="select-none">{showFilters ? t("audit.filters.hide") : t("audit.filters.show")}</span>
              </button>

              <button
                onClick={handleExportCSV}
                className={`${ghostBtn} flex items-center gap-2 justify-center w-full md:w-auto`}
              >
                <Download size={14} /> <span className="select-none">{t("audit.exportCsv")}</span>
              </button>
            </div>

            <div className="relative w-full md:w-1/3">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                placeholder={t("audit.searchPlaceholder")}
                className="block w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors duration-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t("audit.searchAria")}
              />
            </div>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors duration-200">
              <h3 className="text-base font-medium text-gray-800 dark:text-gray-100 mb-3">
                {t("audit.filters.title")}
              </h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-auto">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("audit.filters.fromDate")}
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors duration-200"
                  />
                </div>
                <div className="w-full sm:w-auto">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("audit.filters.toDate")}
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors duration-200"
                  />
                </div>
                <div className="flex items-end gap-2 mt-2 sm:mt-0">
                  <button
                    onClick={handleApplyFilters}
                    className={`${primaryBtn}`}
                  >
                    {t("audit.filters.apply")}
                  </button>
                  <button
                    onClick={handleClearFilters}
                    className={`${ghostBtn}`}
                  >
                    {t("audit.filters.clear")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Results count & paging info */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {total > 0
                  ? t("audit.results.showing", { start: startIndex, end: endIndex, total })
                  : t("audit.results.none")}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {t("audit.pageInfo", { page, totalPages })}
              </div>

              <div className="flex items-center gap-2">
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
          <div className="sm:hidden space-y-3">
            {loading ? (
              // stable skeletons on mobile; full width so no jitter left/right
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <div key={i} className="w-full">
                  <SkeletonCardMobile />
                </div>
              ))
            ) : filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
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
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {safeString(log.username) || safeString(log.name)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    {safeString(log.entity)}
                  </p>
                  <button
                    onClick={() => toggleRow(log.id)}
                    className="mt-2 text-xs text-blue-600 dark:text-blue-300 flex items-center gap-1"
                  >
                    {expandedRows.has(log.id) ? (
                      <>
                        {t("audit.expanded.hide")} <ChevronUp size={12} />
                      </>
                    ) : (
                      <>
                        {t("audit.expanded.show")} <ChevronDown size={12} />
                      </>
                    )}
                  </button>
                  {expandedRows.has(log.id) && (
                    <div className="mt-2 text-xs text-gray-700 dark:text-gray-200 space-y-1">
                      <p className="text-gray-600 dark:text-gray-300">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {t("audit.expanded.fullDetails")}:
                        </span>{" "}
                        {safeString(log.details)}
                      </p>
                      <p className="text-gray-600 dark:text-gray-300">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          ID:
                        </span>{" "}
                        {log.id}
                      </p>
                      <p className="text-gray-600 dark:text-gray-300">
                        <span className="font-medium text-gray-950 dark:text-gray-100">
                          IP:
                        </span>{" "}
                        {log.ipAddress || t("audit.na")}
                      </p>
                      <p className="text-gray-600 dark:text-gray-300">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          UA:
                        </span>{" "}
                        {log.userAgent || t("audit.na")}
                      </p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                  {t("audit.noLogs.title")}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 px-2 mx-auto max-w-md">
                  {searchQuery || fromDate || toDate ? t("audit.noLogs.tryAdjust") : t("audit.noLogs.none")}
                </p>
              </div>
            )}
          </div>

          {/* Desktop/table view */}
          <div className="hidden sm:block">
            <div
              className="border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm overflow-hidden transition-colors duration-200"
            >
              {loading ? (
                // Reserve vertical space so skeleton -> content doesn't jump
                <div className="overflow-x-auto" style={{ minHeight: `${SKELETON_ROWS * ROW_HEIGHT_PX}px` }}>
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-56">
                          {t("audit.table.timestamp")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t("audit.table.user")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                          {t("audit.table.entity")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-28">
                          {t("audit.table.action")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                          {t("audit.table.details")}
                        </th>
                        <th className="px-4 py-3 w-12" />
                      </tr>
                    </thead>

                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                        <SkeletonRowDesktop key={i} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : filteredLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                    <thead className="bg-gray-50 dark:bg-gray-700 transition-colors duration-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-56">
                          {t("audit.table.timestamp")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t("audit.table.user")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                          {t("audit.table.entity")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-28">
                          {t("audit.table.action")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                          {t("audit.table.details")}
                        </th>
                        <th className="px-4 py-3 w-12" />
                      </tr>
                    </thead>

                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 transition-colors duration-200">
                      {filteredLogs.map((log) => (
                        <React.Fragment key={log.id}>
                          <tr
                            className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-200"
                            onClick={() => toggleRow(log.id)}
                          >
                            <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 align-top truncate">
                              {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
                            </td>

                            <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 align-top truncate">
                              {safeString(log.username) || safeString(log.name)}
                            </td>

                            <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 hidden lg:table-cell align-top truncate max-w-[10rem]">
                              {safeString(log.entity) || t("audit.na")}
                            </td>

                            <td className="px-4 py-3 text-sm align-top">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
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

                            <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 hidden lg:table-cell align-top truncate max-w-[14rem]">
                              {safeString(log.details) || ""}
                            </td>

                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 align-top">
                              {expandedRows.has(log.id) ? (
                                <ChevronUp size={14} />
                              ) : (
                                <ChevronDown size={14} />
                              )}
                            </td>
                          </tr>

                          {expandedRows.has(log.id) && (
                            <tr className="bg-gray-50 dark:bg-gray-700 transition-colors duration-200">
                              <td colSpan="6" className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="font-medium mb-1 text-sm text-gray-900 dark:text-gray-100">
                                      {t("audit.expanded.fullDetails")}
                                    </h4>
                                    <pre className="whitespace-pre-wrap break-words bg-gray-100 dark:bg-gray-600 p-3 rounded text-xs text-gray-700 dark:text-gray-200">
                                      {safeString(log.details)}
                                    </pre>
                                  </div>
                                  <div className="mt-2 md:mt-0">
                                    <h4 className="font-medium mb-1 text-sm text-gray-900 dark:text-gray-100">
                                      {t("audit.expanded.additionalInfo")}
                                    </h4>
                                    <div className="text-xs space-y-1 text-gray-700 dark:text-gray-300">
                                      <p className="text-gray-600 dark:text-gray-300">
                                        <span className="font-medium text-gray-900 dark:text-gray-100">
                                          {t("audit.expanded.idLabel")}
                                        </span>{" "}
                                        {log.id}
                                      </p>
                                      <p className="text-gray-600 dark:text-gray-300">
                                        <span className="font-medium text-gray-900 dark:text-gray-100">
                                          {t("audit.expanded.entityLabel")}
                                        </span>{" "}
                                        {safeString(log.entity) || t("audit.na")}
                                      </p>
                                      <p className="text-gray-600 dark:text-gray-300">
                                        <span className="font-medium text-gray-900 dark:text-gray-100">
                                          {t("audit.expanded.ipLabel")}
                                        </span>{" "}
                                        {log.ipAddress || t("audit.na")}
                                      </p>
                                      <p className="text-gray-600 dark:text-gray-300">
                                        <span className="font-medium text-gray-900 dark:text-gray-100">
                                          {t("audit.expanded.userAgentLabel")}
                                        </span>{" "}
                                        {log.userAgent || t("audit.na")}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 bg-white dark:bg-gray-800 transition-colors duration-200">
                  <div className="flex justify-center mb-4">
                    <Search className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {t("audit.noLogs.title")}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 px-2 mx-auto max-w-md">
                    {searchQuery || fromDate || toDate ? t("audit.noLogs.tryAdjust") : t("audit.noLogs.none")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Simple bottom pagination (desktop & mobile) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {t("audit.pageFooter", {
              showing: logs.length,
              page,
              totalPages,
              total,
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

            <div className="px-2 py-1 text-sm text-gray-700 dark:text-gray-200">
              {t("audit.gotoPage")} <strong className="mx-1">{page}</strong> / <strong>{totalPages}</strong>
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
    </div>
  );
};

export default AuditLogPage;
