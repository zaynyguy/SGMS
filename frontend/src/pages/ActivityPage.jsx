import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Edit, Trash2, Loader, AlertCircle, Calendar, Users, Save, X } from 'lucide-react';
import { fetchActivitiesByTask, createActivity, updateActivity, deleteActivity } from "../api/activities";

const ActivityManager = () => {
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState(null);
  const [activityToDelete, setActivityToDelete] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    groupId: '',
    dueDate: '',
    metrics: '{}'
  });

  // Fetch activities when task is selected
  useEffect(() => {
    if (selectedTaskId) {
      loadActivities();
    }
  }, [selectedTaskId]);

  const loadActivities = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchActivitiesByTask(selectedTaskId);
      // API returns the array directly
      setActivities(data);
    } catch (err) {
      setError(err.message || 'Failed to load activities');
      console.error('API Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateActivity = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      // Parse metrics if provided
      let parsedMetrics = {};
      try {
        parsedMetrics = formData.metrics ? JSON.parse(formData.metrics) : {};
      } catch (parseError) {
        setError('Invalid JSON format in metrics field');
        setIsLoading(false);
        return;
      }
      
      const activityData = {
        title: formData.title,
        description: formData.description || null,
        groupId: formData.groupId || null,
        dueDate: formData.dueDate || null,
        metrics: parsedMetrics
      };
      
      // Remove empty fields to avoid sending null/undefined to the API
      Object.keys(activityData).forEach(key => {
        if (activityData[key] === null || activityData[key] === undefined || activityData[key] === '') {
          delete activityData[key];
        }
      });
      
      const response = await createActivity(selectedTaskId, activityData);
      // API returns the new activity with message
      setActivities(prev => [response.activity, ...prev]);
      setShowCreateModal(false);
      setFormData({ title: '', description: '', groupId: '', dueDate: '', metrics: '{}' });
      setSuccess(response.message || 'Activity created successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to create activity');
      console.error('API Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateActivity = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      // Parse metrics if provided - FIXED: This was missing
      let parsedMetrics = {};
      try {
        parsedMetrics = formData.metrics ? JSON.parse(formData.metrics) : {};
      } catch (parseError) {
        setError('Invalid JSON format in metrics field');
        setIsLoading(false);
        return;
      }
      
      const activityData = {
        title: formData.title,
        description: formData.description || null,
        groupId: formData.groupId || null,
        dueDate: formData.dueDate || null,
        metrics: parsedMetrics // FIXED: Use parsed object instead of string
      };
      
      // Remove empty fields to avoid sending null/undefined to the API
      Object.keys(activityData).forEach(key => {
        if (activityData[key] === null || activityData[key] === undefined || activityData[key] === '') {
          delete activityData[key];
        }
      });
      
      console.log('Updating activity:', activityToEdit.id, activityData);
      const response = await updateActivity(activityToEdit.id, activityData);
      // API returns the updated activity with message
      setActivities(prev => prev.map(act => 
        act.id === activityToEdit.id ? response.activity : act
      ));
      setShowEditModal(false);
      setActivityToEdit(null);
      setSuccess(response.message || 'Activity updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update activity');
      console.error('API Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteActivity = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      await deleteActivity(activityToDelete.id);
      setActivities(prev => prev.filter(act => act.id !== activityToDelete.id));
      setShowDeleteModal(false);
      setActivityToDelete(null);
      setSuccess('Activity deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete activity');
      console.error('API Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openEditModal = (activity) => {
    setActivityToEdit(activity);
    setFormData({
      title: activity.title,
      description: activity.description || '',
      groupId: activity.groupId || '',
      dueDate: activity.dueDate ? activity.dueDate.split('T')[0] : '',
      metrics: activity.metrics ? JSON.stringify(activity.metrics, null, 2) : '{}'
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (activity) => {
    setActivityToDelete(activity);
    setShowDeleteModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTaskIdInput = (e) => {
    setSelectedTaskId(e.target.value);
  };

  const clearError = () => {
    setError('');
  };

  const clearSuccess = () => {
    setSuccess('');
  };

  return (
    <>
    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 p-4">Task Activity Manager</h1>
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200 p-4">
      <div className="max-w-6xl mx-auto">

        {/* Task Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold flex items-center">
            <ClipboardList className="h-5 w-5 mr-2" /> Select a Task
          </h2>
          <p className="mb-4 text-gray-600 dark:text-gray-400">
            Manage activities for your tasks
          </p>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-grow">
              <label htmlFor="taskId" className="block text-sm font-medium mb-2">Task ID</label>
              <input
                type="text"
                id="taskId"
                value={selectedTaskId}
                onChange={handleTaskIdInput}
                placeholder="Enter task ID"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={loadActivities}
              disabled={!selectedTaskId || isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center disabled:opacity-50 mt-2 md:mt-0"
            >
              {isLoading ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
              Load Activities
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
              <span className="text-red-800 dark:text-red-200">{error}</span>
            </div>
            <button onClick={clearError} className="text-red-600 dark:text-red-400">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-green-800 dark:text-green-200">{success}</span>
            </div>
            <button onClick={clearSuccess} className="text-green-600 dark:text-green-400">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Activities Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold flex items-center">
              Activities {selectedTaskId && `for Task #${selectedTaskId}`}
            </h2>
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!selectedTaskId}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center disabled:opacity-50"
            >
              <Plus className="h-4 w-4 mr-1" /> New Activity
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{selectedTaskId ? 'No activities found for this task' : 'Enter a task ID to view activities'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activities.map(activity => (
                <div key={activity.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-600">
                  <h3 className="font-semibold text-lg mb-2">{activity.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-3">
                    {activity.description || 'No description provided'}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {activity.groupId && (
                      <span className="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                        <Users className="h-3 w-3 mr-1" /> Group: {activity.groupId}
                      </span>
                    )}
                    {activity.groupName && (
                      <span className="inline-flex items-center px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs rounded-full">
                        <Users className="h-3 w-3 mr-1" /> {activity.groupName}
                      </span>
                    )}
                    {activity.dueDate && (
                      <span className="inline-flex items-center px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-xs rounded-full">
                        <Calendar className="h-3 w-3 mr-1" /> {new Date(activity.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Created: {new Date(activity.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openEditModal(activity)}
                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(activity)}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Activity Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-semibold">Create New Activity</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleCreateActivity} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Title *</label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Group ID</label>
                    <input
                      type="text"
                      name="groupId"
                      value={formData.groupId}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Due Date</label>
                    <input
                      type="date"
                      name="dueDate"
                      value={formData.dueDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Metrics (JSON)</label>
                    <textarea
                      name="metrics"
                      value={formData.metrics}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      placeholder='{"key": "value"}'
                    ></textarea>
                  </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                  >
                    {isLoading ? <Loader className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Activity Modal */}
        {showEditModal && activityToEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-semibold">Edit Activity</h2>
                <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleUpdateActivity} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Title *</label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Group ID</label>
                    <input
                      type="text"
                      name="groupId"
                      value={formData.groupId}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Due Date</label>
                    <input
                      type="date"
                      name="dueDate"
                      value={formData.dueDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Metrics (JSON)</label>
                    <textarea
                      name="metrics"
                      value={formData.metrics}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    ></textarea>
                  </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                  >
                    {isLoading ? <Loader className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && activityToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" /> Confirm Deletion
                </h2>
              </div>
              <div className="p-6">
                <p className="text-gray-600 dark:text-gray-300">
                  Are you sure you want to delete the activity <span className="font-semibold">"{activityToDelete.title}"</span>? This action cannot be undone.
                </p>
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteActivity}
                    disabled={isLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
                  >
                    {isLoading ? <Loader className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default ActivityManager;