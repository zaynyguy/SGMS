import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';

const AuditLogTab = ({ showToast }) => {
  const { t } = useTranslation();
  const mockAuditLogs = [
    { id: 1, timestamp: '2025-07-18 14:32', user: t('admin.auditLog.mockUsers.alice'), entity: 'Project', action: t('admin.auditLog.actions.submitted'), details: t('admin.auditLog.mockDetails.projectSubmitted') },
    { id: 2, timestamp: '2025-07-18 10:00', user: t('admin.auditLog.mockUsers.john'), entity: 'Report', action: t('admin.auditLog.actions.created'), details: t('admin.auditLog.mockDetails.reportCreated') },
    // ... other mock logs with translated strings
  ];

  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filteredLogs, setFilteredLogs] = useState(mockAuditLogs);

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
    showToast(t('admin.auditLog.toast.filtersApplied'), 'info');
  };

  const handleExportCSV = () => {
    const headers = [
      t('admin.auditLog.tableHeaders.timestamp'),
      t('admin.auditLog.tableHeaders.user'),
      t('admin.auditLog.tableHeaders.entity'),
      t('admin.auditLog.tableHeaders.action'),
      t('admin.auditLog.tableHeaders.details')
    ];
    
    // ... rest of CSV export logic
    
    showToast(t('admin.auditLog.toast.exportSuccess'), 'success');
  };

  return (
    <section id="auditLog" role="tabpanel" aria-labelledby="auditLog-tab" className="p-4 space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          {t('admin.auditLog.title')}
        </h2>
        <button
          onClick={handleExportCSV}
          className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          aria-label={t('admin.auditLog.exportButton')}
        >
          <Download size={20} /> {t('admin.auditLog.exportButton')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-md shadow-sm">
        <input
          type="text"
          placeholder={t('admin.auditLog.searchPlaceholder')}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white flex-grow md:flex-grow-0 md:w-1/3"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t('admin.auditLog.searchLabel')}
        />
        
        <label htmlFor="from-date" className="text-xl flex items-center">
          {t('admin.auditLog.fromDate')}
        </label>
        <input
          type="date"
          id="from-date"
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        
        <label htmlFor="to-date" className="text-xl flex items-center">
          {t('admin.auditLog.toDate')}
        </label>
        <input
          type="date"
          id="to-date"
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        
        <button
          onClick={handleApplyFilters}
          className="btn-primary px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors duration-200"
        >
          {t('admin.auditLog.applyFilters')}
        </button>
      </div>

      {/* Table View */}
      <div className="hidden md:block overflow-x-auto rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {filteredLogs.length > 0 ? (
          <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {[
                  'timestamp',
                  'user',
                  'entity',
                  'action',
                  'details'
                ].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t(`admin.auditLog.tableHeaders.${header}`)}
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
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {log.user}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {log.entity}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            {t('admin.auditLog.noEntries')}
          </div>
        )}
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <div key={log.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {log.timestamp}
                </span>
              </div>
              <div className="text-sm">
                <div className="flex items-center space-x-1">
                  <span className="font-semibold">{log.user}</span>
                  <span className="text-gray-500 dark:text-gray-400">|</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {log.action}
                  </span>
                </div>
                <div className="text-gray-700 dark:text-gray-300 mt-1">
                  {log.details}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            {t('admin.auditLog.noEntries')}
          </div>
        )}
      </div>
    </section>
  );
};

export default AuditLogTab;