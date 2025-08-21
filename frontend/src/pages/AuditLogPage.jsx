import React, { useState, useEffect } from 'react';
import { Download, CogIcon, Search, Filter, X } from 'lucide-react';

// The Toast component to display messages
const Toast = ({ message, type, isVisible, onDismiss }) => {
  if (!isVisible) return null;

  let bgColor;
  let borderColor;
  let textColor;

  switch (type) {
    case 'success':
      bgColor = 'bg-green-100 dark:bg-green-900';
      borderColor = 'border-green-400 dark:border-green-700';
      textColor = 'text-green-700 dark:text-green-300';
      break;
    case 'error':
      bgColor = 'bg-red-100 dark:bg-red-900';
      borderColor = 'border-red-400 dark:border-red-700';
      textColor = 'text-red-700 dark:text-red-300';
      break;
    case 'info':
      bgColor = 'bg-blue-100 dark:bg-blue-900';
      borderColor = 'border-blue-400 dark:border-blue-700';
      textColor = 'text-blue-700 dark:text-blue-300';
      break;
    default:
      bgColor = 'bg-gray-100 dark:bg-gray-700';
      borderColor = 'border-gray-400 dark:border-gray-600';
      textColor = 'text-gray-800 dark:text-gray-200';
  }

  return (
    <div
      className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg transition-all duration-300 ease-in-out z-[100] max-w-sm
        ${bgColor} ${borderColor} ${textColor} border-l-4 transform ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{message}</span>
        <button 
          onClick={onDismiss} 
          className="ml-4 text-lg font-semibold hover:opacity-70 transition-opacity"
          aria-label="Close notification"
        >
          &times;
        </button>
      </div>
    </div>
  );
};

// The AuditLogPage component
const AuditLogPage = ({ showToast }) => {
  const mockAuditLogs = [
    { id: 1, timestamp: '2025-07-18 14:32', user: 'Alice', entity: 'Project', action: 'submitted', details: 'Project A submitted for review.' },
    { id: 2, timestamp: '2025-07-18 10:00', user: 'John', entity: 'Report', action: 'created', details: 'Monthly report Q3 created.' },
    { id: 3, timestamp: '2025-07-17 17:45', user: 'Bob', entity: 'Settings', action: 'updated', details: 'System email settings changed.' },
    { id: 4, timestamp: '2025-07-17 09:15', user: 'Alice', entity: 'Project', action: 'deleted', details: 'Project B permanently deleted.' },
    { id: 5, timestamp: '2025-07-16 12:30', user: 'John', entity: 'User', action: 'archived', details: 'User account of Jane Doe archived.' },
  ];

  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filteredLogs, setFilteredLogs] = useState(mockAuditLogs);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const applyFilters = () => {
      let tempLogs = mockAuditLogs;

      if (searchQuery) {
        const lowerCaseQuery = searchQuery.toLowerCase();
        tempLogs = tempLogs.filter(log =>
          log.user.toLowerCase().includes(lowerCaseQuery) ||
          log.entity.toLowerCase().includes(lowerCaseQuery) ||
          log.action.toLowerCase().includes(lowerCaseQuery) ||
          log.details.toLowerCase().includes(lowerCaseQuery)
        );
      }

      if (fromDate) {
        const fromDateTime = new Date(fromDate).setHours(0, 0, 0, 0);
        tempLogs = tempLogs.filter(log => new Date(log.timestamp).getTime() >= fromDateTime);
      }

      if (toDate) {
        const toDateTime = new Date(toDate).setHours(23, 59, 59, 999);
        tempLogs = tempLogs.filter(log => new Date(log.timestamp).getTime() <= toDateTime);
      }

      setFilteredLogs(tempLogs);
    };

    applyFilters();
  }, [searchQuery, fromDate, toDate]);

  const handleApplyFilters = () => {
    showToast('Filters applied', 'info');
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    showToast('Filters cleared', 'info');
  };

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'User', 'Entity', 'Action', 'Details'];
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + "\n" 
      + filteredLogs.map(log => [
        `"${log.timestamp}"`,
        `"${log.user}"`,
        `"${log.entity}"`,
        `"${log.action}"`,
        `"${log.details.replace(/"/g, '""')}"`
      ].join(',')).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "audit_log.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Export successful!', 'success');
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-gray-200">
          Audit Log
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            aria-label="Toggle filters"
          >
            <Filter size={18} />
            <span className="inline">Filters</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="btn-secondary flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            aria-label="Export audit log"
          >
            <Download size={18} />
            <span className="inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search Bar - Always visible */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search logs..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search logs"
        />
      </div>

      {/* Filters Panel - Collapsible on mobile */}
      {showFilters && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-4 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              From Date
            </label>
            <input
              type="date"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 dark:text-white"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              To Date
            </label>
            <input
              type="date"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 dark:text-white"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          
          <div className="flex items-end space-x-2 md:col-span-2">
            <button
              onClick={handleApplyFilters}
              className="flex-1 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors duration-200"
            >
              Apply
            </button>
            <button
              onClick={handleClearFilters}
              className="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Results Count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredLogs.length} of {mockAuditLogs.length} log entries
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {filteredLogs.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {['Timestamp', 'User', 'Entity', 'Action', 'Details'].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {log.timestamp}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {log.user}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
                      {log.entity}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      log.action === 'created' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                      log.action === 'updated' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                      log.action === 'deleted' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <div className="text-lg font-medium mb-2">No audit log entries found</div>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Tablet View */}
      <div className="hidden md:block lg:hidden">
        {filteredLogs.length > 0 ? (
          <div className="grid gap-4">
            {filteredLogs.map((log) => (
              <div key={log.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {log.timestamp}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    log.action === 'created' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                    log.action === 'updated' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                    log.action === 'deleted' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
                    'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}>
                    {log.action}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{log.user}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-sm text-blue-600 dark:text-blue-400">{log.entity}</span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">
                    {log.details}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <div className="text-lg font-medium mb-2">No audit log entries found</div>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-3">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <div key={log.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {log.timestamp}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  log.action === 'created' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                  log.action === 'updated' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                  log.action === 'deleted' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}>
                  {log.action}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{log.user}</span>
                  <span className="text-gray-400 text-xs">•</span>
                  <span className="text-xs text-blue-600 dark:text-blue-400">{log.entity}</span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 text-xs leading-relaxed">
                  {log.details}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            <div className="text-base font-medium mb-2">No entries found</div>
            <p className="text-xs">Adjust your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

// The main App component
const App = () => {
  const [toast, setToast] = useState({ message: '', type: '', isVisible: false });

  const showToast = (message, type) => {
    setToast({ message, type, isVisible: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, isVisible: false }));
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <header className="bg-white dark:bg-gray-800 shadow-sm p-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Audit Log
            </h1>
          </div>
        </div>
      </header>
      
      <main className="p-4 md:p-6 max-w-7xl mx-auto">
        <AuditLogPage showToast={showToast} />
      </main>
      
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onDismiss={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  );
};

export default App;