import React, { useState, useEffect } from "react";
import { Download, Search, Filter, ChevronDown, ChevronUp, Sun, Moon } from "lucide-react";
import { fetchAuditLogs } from "../api/audit";

const AuditLogPage = ({ showToast }) => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
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
      showToast("Error fetching audit logs", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [fromDate, toDate]);

  // Safe function to extract string from possible object
  const safeString = (field) => {
    if (!field) return "";
    if (typeof field === "string") return field;
    if (typeof field === "object") return JSON.stringify(field);
    return String(field);
  };

  // Apply text search safely
  useEffect(() => {
    const q = searchQuery.toLowerCase();
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
    showToast("Filters applied", "info");
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    loadLogs();
    showToast("Filters cleared", "info");
  };

  const handleExportCSV = () => {
    const headers = ["Timestamp", "User", "Entity", "Action", "Details"];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      headers.join(",") +
      "\n" +
      filteredLogs
        .map((log) =>
          [
            `"${new Date(log.createdAt).toLocaleString()}"`,
            `"${safeString(log.username) || safeString(log.name)}"`,
            `"${safeString(log.entity)}"`,
            `"${safeString(log.action)}"`,
            `"${safeString(log.details).replace(/"/g, '""')}"`,
          ].join(",")
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "audit_log.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Export successful!", "success");
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-2 sm:p-4 transition-colors duration-200">
      <div className="max-w-8xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Audit Log</h2>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm sm:text-base"
            >
              <Filter size={14} className="sm:w-4" /> {showFilters ? "Hide Filters" : "Show Filters"}
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm sm:text-base"
            >
              <Download size={14} className="sm:w-4" /> Export CSV
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
            placeholder="Search logs by user, entity, action, or details..."
            className="block w-full pl-9 sm:pl-10 pr-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-4 sm:mb-6 bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-base sm:text-lg font-medium text-gray-800 dark:text-white mb-2 sm:mb-3">Filter Logs</h3>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="w-full">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="w-full">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To Date</label>
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
                  Apply Filters
                </button>
                <button
                  onClick={handleClearFilters}
                  className="px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm sm:text-base"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results Count */}
        <div className="mb-3 sm:mb-4 flex justify-between items-center">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredLogs.length} of {logs.length} log entries
          </p>
          {loading && (
            <div className="flex items-center text-blue-600 dark:text-blue-400">
              <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-current mr-1 sm:mr-2"></div>
              <span className="text-xs sm:text-sm">Loading...</span>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg shadow">
          {filteredLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Timestamp</th>
                    <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User</th>
                    <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">Entity</th>
                    <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                    <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">Details</th>
                    <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredLogs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr 
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        onClick={() => toggleRow(log.id)}
                      >
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-800 dark:text-gray-200">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-800 dark:text-gray-200">
                          {safeString(log.username) || safeString(log.name)}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-800 dark:text-gray-200 hidden sm:table-cell">
                          {safeString(log.entity)}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            log.action === 'create' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            log.action === 'update' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            log.action === 'delete' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}>
                            {safeString(log.action)}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-800 dark:text-gray-200 max-w-xs truncate hidden md:table-cell">
                          {safeString(log.details)}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          {expandedRows.has(log.id) ? <ChevronUp size={14} className="sm:w-4" /> : <ChevronDown size={14} className="sm:w-4" />}
                        </td>
                      </tr>
                      {expandedRows.has(log.id) && (
                        <tr className="bg-gray-50 dark:bg-gray-700">
                          <td colSpan="6" className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-800 dark:text-gray-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <h4 className="font-medium mb-1 text-xs sm:text-sm">Full Details</h4>
                                <pre className="whitespace-pre-wrap bg-gray-100 dark:bg-gray-600 p-2 sm:p-3 rounded text-xs">
                                  {safeString(log.details)}
                                </pre>
                              </div>
                              <div className="mt-2 md:mt-0">
                                <h4 className="font-medium mb-1 text-xs sm:text-sm">Additional Information</h4>
                                <div className="text-xs space-y-1">
                                  <p><span className="font-medium">ID:</span> {log.id}</p>
                                  <p><span className="font-medium">Entity:</span> {safeString(log.entity)}</p>
                                  <p><span className="font-medium">IP Address:</span> {log.ipAddress || 'N/A'}</p>
                                  <p><span className="font-medium">User Agent:</span> {log.userAgent || 'N/A'}</p>
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
              <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-1">No audit log entries found</h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 px-2">
                {searchQuery || fromDate || toDate 
                  ? "Try adjusting your search or filter criteria" 
                  : "There are no audit log entries to display"
                }
              </p>
            </div>
          )}
        </div>

        {/* Pagination would go here */}
        {filteredLogs.length > 0 && (
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
              Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredLogs.length}</span> of{' '}
              <span className="font-medium">{filteredLogs.length}</span> results
            </p>
            <div className="flex gap-2">
              <button
                className="px-2 py-1 sm:px-3 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-xs sm:text-sm"
                disabled
              >
                Previous
              </button>
              <button
                className="px-2 py-1 sm:px-3 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-xs sm:text-sm"
                disabled
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogPage;