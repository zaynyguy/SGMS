import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Search, Users } from 'lucide-react';
import { fetchGroups, createGroup, updateGroup, deleteGroup } from '../api-endpoints/groups';

function GroupsManager() {
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

  // Load groups
  const loadGroups = async () => {
    setIsLoading(true);
    try {
      const data = await fetchGroups();
      setGroups(data);
      setFilteredGroups(data);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
      showMessage('Failed to load groups. Please try again later.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  // Search
  useEffect(() => {
    if (!searchTerm) {
      setFilteredGroups(groups);
    } else {
      const filtered = groups.filter(g =>
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.description && g.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredGroups(filtered);
    }
  }, [searchTerm, groups]);

  // Sort
  useEffect(() => {
    const sorted = [...filteredGroups].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    setFilteredGroups(sorted);
  }, [sortConfig]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  // Modal
  const openCreateModal = () => { setCurrentGroup(null); setIsModalOpen(true); };
  const openEditModal = (group) => { setCurrentGroup(group); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setCurrentGroup(null); };

  // CRUD
  const handleSaveGroup = async (groupData) => {
    try {
      if (currentGroup) {
        await updateGroup(currentGroup.id, groupData);
        await loadGroups();
        showMessage('Group updated successfully!', 'success');
      } else {
        await createGroup(groupData);
        await loadGroups();
        showMessage('Group created successfully!', 'success');
      }
      closeModal();
    } catch (err) {
      console.error('Error saving group:', err);
      showMessage('Failed to save group.', 'error');
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!window.confirm('Are you sure you want to delete this group?')) return;
    try {
      await deleteGroup(id);
      await loadGroups();
      showMessage('Group deleted successfully!', 'success');
    } catch (err) {
      console.error('Error deleting group:', err);
      showMessage('Failed to delete group.', 'error');
    }
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString() : 'N/A';

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Page Title */}
        <div className="flex items-center gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Groups Management</h1>
            <p className="text-gray-600 mt-1">Organize and manage all your groups</p>
          </div>
        </div>

        {/* Top Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="relative w-full md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search groups..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <button 
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-5 rounded-lg shadow-sm transition-colors duration-200"
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-sm sm:text-base font-medium">New Group</span>
          </button>
        </div>

        {/* Alerts */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg shadow-sm ${
            message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Loader */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading groups...</p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th onClick={() => requestSort('name')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100">Group Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th onClick={() => requestSort('memberCount')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100">Members</th>
                    <th onClick={() => requestSort('createdAt')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredGroups.length > 0 ? (
                    filteredGroups.map(g => (
                      <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{g.name}</td>
                        <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{g.description || 'No description'}</td>
                        <td className="px-6 py-4 text-gray-500">{g.memberCount}</td>
                        <td className="px-6 py-4 text-gray-500">{formatDate(g.createdAt)}</td>
                        <td className="px-6 py-4 text-gray-500">{formatDate(g.updatedAt)}</td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button onClick={() => openEditModal(g)} className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50">
                            <Edit className="h-5 w-5" />
                          </button>
                          <button onClick={() => handleDeleteGroup(g.id)} className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50">
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">No groups found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {filteredGroups.length > 0 ? (
                filteredGroups.map(g => (
                  <div key={g.id} className="bg-white rounded-lg shadow p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">{g.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{g.description || 'No description'}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button onClick={() => openEditModal(g)} className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50">
                          <Edit className="h-5 w-5" />
                        </button>
                        <button onClick={() => handleDeleteGroup(g.id)} className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm text-gray-500">
                      <span><span className="font-medium">{g.memberCount}</span> members</span>
                      <span>Created: {formatDate(g.createdAt)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-lg shadow p-6 text-center">
                  <p className="text-gray-500 mb-4">No groups found</p>
                  <button onClick={openCreateModal} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg shadow-sm mx-auto">
                    <Plus className="h-4 w-4" />
                    <span>New Group</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Modal */}
        {isModalOpen && (
          <GroupFormModal group={currentGroup} onSave={handleSaveGroup} onClose={closeModal} />
        )}
      </div>
    </div>
  );
}

// Modal stays same
function GroupFormModal({ group, onSave, onClose }) {
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Group name is required';
    if (name.length > 50) newErrors.name = 'Name must be less than 50 characters';
    if (description.length > 200) newErrors.description = 'Description must be less than 200 characters';
    if (Object.keys(newErrors).length) return setErrors(newErrors);
    onSave({ name: name.trim(), description: description.trim() || null });
  };

  useEffect(() => {
    const handleEscape = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">{group ? 'Edit Group' : 'Create Group'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100">
            <X className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
            <input 
              type="text" value={name} onChange={e => setName(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea 
              value={description} onChange={e => setDescription(e.target.value)} rows="3"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.description ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm">
              {group ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default GroupsManager;
