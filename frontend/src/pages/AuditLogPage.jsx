import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Download, Search, Filter, ChevronDown, ChevronUp } from "lucide-react";
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

  // Toggle row expansion
  const toggleRow = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Fetch logs from backend
  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLogs({
        from: fromDate ? new Date(fromDate).toISOString() : undefined,
        to: toDate ? new Date(toDate).toISOString() : undefined,
        limit: 500,
      });
      setLogs(data);
      setFilteredLogs(data);
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

  // Safe function to extract string from possible object
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

  // Apply text search safely
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
    const headers = [t("audit.table.timestamp"), t("audit.table.user"), t("audit.table.entity"), t("audit.table.action"), t("audit.table.details")];
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

    showToast(t("audit.export.success"), "success");
  };

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 p-2 sm:p-4 transition-colors duration-200">
      <div className="max-w-8xl mx-auto">
{/* Header */}
<div className="flex flex-col gap-3">
  <div className="flex flex-wrap items-center gap-3 justify-between">
    {/* Title (left) */}
    <div className="flex items-center gap-3 min-w-0">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white truncate">{t("audit.title")}</h2>

      {/* Desktop (lg+): inline buttons next to title */}
      <div className="hidden lg:flex items-center gap-2 ml-3">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
        >
          <Filter size={14} /> {showFilters ? t("audit.filters.hide") : t("audit.filters.show")}
        </button>
        <button
          onClick={handleExportCSV}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
        >
          <Download size={14} /> {t("audit.exportCsv")}
        </button>
      </div>
    </div>

    {/* TopBar (always on right) */}
    <div className="min-w-0 ml-auto">
      <div className="flex justify-end">
        <TopBar />
      </div>
    </div>
  </div>

  {/* Tablet (md .. lg): buttons placed below the header, right-aligned under TopBar */}
  <div className="hidden md:flex lg:hidden justify-end gap-2">
    <button
      onClick={() => setShowFilters(!showFilters)}
      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
    >
      <Filter size={14} /> {showFilters ? t("audit.filters.hide") : t("audit.filters.show")}
    </button>
    <button
      onClick={handleExportCSV}
      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
    >
      <Download size={14} /> {t("audit.exportCsv")}
    </button>
  </div>

  {/* Mobile (smaller than md): full-width stacked buttons for touch */}
  <div className="flex flex-col sm:hidden gap-2">
    <button
      onClick={() => setShowFilters(!showFilters)}
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md flex items-center gap-2 justify-center bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
    >
      <Filter size={14} /> {showFilters ? t("audit.filters.hide") : t("audit.filters.show")}
    </button>
    <button
      onClick={handleExportCSV}
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md flex items-center gap-2 justify-center bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
    >
      <Download size={14} /> {t("audit.exportCsv")}
    </button>
  </div>
</div>


        {/* Search */}
        <div className="mb-4 sm:mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder={t("audit.searchPlaceholder")}
            className="block w-full pl-9 sm:pl-10 pr-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t("audit.searchAria")}
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-4 sm:mb-6 bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-base sm:text-lg font-medium text-gray-800 dark:text-white mb-2 sm:mb-3">{t("audit.filters.title")}</h3>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="w-full">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("audit.filters.fromDate")}</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="w-full">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("audit.filters.toDate")}</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex items-end gap-2 mt-2 sm:mt-0">
                <button
                  onClick={handleApplyFilters}
                  className="px-3 py-2 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm sm:text-base"
                >
                  {t("audit.filters.apply")}
                </button>
                <button
                  onClick={handleClearFilters}
                  className="px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm sm:text-base"
                >
                  {t("audit.filters.clear")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results Count */}
        <div className="mb-3 sm:mb-4 flex justify-between items-center">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {t("audit.results.showing", { filtered: filteredLogs.length, total: logs.length })}
          </p>
          {loading && (
            <div className="flex items-center text-blue-600 dark:text-blue-400">
              <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-current mr-1 sm:mr-2"></div>
              <span className="text-xs sm:text-sm">{t("audit.loading")}</span>
            </div>
          )}
        </div>

{/* Table */}
<div className="border border-gray-200 dark:border-gray-700 rounded-lg shadow overflow-hidden">
  {filteredLogs.length > 0 ? (
    // table scroll confined here (no page-level horizontal scroll)
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" style={{ width: 220 }}>
              {t("audit.table.timestamp")}
            </th>
            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              {t("audit.table.user")}
            </th>
            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
              {t("audit.table.entity")}
            </th>
            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" style={{ width: 120 }}>
              {t("audit.table.action")}
            </th>
            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
              <span className="inline-block max-w-[18rem] md:max-w-xs truncate">{t("audit.table.details")}</span>
            </th>
            <th className="px-2 sm:px-4 py-2 sm:py-3" style={{ width: 48 }} />
          </tr>
        </thead>

        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {filteredLogs.map((log) => (
            <React.Fragment key={log.id}>
              <tr
                className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                onClick={() => toggleRow(log.id)}
              >
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-800 dark:text-gray-200 align-top">
                  <div className="truncate">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}</div>
                </td>

                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-800 dark:text-gray-200 align-top min-w-0">
                  <div className="truncate">{safeString(log.username) || safeString(log.name)}</div>
                </td>

                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-800 dark:text-gray-200 hidden sm:table-cell align-top">
                  <div className="truncate max-w-[12rem]">{safeString(log.entity) || t("audit.na")}</div>
                </td>

                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm align-top">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      log.action === "create"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : log.action === "update"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                        : log.action === "delete"
                        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {safeString(log.action)}
                  </span>
                </td>

                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-800 dark:text-gray-200 hidden md:table-cell align-top">
                  <div className="break-words max-w-[18rem] md:max-w-xs truncate">{safeString(log.details) || ""}</div>
                </td>

                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400 align-top">
                  {expandedRows.has(log.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </td>
              </tr>

              {expandedRows.has(log.id) && (
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <td colSpan="6" className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-800 dark:text-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <h4 className="font-medium mb-1 text-xs sm:text-sm">{t("audit.expanded.fullDetails")}</h4>
                        <pre className="whitespace-pre-wrap break-words bg-gray-100 dark:bg-gray-600 p-2 sm:p-3 rounded text-xs">
                          {safeString(log.details)}
                        </pre>
                      </div>
                      <div className="mt-2 md:mt-0">
                        <h4 className="font-medium mb-1 text-xs sm:text-sm">{t("audit.expanded.additionalInfo")}</h4>
                        <div className="text-xs space-y-1">
                          <p><span className="font-medium">{t("audit.expanded.idLabel")}</span> {log.id}</p>
                          <p><span className="font-medium">{t("audit.expanded.entityLabel")}</span> {safeString(log.entity) || t("audit.na")}</p>
                          <p><span className="font-medium">{t("audit.expanded.ipLabel")}</span> {log.ipAddress || t("audit.na")}</p>
                          <p><span className="font-medium">{t("audit.expanded.userAgentLabel")}</span> {log.userAgent || t("audit.na")}</p>
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
    <div className="text-center py-8 sm:py-12 bg-white dark:bg-gray-800">
      <div className="flex justify-center mb-3 sm:mb-4">
        <Search className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-1">{t("audit.noLogs.title")}</h3>
      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 px-2">
        {searchQuery || fromDate || toDate ? t("audit.noLogs.tryAdjust") : t("audit.noLogs.none")}
      </p>
    </div>
  )}
</div>

        {/* Pagination (static placeholders) */}
        {filteredLogs.length > 0 && (
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
              {t("audit.pagination.range", { from: 1, to: filteredLogs.length, total: filteredLogs.length })}
            </p>
            <div className="flex gap-2">
              <button
                className="px-2 py-1 sm:px-3 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-xs sm:text-sm"
                disabled
              >
                {t("audit.pagination.previous")}
              </button>
              <button
                className="px-2 py-1 sm:px-3 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-xs sm:text-sm"
                disabled
              >
                {t("audit.pagination.next")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogPage;
