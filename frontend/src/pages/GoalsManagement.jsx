import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Edit, Trash2, X, Search, Filter, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchGoals, fetchGroups, createGoal, updateGoal, deleteGoal } from '../api/goals';

function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalToEdit, setGoalToEdit] = useState(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState('all');
  const [expandedCards, setExpandedCards] = useState({});
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    groupId: '',
    startDate: '',
    endDate: ''
  });

  // Toggle mobile card expansion
  const toggleCard = (id) => setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));

  // Show toast messages
  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  // Fetch goals and groups from API
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const goalsData = await fetchGoals();
      const groupsData = await fetchGroups();

      const goalsWithGroupNames = goalsData.map(goal => {
        const group = groupsData.find(g => g.id === goal.groupId);
        return { ...goal, groupName: group ? group.name : 'No Group' };
      });

      setGoals(goalsWithGroupNames);
      setGroups(groupsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      showMessage('Failed to fetch goals. Please check your backend.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter goals by search and group
  const filteredGoals = useMemo(() => {
    return goals.filter(goal => {
      const groupMatch = filterGroup === 'all' || goal.groupId.toString() === filterGroup;
      const searchLower = searchQuery.toLowerCase();
      const titleMatch = goal.title.toLowerCase().includes(searchLower);
      const descriptionMatch = (goal.description || '').toLowerCase().includes(searchLower);
      return groupMatch && (titleMatch || descriptionMatch);
    });
  }, [goals, searchQuery, filterGroup]);

  // Modal open/close
  const handleOpenGoalModal = (goal) => {
    if (goal) {
      setFormData({
        title: goal.title || '',
        description: goal.description || '',
        groupId: goal.groupId || '',
        startDate: goal.startDate || '',
        endDate: goal.endDate || ''
      });
      setGoalToEdit(goal);
    } else {
      setFormData({ title: '', description: '', groupId: '', startDate: '', endDate: '' });
      setGoalToEdit(null);
    }
    setShowGoalModal(true);
  };
  const handleCloseGoalModal = () => setShowGoalModal(false);

  const handleFormChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // Save goal (create or update)
  const handleSaveGoal = async (e) => {
    e.preventDefault();
    try {
      if (goalToEdit) {
        await updateGoal(goalToEdit.id, formData);
        showMessage('Goal updated successfully!', 'success');
      } else {
        await createGoal(formData);
        showMessage('Goal created successfully!', 'success');
      }
      loadData();
      handleCloseGoalModal();
    } catch (error) {
      console.error(error);
      showMessage('Failed to save goal.', 'error');
    }
  };

  // Delete goal
  const handleDeleteClick = (goal) => { setGoalToDelete(goal); setShowDeleteConfirmModal(true); };
  const confirmDelete = async () => {
    try {
      await deleteGoal(goalToDelete.id);
      loadData();
      showMessage('Goal deleted successfully!', 'success');
    } catch (error) {
      console.error(error);
      showMessage('Failed to delete goal.', 'error');
    } finally {
      setShowDeleteConfirmModal(false);
      setGoalToDelete(null);
    }
  };
  const cancelDelete = () => { setShowDeleteConfirmModal(false); setGoalToDelete(null); };

  // Format dates
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try { return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return dateString; }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <>
    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white bg-white dark:bg-gray-800 p-4">Team Goals</h1>
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans p-4 sm:p-6 transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
          <div>
            <p className="text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">Manage all the goals for your teams and projects.</p>
          </div>
          <button onClick={() => handleOpenGoalModal(null)} className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md transition-colors duration-200 w-full sm:w-auto">
            <Plus size={18} /> <span className="text-sm sm:text-base">Add New Goal</span>
          </button>
        </div>

        {/* Toast message */}
        {message.text && (
          <div className={`flex items-center gap-3 p-4 mb-6 rounded-lg font-medium ${
            message.type === 'success' 
              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
            {message.text}
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative w-full sm:w-1/2">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          <div className="relative w-full sm:w-1/2">
            <Filter size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">All Groups</option>
              {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
            <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-hidden rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          {filteredGoals.length > 0 ? (
            <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Title</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Group</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Start Date</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">End Date</th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredGoals.map(goal => (
                  <tr key={goal.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{goal.title}</td>
                    <td className="px-4 sm:px-6 py-4 text-gray-500 dark:text-gray-400 max-w-xs truncate">{goal.description || 'N/A'}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{goal.groupName}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{formatDate(goal.startDate)}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{formatDate(goal.endDate)}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right space-x-2">
                      <button onClick={() => handleOpenGoalModal(goal)} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"><Edit className="h-5 w-5" /></button>
                      <button onClick={() => handleDeleteClick(goal)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><Trash2 className="h-5 w-5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 sm:p-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800">
              <p className="mb-4 text-lg sm:text-xl">No goals match your search or filter.</p>
              <p className="mb-6">Try adjusting your criteria or adding a new goal.</p>
            </div>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-4">
          {filteredGoals.length > 0 ? filteredGoals.map(goal => (
            <div key={goal.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{goal.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1"><span className="font-medium text-gray-600 dark:text-gray-300">Group:</span> {goal.groupName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400"><span className="font-medium text-gray-600 dark:text-gray-300">Dates:</span> {formatDate(goal.startDate)} - {formatDate(goal.endDate)}</p>
                </div>
                <div className="flex space-x-2 ml-2">
                  <button onClick={() => handleOpenGoalModal(goal)} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"><Edit className="h-5 w-5" /></button>
                  <button onClick={() => handleDeleteClick(goal)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><Trash2 className="h-5 w-5" /></button>
                  <button onClick={() => toggleCard(goal.id)} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">{expandedCards[goal.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
                </div>
              </div>
              {expandedCards[goal.id] && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                  <p className="font-medium text-gray-600 dark:text-gray-300 mb-1">Description:</p>
                  <p>{goal.description || 'No description'}</p>
                </div>
              )}
            </div>
          )) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-4 text-lg">No goals match your search or filter.</p>
              <button onClick={() => handleOpenGoalModal(null)} className="flex items-center justify-center gap-2 mx-auto px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md transition-colors duration-200"><Plus size={18} /> Add New Goal</button>
            </div>
          )}
        </div>

        {/* Goal Modal */}
        {showGoalModal && (
          <div className="fixed inset-0 bg-gray-600 dark:bg-gray-800 bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center p-5 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{goalToEdit ? 'Edit Goal' : 'Create New Goal'}</h3>
                <button onClick={handleCloseGoalModal} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><X size={24} /></button>
              </div>
              <form onSubmit={handleSaveGoal} className="p-5 sm:p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    name="title" 
                    value={formData.title} 
                    onChange={handleFormChange} 
                    required 
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                  <textarea 
                    name="description" 
                    rows="3" 
                    value={formData.description} 
                    onChange={handleFormChange} 
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Group <span className="text-red-500">*</span></label>
                  <select 
                    name="groupId" 
                    value={formData.groupId} 
                    onChange={handleFormChange} 
                    required 
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select a group</option>
                    {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
                    <input 
                      type="date" 
                      name="startDate" 
                      value={formData.startDate} 
                      onChange={handleFormChange} 
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
                    <input 
                      type="date" 
                      name="endDate" 
                      value={formData.endDate} 
                      onChange={handleFormChange} 
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" 
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
                  <button type="button" onClick={handleCloseGoalModal} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm">{goalToEdit ? 'Save Changes' : 'Create Goal'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirmModal && goalToDelete && (
          <div className="fixed inset-0 bg-gray-600 dark:bg-gray-800 bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-5 sm:p-6">
              <h3 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-500">Delete Goal</h3>
              <p className="mb-6 text-gray-700 dark:text-gray-300">Are you sure you want to delete the goal "<span className="font-medium">{goalToDelete.title}</span>"?</p>
              <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                <button onClick={cancelDelete} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
                <button onClick={confirmDelete} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

export default GoalsPage;