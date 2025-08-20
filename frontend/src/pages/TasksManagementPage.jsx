import React, { useState, useEffect } from 'react';
import { fetchTasksByGoal, createTask, updateTask, deleteTask } from '../api/tasks';
import { fetchUsers } from '../api/admin';
import { fetchGoals } from '../api/goals';

const App = () => {
  // State for task data
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for filters and sorting
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedGoalId, setSelectedGoalId] = useState('');

  // State for modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTaskData, setEditTaskData] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [newTaskData, setNewTaskData] = useState({
    title: "",
    description: "",
    dueDate: "",
    assigneeId: "",
  });

  // Fetch all data when component mounts
  useEffect(() => {
    loadAllData();
  }, []);

  // Fetch tasks when selected goal changes
  useEffect(() => {
    if (selectedGoalId) {
      loadTasks();
    }
  }, [selectedGoalId]);

  // Load all initial data
  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load goals
      const goalsResponse = await fetchGoals();
      if (goalsResponse && goalsResponse.length > 0) {
        setGoals(goalsResponse);
        setSelectedGoalId(goalsResponse[0].id);
      } else {
        setGoals([]);
        console.warn('No goals found or empty response');
      }
      
      // Load users
      const usersResponse = await fetchUsers();
      if (usersResponse && usersResponse.length > 0) {
        setUsers(usersResponse);
      } else {
        setUsers([]);
        console.warn('No users found or empty response');
      }
      
    } catch (err) {
      setError('Failed to load data. Please try again.');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load tasks for the selected goal
  const loadTasks = async () => {
    if (!selectedGoalId) return;
    
    try {
      setLoading(true);
      const tasksResponse = await fetchTasksByGoal(selectedGoalId);
      if (tasksResponse && tasksResponse.length > 0) {
        setTasks(tasksResponse);
      } else {
        setTasks([]);
        console.warn('No tasks found for this goal');
      }
      setError(null);
    } catch (err) {
      setError('Failed to load tasks. Please try again.');
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions for modals
  const openCreateModal = () => setShowCreateModal(true);
  const closeCreateModal = () => {
    setShowCreateModal(false);
    setNewTaskData({
      title: "",
      description: "",
      dueDate: "",
      assigneeId: "",
    });
  };

  const openEditModal = (task) => {
    setEditTaskData({
      ...task,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : ''
    });
    setShowEditModal(true);
  };
  
  const closeEditModal = () => {
    setShowEditModal(false);
    setEditTaskData(null);
  };

  const openConfirmModal = (taskId) => {
    setTaskToDelete(taskId);
    setShowConfirmModal(true);
  };
  
  const closeConfirmModal = () => {
    setShowConfirmModal(false);
    setTaskToDelete(null);
  };

  // Function to calculate and return filtered and sorted tasks
  const getVisibleTasks = () => {
    let filteredTasks = [...tasks];

    // Filter by search query
    if (searchQuery.length > 0) {
      filteredTasks = filteredTasks.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Filter by assignee (now using assigneeId)
    if (assigneeFilter !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.assigneeId == assigneeFilter);
    }

    // Sort the filtered tasks
    switch (sortBy) {
      case 'newest':
        return filteredTasks.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      case 'oldest':
        return filteredTasks.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      case 'dueDate':
        return filteredTasks.sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
      default:
        return filteredTasks;
    }
  };

  const visibleTasks = getVisibleTasks();

  // Handle task creation
  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      // Make sure we have the required fields
      if (!newTaskData.title || !selectedGoalId) {
        setError('Title is required and a goal must be selected');
        return;
      }

      // Prepare the task data with ONLY the fields the backend expects
      const taskData = {
        title: newTaskData.title,
        description: newTaskData.description || '',
        assigneeId: newTaskData.assigneeId ? parseInt(newTaskData.assigneeId) : null,
        dueDate: newTaskData.dueDate || null
      };

      await createTask(selectedGoalId, taskData);
      
      // Reload tasks to get the updated list
      const updated = await fetchTasksByGoal(selectedGoalId);
      setTasks(updated);
      setShowCreateModal(false);

      // reset form
      setNewTaskData({
        title: "",
        description: "",
        dueDate: "",
        assigneeId: "",
      });
    } catch (err) {
      console.error("Error creating task:", err);
      setError('Failed to create task. Please check all required fields.');
    }
  };

  // Handle task editing
  const handleUpdateTask = async (e) => {
    e.preventDefault();
    try {
      const taskData = {
        title: editTaskData.title,
        description: editTaskData.description || '',
        assigneeId: editTaskData.assigneeId ? parseInt(editTaskData.assigneeId) : null,
        dueDate: editTaskData.dueDate || null
      };
      
      await updateTask(editTaskData.id, taskData);
      await loadTasks(); // Reload tasks to get the updated list
      closeEditModal();
    } catch (err) {
      setError('Failed to update task. Please try again.');
      console.error("Error updating task:", err);
    }
  };

  // Handle task deletion
  const handleDeleteTask = async () => {
    try {
      await deleteTask(taskToDelete);
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskToDelete));
      closeConfirmModal();
    } catch (err) {
      setError('Failed to delete task. Please try again.');
      console.error('Error deleting task:', err);
    }
  };

  // Handle input changes for create form
  const handleNewTaskChange = (e) => {
    const { name, value } = e.target;
    setNewTaskData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle input changes for edit form
  const handleEditTaskChange = (e) => {
    const { name, value } = e.target;
    setEditTaskData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Calculate dynamic stats
  const totalTasks = tasks.length;
  const overdueTasks = tasks.filter(task => {
    if (!task.dueDate) return false;
    const today = new Date();
    const due = new Date(task.dueDate);
    return due < today;
  }).length;
  
  // Determine due date status
  const getDueDateStatus = (dueDate) => {
    if (!dueDate) return null;
    
    const today = new Date();
    const due = new Date(dueDate);
    const timeDiff = due.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    if (daysDiff < 0) return 'overdue';
    if (daysDiff <= 7) return 'dueSoon';
    return null;
  };

  // Get assignee name from ID
  const getAssigneeName = (assigneeId) => {
    if (!assigneeId) return 'Unassigned';
    const user = users.find(u => u.id === assigneeId);
    return user ? `${user.name || `${user.firstName} ${user.lastName}`}` : 'Unknown User';
  };

  if (loading && goals.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-xl">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans transition-colors duration-300 bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

      <div className="container mx-auto">
        {/* Error message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 dark:bg-red-900 dark:border-red-700 dark:text-red-200">
            <span className="block sm:inline">{error}</span>
            <button className="absolute top-0 right-0 p-3" onClick={() => setError(null)}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}
        
        {/* Header Section */}
        <h1 className="sticky text-2xl font-bold text-black dark:text-white bg-white dark:bg-gray-800 w-full p-4">Task Manager</h1>
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4 px-4 py-8">
          
          <div className="w-full">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search tasks..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              />
              <i className="fas fa-search absolute right-3 top-3 text-gray-400"></i>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Goal Selector - Now dynamic */}
            {goals.length > 0 ? (
              <select 
                value={selectedGoalId}
                onChange={(e) => setSelectedGoalId(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              >
                {goals.map(goal => (
                  <option key={goal.id} value={goal.id}>{goal.title || goal.name}</option>
                ))}
              </select>
            ) : (
              <div className="text-sm text-gray-500">No goals available</div>
            )}
            
            <button 
              onClick={openCreateModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-all font-semibold"
              disabled={goals.length === 0}
            >
              <i className="fas fa-plus"></i> NewTask
            </button>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 p-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalTasks}</h3>
            <p className="text-gray-600 dark:text-gray-400">Total Tasks</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-3xl font-bold text-red-500">{overdueTasks}</h3>
            <p className="text-gray-600 dark:text-gray-400">Overdue</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 px-4">
          {/* Filters Section */}
          <div className="w-full lg:w-1/4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
              <h3 className="text-lg font-semibold mb-4">Filters</h3>
              
              <div className="mb-4">
                <label className="block mb-2 font-medium">Assignee</label>
                <select 
                  value={assigneeFilter} 
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                >
                  <option value="all">All Assignees</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name || `${user.firstName} ${user.lastName}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Task List */}
          <div className="w-full lg:w-3/4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-xl font-semibold">Tasks</h2>
                
                <div className="flex items-center gap-2">
                  <span>Sort by:</span>
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="dueDate">Due Date</option>
                  </select>
                </div>
              </div>
              
              <div className="p-4">
                {tasks.length === 0 ? (
                  <div className="text-center py-8">
                    <i className="fas fa-tasks text-4xl text-gray-300 mb-4"></i>
                    <p className="text-gray-500">No tasks found for this goal.</p>
                    <button 
                      onClick={openCreateModal}
                      className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                    >
                      Create Your First Task
                    </button>
                  </div>
                ) : visibleTasks.length > 0 ? (
                  visibleTasks.map(task => {
                    const dueStatus = getDueDateStatus(task.dueDate);
                    
                    return (
                      <div 
                        key={task.id}
                        className={`mb-4 p-4 rounded-lg border-l-4 bg-white dark:bg-gray-800 shadow-sm 
                          ${dueStatus === 'overdue' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 
                            dueStatus === 'dueSoon' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 'border-gray-300'}
                        `}
                      >
                        <div className="flex flex-col sm:flex-row justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-lg">{task.title}</h3>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">{task.description || 'No description'}</p>
                          </div>
                          <div className="flex sm:flex-col sm:items-end gap-2">
                            {dueStatus === 'overdue' && (
                              <span className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs px-2 py-1 rounded-full">
                                Overdue
                              </span>
                            )}
                            {dueStatus === 'dueSoon' && (
                              <span className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs px-2 py-1 rounded-full">
                                Due Soon
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm flex items-center gap-1">
                              <i className="fas fa-user text-gray-500"></i> {getAssigneeName(task.assigneeId)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`text-sm flex items-center gap-1 ${
                              dueStatus === 'overdue' ? 'text-red-600 dark:text-red-400' :
                              dueStatus === 'dueSoon' ? 'text-yellow-600 dark:text-yellow-400' :
                              'text-green-600 dark:text-green-400'
                            }`}>
                              <i className="fas fa-clock"></i> Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
                            </span>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => openEditModal(task)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button 
                                onClick={() => openConfirmModal(task.id)}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-gray-500">No tasks match your filters. Try adjusting them.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-11/12 md:w-2/3 lg:w-1/2 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold">Create New Task</h2>
              <button onClick={closeCreateModal} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <form className="p-6" onSubmit={handleCreateTask}>
              <div className="mb-4">
                <label className="block mb-2 font-medium">Title *</label>
                <input 
                  type="text" 
                  name="title"
                  value={newTaskData.title}
                  onChange={handleNewTaskChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800" 
                  required 
                />
              </div>
              
              <div className="mb-4">
                <label className="block mb-2 font-medium">Description</label>
                <textarea 
                  name="description"
                  value={newTaskData.description}
                  onChange={handleNewTaskChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800" 
                  rows="3"
                ></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block mb-2 font-medium">Assignee</label>
                  <select 
                    name="assigneeId"
                    value={newTaskData.assigneeId}
                    onChange={handleNewTaskChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                  >
                    <option value="">Select assignee</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name || `${user.firstName} ${user.lastName}`}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block mb-2 font-medium">Due Date</label>
                  <input 
                    type="date" 
                    name="dueDate"
                    value={newTaskData.dueDate}
                    onChange={handleNewTaskChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800" 
                  />
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-4">
                <button 
                  type="button"
                  onClick={closeCreateModal}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditModal && editTaskData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-11/12 md:w-2/3 lg:w-1/2 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold">Edit Task</h2>
              <button onClick={closeEditModal} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <form className="p-6" onSubmit={handleUpdateTask}>
              <div className="mb-4">
                <label className="block mb-2 font-medium">Title *</label>
                <input 
                  type="text" 
                  name="title"
                  value={editTaskData.title || ''}
                  onChange={handleEditTaskChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800" 
                  required 
                />
              </div>
              
              <div className="mb-4">
                <label className="block mb-2 font-medium">Description</label>
                <textarea 
                  name="description"
                  value={editTaskData.description || ''}
                  onChange={handleEditTaskChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800" 
                  rows="3"
                ></textarea>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block mb-2 font-medium">Assignee</label>
                  <select 
                    name="assigneeId"
                    value={editTaskData.assigneeId || ''}
                    onChange={handleEditTaskChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                  >
                    <option value="">Select assignee</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name || `${user.firstName} ${user.lastName}`}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block mb-2 font-medium">Due Date</label>
                  <input 
                    type="date" 
                    name="dueDate"
                    value={editTaskData.dueDate || ''}
                    onChange={handleEditTaskChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800" 
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-4">
                <button 
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 text-center">
            <h3 className="text-xl font-bold mb-4">Confirm Deletion</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Are you sure you want to delete this task?</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={closeConfirmModal}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTask}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;