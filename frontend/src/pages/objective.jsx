import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, ChevronRight, ChevronDown, 
  Target, List, CheckSquare, Calendar, AlertCircle, Loader,
  RefreshCw
} from 'lucide-react';
import { fetchGoals, createGoal, updateGoal, deleteGoal } from '../api/goals';
import { fetchTasksByGoal, createTask, updateTask, deleteTask } from '../api/tasks';
import { fetchActivitiesByTask, createActivity, updateActivity, deleteActivity } from '../api/activities';

const ObjectiveManager = () => {
  // State
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState({});
  const [activities, setActivities] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedGoal, setExpandedGoal] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, type: null, data: null });
  const [formData, setFormData] = useState({}); // still available for non-modal usage if you want
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load goals on mount / page change
  useEffect(() => {
    loadGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  const loadGoals = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchGoals(currentPage, pageSize);
      const rows = res?.rows ?? res ?? [];
      setGoals(rows);
    } catch (err) {
      console.error('Error loading goals:', err);
      setError(err?.message || 'Failed to load goals');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTasks = async (goalId) => {
    try {
      const response = await fetchTasksByGoal(goalId);
      setTasks(prev => ({ ...prev, [goalId]: Array.isArray(response) ? response : response?.rows ?? [] }));
    } catch (err) {
      console.error('Error loading tasks:', err);
      setError('Failed to load tasks. Please try again.');
    }
  };

  // Note: backend route expects a taskId. We accept (goalId, taskId) for convenience in callers.
  const loadActivities = async (goalId, taskId) => {
    if (!taskId) {
      console.warn('loadActivities called with missing ids', { goalId, taskId });
      // set empty list if asked
      setActivities(prev => ({ ...prev, [taskId]: [] }));
      return;
    }
    try {
      const response = await fetchActivitiesByTask(taskId); // pass only taskId to API
      const list = Array.isArray(response) ? response : response?.rows ?? [];
      setActivities(prev => ({ ...prev, [taskId]: list }));
    } catch (err) {
      console.error('Error loading activities:', err);
      setError('Failed to load activities. Please check the server or try again.');
    }
  };

  // Goal handlers
  const handleCreateGoal = async (payload = null) => {
    try {
      setIsSubmitting(true);
      const body = payload || formData;
      await createGoal(body);
      setModal({ isOpen: false, type: null, data: null });
      setFormData({});
      setSuccess('Goal created successfully!');
      setTimeout(() => setSuccess(null), 3000);
      await loadGoals();
    } catch (err) {
      console.error('Error creating goal:', err);
      setError(err?.message || 'Failed to create goal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateGoal = async (payload = null) => {
    try {
      setIsSubmitting(true);
      const { id } = modal.data || {};
      if (!id) throw new Error('Missing goal id for update');
      const body = payload || formData;
      await updateGoal(id, body);
      setModal({ isOpen: false, type: null, data: null });
      setFormData({});
      setSuccess('Goal updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
      await loadGoals();
    } catch (err) {
      console.error('Error updating goal:', err);
      setError(err?.message || 'Failed to update goal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm('Are you sure you want to delete this goal? All associated tasks and activities will also be deleted.')) return;
    try {
      await deleteGoal(goalId);
      setSuccess('Goal deleted successfully!');
      setTimeout(() => setSuccess(null), 3000);
      await loadGoals();
    } catch (err) {
      console.error('Error deleting goal:', err);
      setError(err?.message || 'Failed to delete goal.');
    }
  };

  // Task handlers
  const handleOpenEditTask = (goalId, task) => {
    // DO NOT set formData globally here (it caused re-render resets and focus loss). Use modal local state.
    setModal({ isOpen: true, type: 'editTask', data: { goalId, ...task } });
  };

  const handleCreateTask = async (payload = null) => {
    try {
      setIsSubmitting(true);
      const { goalId } = modal.data || {};
      if (!goalId) throw new Error('Missing goalId for creating task');
      const body = payload || formData;
      await createTask(goalId, body);
      setModal({ isOpen: false, type: null, data: null });
      setFormData({});
      setSuccess('Task created successfully!');
      setTimeout(() => setSuccess(null), 3000);
      await loadTasks(goalId);
      await loadGoals();
    } catch (err) {
      console.error('Error creating task:', err);
      setError(err?.message || 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTask = async (payload = null) => {
    try {
      setIsSubmitting(true);
      const { goalId, id: taskId } = modal.data || {};
      if (!goalId || !taskId) throw new Error('Missing ids for updating task');
      const body = payload || formData;
      await updateTask(goalId, taskId, body);
      setModal({ isOpen: false, type: null, data: null });
      setFormData({});
      setSuccess('Task updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
      await loadTasks(goalId);
      await loadGoals();
    } catch (err) {
      console.error('Error updating task:', err);
      setError(err?.message || 'Failed to update task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async (goalId, taskId) => {
    if (!window.confirm('Delete this task and all its activities?')) return;
    try {
      await deleteTask(goalId, taskId);
      setSuccess('Task deleted successfully!');
      setTimeout(() => setSuccess(null), 3000);
      await loadTasks(goalId);
      await loadGoals();
    } catch (err) {
      console.error('Error deleting task:', err);
      setError(err?.message || 'Failed to delete task.');
    }
  };

  // Activity handlers
  const handleOpenEditActivity = (goalId, taskId, activity) => {
    // store ids and activity data in modal.data; modal will create its own local copy
    setModal({ isOpen: true, type: 'editActivity', data: { goalId, taskId, ...activity } });
  };

 // Fixed handleCreateActivity
const handleCreateActivity = async (activityData) => {
  try {
    setIsSubmitting(true);
    const { goalId, taskId } = modal.data || {};
    if (!taskId) throw new Error('Missing taskId for activity creation');

    const createdActivity = await createActivity(taskId, activityData);

    // Update local activities state immediately
    setActivities(prev => {
      const existing = prev[taskId] ? [...prev[taskId]] : [];
      return { ...prev, [taskId]: [createdActivity, ...existing] };
    });

    setModal({ isOpen: false, type: null, data: null });
    setSuccess('Activity created successfully!');
    setTimeout(() => setSuccess(null), 3000);

    // Refresh tasks to update progress
    await loadTasks(goalId);
  } catch (err) {
    console.error('Error creating activity:', err);
    setError(err?.message || 'Failed to create activity.');
  } finally {
    setIsSubmitting(false);
  }
};

// Fixed handleUpdateActivity
const handleUpdateActivity = async (activityData) => {
  try {
    setIsSubmitting(true);
    const { goalId, taskId, id: activityId } = modal.data || {};
    if (!taskId || !activityId) throw new Error('Missing ids for updating activity');

    const updatedActivity = await updateActivity(taskId, activityId, activityData);

    // Update local activities state
    setActivities(prev => {
      const current = prev[taskId] ? [...prev[taskId]] : [];
      const updatedList = current.map(a => 
        a.id === activityId ? { ...a, ...updatedActivity } : a
      );
      return { ...prev, [taskId]: updatedList };
    });

    setModal({ isOpen: false, type: null, data: null });
    setSuccess('Activity updated successfully!');
    setTimeout(() => setSuccess(null), 3000);

    // Refresh tasks to update progress
    await loadTasks(goalId);
  } catch (err) {
    console.error('Error updating activity:', err);
    setError(err?.message || 'Failed to update activity.');
  } finally {
    setIsSubmitting(false);
  }
};
  const handleDeleteActivity = async (goalId, taskId, activityId) => {
    if (!window.confirm('Delete this activity?')) return;
    try {
      await deleteActivity(taskId, activityId);
      setSuccess('Activity deleted successfully!');
      setTimeout(() => setSuccess(null), 3000);
      // remove from local activities
      setActivities(prev => {
        const current = prev[taskId] ? prev[taskId].filter(a => a.id !== activityId) : [];
        return { ...prev, [taskId]: current };
      });
      await loadTasks(goalId);
      await loadGoals();
    } catch (err) {
      console.error('Error deleting activity:', err);
      setError(err?.message || 'Failed to delete activity.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  // Progress bar component
  const ProgressBar = ({ progress }) => (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
      <div 
        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );

  // Status badge component
  const StatusBadge = ({ status }) => {
    const statusClasses = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'in-progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'not-started': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>
        {status ? String(status).replace('-', ' ') : 'N/A'}
      </span>
    );
  };

  // Filtered goals
  const filteredGoals = goals.filter(goal => {
    const matchesSearch = (goal.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (goal.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || goal.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Modal component with local state (fixes typing / focus issues)
  const Modal = () => {
    const [local, setLocal] = useState({});

    useEffect(() => {
      if (!modal.isOpen) return;
      const initial = modal.data || {};
      // Initialize local depending on modal.type
      if (modal.type === 'createActivity') {
        setLocal({
          title: initial.title || '',
          description: initial.description || '',
          dueDate: initial.dueDate || '',
          weight: initial.weight ?? 0,
          status: initial.status || 'not-started',
          isDone: initial.isDone ?? false,
          targetMetric: initial.targetMetric ?? {}
        });
      } else if (modal.type === 'editActivity') {
        setLocal({
          title: initial.title || '',
          description: initial.description || '',
          dueDate: initial.dueDate || '',
          weight: initial.weight ?? 0,
          status: initial.status || initial.status || 'not-started',
          isDone: initial.isDone ?? false,
          targetMetric: initial.targetMetric ?? {}
        });
      } else if (modal.type === 'createTask' || modal.type === 'editTask') {
        setLocal({
          title: initial.title || '',
          description: initial.description || '',
          dueDate: initial.dueDate || '',
          weight: initial.weight ?? 0,
          status: initial.status || 'not-started'
        });
      } else if (modal.type === 'createGoal' || modal.type === 'editGoal') {
        setLocal({
          title: initial.title || '',
          description: initial.description || '',
          groupId: initial.groupId || '',
          startDate: initial.startDate || '',
          endDate: initial.endDate || '',
          weight: initial.weight ?? 100,
          status: initial.status || 'active'
        });
      } else {
        setLocal({});
      }
    }, [modal.isOpen, modal.type, modal.data]);

    if (!modal.isOpen) return null;

    const onLocalChange = (e) => {
      const { name, value, type, checked } = e.target;
      setLocal(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const submitLocal = async (e) => {
      if (e) e.preventDefault();
      if (modal.type === 'createGoal') await handleCreateGoal(local);
      else if (modal.type === 'editGoal') await handleUpdateGoal(local);
      else if (modal.type === 'createTask') await handleCreateTask(local);
      else if (modal.type === 'editTask') await handleUpdateTask(local);
      else if (modal.type === 'createActivity') await handleCreateActivity(local);
      else if (modal.type === 'editActivity') await handleUpdateActivity(local);
    };

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {modal.type === 'createGoal' && 'Create Goal'}
              {modal.type === 'editGoal' && 'Update Goal'}
              {modal.type === 'createTask' && 'Create Task'}
              {modal.type === 'editTask' && 'Update Task'}
              {modal.type === 'createActivity' && 'Create Activity'}
              {modal.type === 'editActivity' && 'Update Activity'}
            </h3>
            <button 
              onClick={() => setModal({ isOpen: false, type: null, data: null })}
              className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 text-2xl"
            >
              &times;
            </button>
          </div>

          <form className="px-6 py-4" onSubmit={submitLocal}>
            {(modal.type === 'createGoal' || modal.type === 'editGoal') && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                  <input name="title" value={local.title || ''} onChange={onLocalChange} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea name="description" value={local.description || ''} onChange={onLocalChange} rows="3" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
                </div>
                {/* (group/date/weight fields) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                    <input name="startDate" value={local.startDate || ''} onChange={onLocalChange} type="date" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                    <input name="endDate" value={local.endDate || ''} onChange={onLocalChange} type="date" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight</label>
                  <input name="weight" value={local.weight ?? 100} onChange={onLocalChange} type="number" min="1" max="100" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </>
            )}

            {(modal.type === 'createTask' || modal.type === 'editTask') && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                  <input name="title" value={local.title || ''} onChange={onLocalChange} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea name="description" value={local.description || ''} onChange={onLocalChange} rows="3" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                  <input name="dueDate" value={local.dueDate || ''} onChange={onLocalChange} type="date" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight</label>
                  <input name="weight" value={local.weight ?? 0} onChange={onLocalChange} type="number" min="0" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </>
            )}

            {(modal.type === 'createActivity' || modal.type === 'editActivity') && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                  <input name="title" value={local.title || ''} onChange={onLocalChange} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea name="description" value={local.description || ''} onChange={onLocalChange} rows="3" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                  <input name="dueDate" value={local.dueDate || ''} onChange={onLocalChange} type="date" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight</label>
                  <input name="weight" value={local.weight ?? 0} onChange={onLocalChange} type="number" min="0" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select name="status" value={local.status || 'not-started'} onChange={onLocalChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="not-started">Not Started</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Done</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Metric (JSON)</label>
                  <textarea
                    name="targetMetric"
                    value={typeof local.targetMetric === 'string' ? local.targetMetric : JSON.stringify(local.targetMetric || {}, null, 2)}
                    onChange={(e) => {
                      const v = e.target.value;
                      try {
                        setLocal(prev => ({ ...prev, targetMetric: JSON.parse(v) }));
                      } catch {
                        setLocal(prev => ({ ...prev, targetMetric: v }));
                      }
                    }}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                  />
                </div>
              </>
            )}
          </form>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3 sticky bottom-0 bg-white dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setModal({ isOpen: false, type: null, data: null })}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitLocal}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 flex items-center"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader className="inline-block animate-spin h-4 w-4 mr-2" /> : null}
              {modal.type && modal.type.startsWith('edit') ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 transition-colors duration-200">
      {/* Header */}
      <header className="bg-gray-200 dark:bg-gray-900 ">
        <div className="max-w-8xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-blue-600 dark:text-blue-500 mr-3" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Project Manager</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search goals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="absolute left-3 top-2.5 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-8xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Notifications */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-200 px-4 py-3 rounded relative mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span className="block sm:inline">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="absolute top-0 right-0 p-3">
              <svg className="h-6 w-6 text-red-500 dark:text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-200 px-4 py-3 rounded relative mb-6">
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <span className="block sm:inline">{success}</span>
            </div>
            <button onClick={() => setSuccess(null)} className="absolute top-0 right-0 p-3">
              <svg className="h-6 w-6 text-green-500 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Goals Table */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg ">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center">
              <List className="mr-2 h-5 w-5" />
              Goals List
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button 
                onClick={() => {
                  setModal({ isOpen: true, type: 'createGoal', data: null });
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center justify-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add New Goal
              </button>
              
              <button 
                onClick={loadGoals}
                className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white px-4 py-2 rounded-md flex items-center justify-center"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Refresh
              </button>
            </div>
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader className="inline-block animate-spin h-8 w-8 text-blue-600 dark:text-blue-500" />
              <p className="mt-2 text-gray-500 dark:text-gray-400">Loading goals...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Group</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Timeline</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Weight</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Progress</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredGoals.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        {goals.length === 0 ? 
                          "No goals found. Create your first goal to get started." : 
                          "No goals match your search criteria."
                        }
                      </td>
                    </tr>
                  ) : (
                    filteredGoals.map((goal) => (
                      <React.Fragment key={goal.id}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <button 
                                onClick={() => {
                                  if (expandedGoal === goal.id) {
                                    setExpandedGoal(null);
                                  } else {
                                    setExpandedGoal(goal.id);
                                    if (!tasks[goal.id]) {
                                      loadTasks(goal.id);
                                    }
                                  }
                                }}
                                className="mr-2 transform transition-transform text-gray-500 dark:text-gray-400"
                              >
                                {expandedGoal === goal.id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                              </button>
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{goal.title}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{goal.description}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{goal.groupName || 'No group'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {goal.startDate || 'No start date'} to {goal.endDate || 'No end date'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={goal.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{goal.weight}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <ProgressBar progress={goal.progress || 0} />
                              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{goal.progress || 0}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex space-x-2">
                              <button 
                                onClick={() => {
                                  setModal({ isOpen: true, type: 'editGoal', data: goal });
                                  // formData no longer used by modal; kept for backward compatibility
                                  setFormData({
                                    title: goal.title || '',
                                    description: goal.description || '',
                                    groupId: goal.groupId || '',
                                    startDate: goal.startDate || '',
                                    endDate: goal.endDate || '',
                                    weight: goal.weight || 100
                                  });
                                }}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteGoal(goal.id)}
                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 flex items-center"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedGoal === goal.id && (
                          <tr>
                            <td colSpan="7" className="px-6 py-4 bg-gray-50 dark:bg-gray-900">
                              <div className="mb-4">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                                  <CheckSquare className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-500" />
                                  Tasks for {goal.title}
                                </h3>
                                <button 
                                  onClick={() => {
                                    setModal({ isOpen: true, type: 'createTask', data: { goalId: goal.id } });
                                  }}
                                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm mb-4 flex items-center"
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  Add Task
                                </button>
                                
                                {/* Tasks list */}
                                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mt-2">
                                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Task</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Due Date</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Weight</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Progress</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                      {(tasks[goal.id] || []).length === 0 ? (
                                        <tr>
                                          <td colSpan="6" className="px-4 py-4 text-center text-gray-500 dark:text-gray-400">
                                            No tasks found for this goal.
                                          </td>
                                        </tr>
                                      ) : (
                                        (tasks[goal.id] || []).map(task => (
                                          <React.Fragment key={task.id}>
                                            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                              <td className="px-4 py-2 whitespace-nowrap">
                                                <div className="flex items-center">
                                                  <button 
                                                    onClick={() => {
                                                      if (expandedTask === task.id) {
                                                        setExpandedTask(null);
                                                      } else {
                                                        setExpandedTask(task.id);
                                                        if (!activities[task.id]) {
                                                          loadActivities(goal.id, task.id);
                                                        }
                                                      }
                                                    }}
                                                    className="mr-2 transform transition-transform text-gray-500 dark:text-gray-400"
                                                  >
                                                    {expandedTask === task.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                  </button>
                                                  <div>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{task.title}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{task.description}</div>
                                                  </div>
                                                </div>
                                              </td>
                                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {task.dueDate || 'No due date'}
                                              </td>
                                              <td className="px-4 py-2 whitespace-nowrap">
                                                <StatusBadge status={task.status} />
                                              </td>
                                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{task.weight}</td>
                                              <td className="px-4 py-2 whitespace-nowrap">
                                                <div className="flex items-center">
                                                  <ProgressBar progress={task.progress || 0} />
                                                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{task.progress || 0}%</span>
                                                </div>
                                              </td>
                                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                <div className="flex space-x-2">
                                                  <button
                                                    onClick={() => {
                                                      setModal({ isOpen: true, type: 'editTask', data: { goalId: goal.id, ...task } });
                                                    }}
                                                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 text-xs flex items-center"
                                                  >
                                                    <Edit className="w-3 h-3 mr-1" />
                                                    Edit
                                                  </button>
                                                  <button
                                                    onClick={() => handleDeleteTask(goal.id, task.id)}
                                                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-xs flex items-center"
                                                  >
                                                    <Trash2 className="w-3 h-3 mr-1" />
                                                    Delete
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                            {expandedTask === task.id && (
                                              <tr>
                                                <td colSpan="6" className="px-4 py-2 bg-gray-100 dark:bg-gray-900">
                                                  <div>
                                                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                                                      <List className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-500" />
                                                      Activities for {task.title}
                                                    </h4>
                                                    <button 
                                                      onClick={() => {
                                                        setModal({ isOpen: true, type: 'createActivity', data: { goalId: goal.id, taskId: task.id } });
                                                      }}
                                                      className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-md text-xs mb-2 flex items-center"
                                                    >
                                                      <Plus className="w-3 h-3 mr-1" />
                                                      Add Activity
                                                    </button>
                                                    
                                                    {/* Activities list */}
                                                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mt-2">
                                                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                                          <tr>
                                                            <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Activity</th>
                                                            <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Due Date</th>
                                                            <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                                            <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Completed</th>
                                                            <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                                          </tr>
                                                        </thead>
                                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                          {(activities[task.id] || []).length === 0 ? (
                                                            <tr>
                                                              <td colSpan="5" className="px-3 py-2 text-center text-gray-500 dark:text-gray-400">
                                                                No activities found for this task.
                                                              </td>
                                                            </tr>
                                                          ) : (
                                                            (activities[task.id] || []).map(activity => (
                                                              <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                                <td className="px-3 py-1 whitespace-nowrap">
                                                                  <div>
                                                                    <div className="text-xs font-medium text-gray-900 dark:text-white">{activity.title}</div>
                                                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{activity.description}</div>
                                                                  </div>
                                                                </td>
                                                                <td className="px-3 py-1 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">{activity.dueDate || 'No due date'}</td>
                                                                <td className="px-3 py-1 whitespace-nowrap">
                                                                  <StatusBadge status={activity.status} />
                                                                </td>
                                                                <td className="px-3 py-1 whitespace-nowrap">
                                                                  {activity.isDone ? (
                                                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Yes</span>
                                                                  ) : (
                                                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">No</span>
                                                                  )}
                                                                </td>
                                                                <td className="px-3 py-1 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                                                  <div className="flex space-x-2">
                                                                    <button
                                                                      onClick={() => handleOpenEditActivity(goal.id, task.id, activity)}
                                                                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                                                                    >
                                                                      <Edit className="w-3 h-3 mr-1" />
                                                                      Edit
                                                                    </button>
                                                                    <button
                                                                      onClick={() => handleDeleteActivity(goal.id, task.id, activity.id)}
                                                                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 flex items-center"
                                                                    >
                                                                      <Trash2 className="w-3 h-3 mr-1" />
                                                                      Delete
                                                                    </button>
                                                                  </div>
                                                                </td>
                                                              </tr>
                                                            ))
                                                          )}
                                                        </tbody>
                                                      </table>
                                                    </div>
                                                  </div>
                                                </td>
                                              </tr>
                                            )}
                                          </React.Fragment>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                <span className="font-medium">{Math.min(currentPage * pageSize, filteredGoals.length)}</span> of{' '}
                <span className="font-medium">{filteredGoals.length}</span> results
              </span>
              <select 
                className="ml-4 border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded-md text-sm flex items-center ${currentPage === 1 ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
              >
                Prev
              </button>
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={filteredGoals.length < pageSize}
                className={`px-3 py-1 rounded-md text-sm flex items-center ${filteredGoals.length < pageSize ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Modal */}
      <Modal />
    </div>
  );
};

export default ObjectiveManager;
