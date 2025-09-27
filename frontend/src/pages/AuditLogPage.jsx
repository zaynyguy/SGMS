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

  const toggleRow = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLogs({
        from: fromDate ? new Date(fromDate).toISOString() : undefined,
        to: toDate ? new Date(toDate).toISOString() : undefined,
        limit: 500,
      });
      setLogs(data || []);
      setFilteredLogs(data || []);
    } catch (err) {
      console.error("Failed to load audit logs", err);
      showToast(t("audit.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

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
    loadLogs();
    setShowFilters(false);
    showToast(t("audit.filters.applied"), "info");
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    loadLogs();
    showToast(t("audit.filters.cleared"), "info");
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
            `"${(safeString(log.username) || safeString(log.name)).replace(
              /"/g,
              '""'
            )}"`,
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

    showToast(t("audit.export.success"), "success");
  };

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
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white truncate">
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
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md flex items-center gap-2 justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm"
                aria-pressed={showFilters}
              >
                <Filter size={14} />{" "}
                {showFilters ? t("audit.filters.hide") : t("audit.filters.show")}
              </button>

              <button
                onClick={handleExportCSV}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md flex items-center gap-2 justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm"
              >
                <Download size={14} /> {t("audit.exportCsv")}
              </button>
            </div>

            <div className="relative w-full md:w-1/3">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder={t("audit.searchPlaceholder")}
                className="block w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t("audit.searchAria")}
              />
            </div>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors duration-200">
              <h3 className="text-base font-medium text-gray-800 dark:text-white mb-3">
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
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
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
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  />
                </div>
                <div className="flex items-end gap-2 mt-2 sm:mt-0">
                  <button
                    onClick={handleApplyFilters}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm"
                  >
                    {t("audit.filters.apply")}
                  </button>
                  <button
                    onClick={handleClearFilters}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors text-sm"
                  >
                    {t("audit.filters.clear")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Results count */}
          <div className="mb-4 flex justify-between items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("audit.results.showing", {
                filtered: filteredLogs.length,
                total: logs.length,
              })}
            </p>
            {loading && (
              <div className="flex items-center text-blue-600 dark:text-blue-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                <span className="text-sm">{t("audit.loading")}</span>
              </div>
            )}
          </div>

          {/* Mobile stacked list */}
          <div className="sm:hidden space-y-3">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {log.createdAt
                        ? new Date(log.createdAt).toLocaleString()
                        : ""}
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
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {safeString(log.username) || safeString(log.name)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    {safeString(log.entity)}
                  </p>
                  <button
                    onClick={() => toggleRow(log.id)}
                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1"
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
                      <p>
                        <span className="font-medium">
                          {t("audit.expanded.details")}:
                        </span>{" "}
                        {safeString(log.details)}
                      </p>
                      <p>
                        <span className="font-medium">ID:</span> {log.id}
                      </p>
                      <p>
                        <span className="font-medium">IP:</span>{" "}
                        {log.ipAddress || t("audit.na")}
                      </p>
                      <p>
                        <span className="font-medium">UA:</span>{" "}
                        {log.userAgent || t("audit.na")}
                      </p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                  {t("audit.noLogs.title")}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 px-2 mx-auto max-w-md">
                  {searchQuery || fromDate || toDate
                    ? t("audit.noLogs.tryAdjust")
                    : t("audit.noLogs.none")}
                </p>
              </div>
            )}
          </div>

          {/* Desktop/table view */}
          <div className="hidden sm:block">
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm overflow-hidden transition-colors duration-200">
              {filteredLogs.length > 0 ? (
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
                              {log.createdAt
                                ? new Date(log.createdAt).toLocaleString()
                                : ""}
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
                              <td
                                colSpan="6"
                                className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="font-medium mb-1 text-sm">
                                      {t("audit.expanded.fullDetails")}
                                    </h4>
                                    <pre className="whitespace-pre-wrap break-words bg-gray-100 dark:bg-gray-600 p-3 rounded text-xs">
                                      {safeString(log.details)}
                                    </pre>
                                  </div>
                                  <div className="mt-2 md:mt-0">
                                    <h4 className="font-medium mb-1 text-sm">
                                      {t("audit.expanded.additionalInfo")}
                                    </h4>
                                    <div className="text-xs space-y-1">
                                      <p>
                                        <span className="font-medium">
                                          {t("audit.expanded.idLabel")}
                                        </span>{" "}
                                        {log.id}
                                      </p>
                                      <p>
                                        <span className="font-medium">
                                          {t("audit.expanded.entityLabel")}
                                        </span>{" "}
                                        {safeString(log.entity) || t("audit.na")}
                                      </p>
                                      <p>
                                        <span className="font-medium">
                                          {t("audit.expanded.ipLabel")}
                                        </span>{" "}
                                        {log.ipAddress || t("audit.na")}
                                      </p>
                                      <p>
                                        <span className="font-medium">
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
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                    {t("audit.noLogs.title")}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 px-2 mx-auto max-w-md">
                    {searchQuery || fromDate || toDate
                      ? t("audit.noLogs.tryAdjust")
                      : t("audit.noLogs.none")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogPage;
