import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchDashboardSummary, fetchDashboardCharts, fetchOverdueTasks } from '../api/dashboard';
import { Sun, Moon, RefreshCw, TrendingUp, AlertTriangle, FileText, Target, Calendar, Filter } from 'lucide-react';

// Progress Bar Component
const ProgressBar = ({ value, max = 100, color = 'blue' }) => {
  const progress = Math.min(Math.max(parseInt(value || 0), 0), max);
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  };

  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
      <div 
        className={`h-2.5 rounded-full ${colorClasses[color]}`}
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState([]);
  const [overdueTasks, setOverdueTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupId, setGroupId] = useState(null);
  const [chartType, setChartType] = useState('group');
  const [darkMode, setDarkMode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [chartType, groupId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setIsRefreshing(true);
      const [summaryData, chartsData, overdueData] = await Promise.all([
        fetchDashboardSummary(groupId),
        fetchDashboardCharts(chartType, groupId),
        fetchOverdueTasks(5, groupId)
      ]);

      setSummary(summaryData);
      setCharts(chartsData);
      setOverdueTasks(overdueData);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-200 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 p-4 sm:p-6 transition-colors duration-200">
      <div className="max-w-8xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Welcome to your productivity dashboard</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select 
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="flex-1 sm:flex-none border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="group">By Group</option>
              <option value="tasks">By Tasks</option>
              <option value="priority">By Priority</option>
            </select>
            <button 
              onClick={loadDashboardData}
              disabled={isRefreshing}
              className="inline-flex items-center bg-blue-600 dark:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={18} className={`mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 transition-colors">
            <div className="flex items-center">
              <div className="p-2 sm:p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <Target size={20} />
              </div>
              <div className="ml-3 sm:ml-4">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">Goals Progress</h2>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{summary?.overall_goal_progress}%</p>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <ProgressBar value={summary?.overall_goal_progress} color="blue" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 transition-colors">
            <div className="flex items-center">
              <div className="p-2 sm:p-3 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                <TrendingUp size={20} />
              </div>
              <div className="ml-3 sm:ml-4">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">Tasks Progress</h2>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{summary?.overall_task_progress}%</p>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <ProgressBar value={summary?.overall_task_progress} color="green" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 transition-colors">
            <div className="flex items-center">
              <div className="p-2 sm:p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">
                <Calendar size={20} />
              </div>
              <div className="ml-3 sm:ml-4">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">Activities Progress</h2>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{summary?.overall_activity_progress}%</p>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <ProgressBar value={summary?.overall_activity_progress} color="yellow" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 transition-colors">
            <div className="flex items-center">
              <div className="p-2 sm:p-3 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                <FileText size={20} />
              </div>
              <div className="ml-3 sm:ml-4">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">Pending Reports</h2>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{summary?.pending_reports}</p>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Charts and Overdue Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 transition-colors">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">Progress Overview</h2>
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      formatter={(value) => [`${value}%`, 'Progress']} 
                      contentStyle={{ 
                        backgroundColor: darkMode ? '#1F2937' : '#FFFFFF',
                        borderColor: darkMode ? '#374151' : '#E5E7EB',
                        color: darkMode ? '#F3F4F6' : '#1F2937'
                      }} 
                    />
                    <Legend />
                    <Bar dataKey="progress" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 transition-colors">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Overdue Tasks</h2>
              <AlertTriangle className="text-red-500" size={20} />
            </div>
            <div className="space-y-3 sm:space-y-4">
              {overdueTasks.map((task) => (
                <div key={task.id} className="border-l-4 border-red-500 pl-3 sm:pl-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-r">
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">{task.title}</h3>
                  <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                    <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                    <span className={`mt-1 sm:mt-0 inline-flex px-2 py-1 rounded-full text-xs ${
                      task.priority === 'High' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' :
                      task.priority === 'Medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' :
                      'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))}
              {overdueTasks.length === 0 && (
                <div className="text-center py-6 sm:py-8">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">No overdue tasks! 🎉</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Counts Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 text-center transition-colors">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-3">
              <Target size={24} />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">Goals</h3>
            <span className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 block mt-1">{summary?.goals_count}</span>
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">Total Goals</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 text-center transition-colors">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mb-3">
              <TrendingUp size={24} />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">Tasks</h3>
            <span className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400 block mt-1">{summary?.tasks_count}</span>
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">Total Tasks</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 text-center transition-colors">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 mb-3">
              <Calendar size={24} />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">Activities</h3>
            <span className="text-2xl sm:text-3xl font-bold text-yellow-600 dark:text-yellow-400 block mt-1">{summary?.activities_count}</span>
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">Total Activities</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;