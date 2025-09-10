import React, { useState, useEffect } from 'react';
import { List, CheckCircle, FileText, X, Eye, Check, Download, AlertCircle, Filter, Search, User, BarChart3, ChevronDown, FileEditIcon } from 'lucide-react';
import { fetchAllReports, reviewReport, generateMasterReport } from '../api/reports';
import { fetchGroups } from '../api/groups';

// ---------- Main Reports Page ----------
export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('reports');
  const [reports, setReports] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  // Modals
  const [reportDetailModalOpen, setReportDetailModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportsData, groupsData] = await Promise.all([
        fetchAllReports(),
        fetchGroups()
      ]);
      setReports(reportsData || []);
      setGroups(groupsData || []);
    } catch (err) {
      setError(err.message || String(err));
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (report) => {
    setSelectedReport(report);
    setReportDetailModalOpen(true);
  };

  const handleOpenReview = (report) => {
    setSelectedReport(report);
    setReviewModalOpen(true);
  };

  const handleReviewSubmit = async (reviewData) => {
    try {
      setLoading(true);
      const updatedReport = await reviewReport(
        reviewData.reportId,
        { status: reviewData.status, adminComment: reviewData.adminComment }
      );
      setReports(prev => prev.map(r => r.id === updatedReport.id ? updatedReport : r));
      setReviewModalOpen(false);
      setSelectedReport(null);
    } catch (err) {
      setError(err.message || String(err));
      console.error('Error reviewing report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMasterReport = async (groupId) => {
    try {
      setLoading(true);
      const reportHtml = await generateMasterReport(groupId);
      
      // Open the report in a new window
      const newWindow = window.open();
      newWindow.document.write(reportHtml);
      newWindow.document.close();
    } catch (err) {
      setError(err.message);
      console.error('Error generating master report:', err);
    } finally {
      setLoading(false);
    }
  };

  const tabContent = {
    reports: <ViewReportsTab reports={reports} onViewDetails={handleViewDetails} loading={loading} />,
    review: <ReviewReportsTab reports={reports} onViewDetails={handleViewDetails} onOpenReview={handleOpenReview} loading={loading} />,
    master: <MasterReportTab groups={groups} onGenerateReport={handleGenerateMasterReport} loading={loading} />
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
      <header className="bg-gray-100 dark:bg-gray-900 shadow-sm">
        <div className="max-w-8xl mx-auto px-2 sm:px-4 lg:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4">
            <div className="flex items-center">
              <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-600 dark:text-indigo-400 mr-2 sm:mr-3" />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Reports Dashboard</h1>
            </div>
            <div className='w-full sm:w-auto bg-white dark:bg-gray-700 rounded-full px-1 py-1'>
              {/* Tabs Navigation */}
              <nav className="flex space-x-1 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`whitespace-nowrap py-2 px-3 sm:py-3 sm:px-4 border-2 rounded-full font-medium text-xs sm:text-sm flex items-center ${
                    activeTab === 'reports'
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <List className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  All Reports
                </button>
                <button
                  onClick={() => setActiveTab('review')}
                  className={`whitespace-nowrap py-2 px-3 sm:py-3 sm:px-4 border-2 rounded-full font-medium text-xs sm:text-sm flex items-center ${
                    activeTab === 'review'
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <CheckCircle className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Review
                </button>
                <button
                  onClick={() => setActiveTab('master')}
                  className={`whitespace-nowrap py-2 px-3 sm:py-3 sm:px-4 border-2 rounded-full font-medium text-xs sm:text-sm flex items-center ${
                    activeTab === 'master'
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <FileEditIcon className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Master
                </button>
              </nav>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-8xl mx-auto px-2 sm:px-4 lg:px-6 py-4 bg-gray-100 dark:bg-gray-900">
        {error && (
          <div className="my-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md flex items-center text-sm">
            <AlertCircle className="mr-2" size={16} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X size={16} />
            </button>
          </div>
        )}

        <div className="mt-4">
          {tabContent[activeTab]}
        </div>
      </main>

      {reportDetailModalOpen && selectedReport && (
        <ReportDetailModal report={selectedReport} onClose={() => setReportDetailModalOpen(false)} />
      )}

      {reviewModalOpen && selectedReport && (
        <ReviewModal report={selectedReport} onClose={() => setReviewModalOpen(false)} onSubmit={handleReviewSubmit} loading={loading} />
      )}
    </div>
  );
}

// ---------- Card Component ----------
const Card = ({ title, icon, children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden ${className}`}>
    <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex items-center">
      <div className="text-indigo-600 dark:text-indigo-400">{icon}</div>
      <h2 className="ml-2 text-base sm:text-lg font-semibold text-gray-800 dark:text-white">{title}</h2>
    </div>
    <div className="p-3 sm:p-4 md:p-6">{children}</div>
  </div>
);

// ---------- ViewReportsTab Component ----------
const ViewReportsTab = ({ reports, onViewDetails, loading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filteredReports = reports.filter(report => {
    const matchesSearch = (
      report.activity_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.narrative?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesStatus = !statusFilter || report.status === statusFilter;
    
    let matchesDate = true;
    if (dateFilter) {
      const reportDate = new Date(report.createdAt).toLocaleDateString();
      matchesDate = reportDate === new Date(dateFilter).toLocaleDateString();
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  if (loading) {
    return (
      <Card title="All Reports" icon={<List size={18} />}>
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card title="All Reports" icon={<List size={18} />}>
      <div className="mb-4 space-y-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          </div>
          <input 
            type="text" 
            placeholder="Search reports..." 
            className="block w-full pl-9 sm:pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            <Filter size={14} className="mr-1 sm:mr-2" />
            Filters
            <ChevronDown size={14} className={`ml-1 sm:ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {showFilters && (
            <div className="flex flex-col sm:flex-row gap-3">
              <select 
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>

              <input
                type="date"
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Activity</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">User</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredReports.length > 0 ? (
              filteredReports.map(report => <ReportRow key={report.id} report={report} onViewDetails={onViewDetails} />)
            ) : (
              <tr>
                <td colSpan="5" className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center">
                    <FileText className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mb-2" />
                    <p className="text-sm">No reports found</p>
                    <p className="text-xs mt-1">Try adjusting your search or filters</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// ---------- ReviewReportsTab Component ----------
const ReviewReportsTab = ({ reports, onViewDetails, onOpenReview, loading }) => {
  const pendingReports = reports.filter(report => report.status === 'Pending');

  if (loading) {
    return (
      <Card title="Review Reports" icon={<CheckCircle size={18} />}>
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Review Reports" icon={<CheckCircle size={18} />}>
      <div className="mb-4 flex items-center">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
          {pendingReports.length} Pending Reviews
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Activity</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">User</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {pendingReports.length > 0 ? (
              pendingReports.map(report => <ReportRow key={report.id} report={report} onViewDetails={onViewDetails} onOpenReview={onOpenReview} isReview={true} />)
            ) : (
              <tr>
                <td colSpan="5" className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center">
                    <CheckCircle className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mb-2" />
                    <p className="text-sm">No reports pending review</p>
                    <p className="text-xs mt-1">All reports have been reviewed</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// ---------- MasterReportTab Component ----------
const MasterReportTab = ({ groups, onGenerateReport, loading }) => {
  const [selectedGroup, setSelectedGroup] = useState('');
  const handleGenerate = () => onGenerateReport(selectedGroup || null);

  return (
    <Card title="Generate Master Report" icon={<FileEditIcon size={18} />}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="groupSelect" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Filter by Group (Optional)</label>
          <select 
            id="groupSelect" 
            value={selectedGroup} 
            onChange={(e) => setSelectedGroup(e.target.value)} 
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        
        <div className="flex items-end">
          <button 
            onClick={handleGenerate} 
            disabled={loading}
            className="w-full md:w-auto inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-2"></div>
                Generating...
              </>
            ) : (
              <>
                <Download size={14} className="mr-1 sm:mr-2" />
                Generate Report
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 sm:p-6 bg-gray-50 dark:bg-gray-700 min-h-[10rem] sm:min-h-[15rem] flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-2 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-1">Master Report</h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md">
            Generate a comprehensive report with details about goals, tasks, activities, and reports.
            Select a group to filter or generate for all groups.
          </p>
        </div>
      </div>
    </Card>
  );
};

// ---------- ReportRow Component ----------
const ReportRow = ({ report, onViewDetails, onOpenReview, isReview = false }) => {
  const statusStyles = { 
    Pending: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200', 
    Approved: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200', 
    Rejected: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' 
  };
  
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-300">
        {new Date(report.createdAt).toLocaleDateString()}
      </td>
      <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-900 dark:text-white max-w-[120px] sm:max-w-xs truncate">
        {report.activity_title}
      </td>
      <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-300 hidden sm:table-cell">
        <div className="flex items-center">
          <User size={12} className="mr-1 text-gray-400" />
          {report.user_name}
        </div>
      </td>
      <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-xs sm:text-sm">
        <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[report.status]}`}>
          {report.status}
        </span>
      </td>
      <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-xs sm:text-sm font-medium space-x-2">
        <button 
          onClick={() => onViewDetails(report)} 
          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 transition-colors inline-flex items-center"
        >
          <Eye size={14} className="mr-1" />
          <span className="hidden sm:inline">View</span>
        </button>
        {isReview && (
          <button 
            onClick={() => onOpenReview(report)} 
            className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 transition-colors inline-flex items-center"
          >
            <Check size={14} className="mr-1" />
            <span className="hidden sm:inline">Review</span>
          </button>
        )}
      </td>
    </tr>
  );
};

// ---------- ReportDetailModal Component ----------
const ReportDetailModal = ({ report, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Report Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        <div className="p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4">
              <div>
                <h4 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{report.activity_title}</h4>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Submitted by {report.user_name} on {new Date(report.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                report.status === 'Pending' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' : 
                report.status === 'Approved' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 
                'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
              }`}>
                {report.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <h5 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 text-sm sm:text-base">Activity Information</h5>
                <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                  <p className="text-gray-600 dark:text-gray-400"><span className="font-medium">Goal:</span> {report.goal_title}</p>
                  <p className="text-gray-600 dark:text-gray-400"><span className="font-medium">Task:</span> {report.task_title}</p>
                </div>
              </div>

              {report.metrics_data && Object.keys(report.metrics_data).length > 0 && (
                <div>
                  <h5 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 text-sm sm:text-base">Metrics</h5>
                  <ul className="text-xs sm:text-sm space-y-1">
                    {Object.entries(report.metrics_data).map(([key, value]) => (
                      <li key={key} className="text-gray-600 dark:text-gray-400">
                        <strong>{key}:</strong> {value}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <h5 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 text-sm sm:text-base">Narrative</h5>
              <p className="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-md text-xs sm:text-sm">
                {report.narrative}
              </p>
            </div>

            {report.new_status && (
              <div>
                <h5 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 text-sm sm:text-base">Status Change Requested</h5>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
                  User requested to mark activity as: <strong>{report.new_status}</strong>
                </p>
              </div>
            )}

            {report.adminComment && (
              <div>
                <h5 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 text-sm sm:text-base">Admin Comment</h5>
                <p className="text-gray-600 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900 p-3 rounded-md border-l-4 border-yellow-400 dark:border-yellow-600 text-xs sm:text-sm">
                  {report.adminComment}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 bg-gray-50 dark:bg-gray-700">
          <button
            onClick={onClose}
            className="w-full sm:w-auto inline-flex justify-center px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------- ReviewModal Component ----------
const ReviewModal = ({ report, onClose, onSubmit, loading }) => {
  const [status, setStatus] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => { 
    if (report) { 
      setStatus(''); 
      setComment(''); 
    } 
  }, [report]);

  const handleSubmit = () => {
    if (!status) { 
      alert('Please select a status.'); 
      return; 
    }
    onSubmit({ reportId: report.id, status, adminComment: comment });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md flex flex-col">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Review Report</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        <div className="p-3 sm:p-4 md:p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
              <select 
                value={status} 
                onChange={e => setStatus(e.target.value)} 
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                disabled={loading}
              >
                <option value="">Select status...</option>
                <option value="Approved">Approve</option>
                <option value="Rejected">Reject</option>
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Comment</label>
              <textarea 
                value={comment} 
                onChange={e => setComment(e.target.value)} 
                rows="3" 
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Add comments..."
                disabled={loading}
              ></textarea>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 bg-gray-50 dark:bg-gray-700 flex justify-end space-x-2 sm:space-x-3">
          <button 
            onClick={onClose} 
            disabled={loading}
            className="px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 text-xs sm:text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={loading}
            className="px-3 py-2 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-xs sm:text-sm"
          >
            {loading ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
};