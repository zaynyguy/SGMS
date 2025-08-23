import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Search, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchGroups, createGroup, updateGroup, deleteGroup, addUserToGroup, removeUserFromGroup, fetchGroupUsers } from '../api/groups';
import { fetchUsers } from "../api/admin";
import Toast from '../components/common/Toast';

function GroupsManager() {
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [expandedGroup, setExpandedGroup] = useState(null);

  // Load groups
  const loadGroups = async () => {
    setIsLoading(true);
    try {
      const data = await fetchGroups();
      setGroups(data);
      setFilteredGroups(data);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
      showToast('Failed to load groups. Please try again later.', 'error');
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

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
  };

  const handleToastClose = () => {
    setToast(null);
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
        showToast('Group updated successfully!', 'update');
      } else {
        await createGroup(groupData);
        await loadGroups();
        showToast('Group created successfully!', 'create');
      }
      closeModal();
    } catch (err) {
      console.error('Error saving group:', err);
      showToast('Failed to save group.', 'error');
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!window.confirm('Are you sure you want to delete this group?')) return;
    try {
      await deleteGroup(id);
      await loadGroups();
      showToast('Group deleted successfully!', 'delete');
    } catch (err) {
      console.error('Error deleting group:', err);
      showToast('Failed to delete group.', 'error');
    }
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString() : 'N/A';

  const toggleGroupExpand = (groupId) => {
    setExpandedGroup(expandedGroup === groupId ? null : groupId);
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white bg-white dark:bg-gray-800 p-4">Groups Management</h1>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
        <div className="max-w-7xl mx-auto">
          
          {/* Top Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div className="relative w-full md:w-1/2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search groups..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
            <button 
              onClick={openCreateModal}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg shadow-sm transition-colors duration-200 w-full md:w-auto"
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base font-medium">New Group</span>
            </button>
          </div>

          {/* Loader */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading groups...</p>
            </div>
          ) : (
            <>
              {/* Table - Desktop */}
              <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th onClick={() => requestSort('name')} className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">Group Name</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                      <th onClick={() => requestSort('memberCount')} className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">Members</th>
                      <th onClick={() => requestSort('createdAt')} className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">Created</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Updated</th>
                      <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredGroups.length > 0 ? (
                      filteredGroups.map(g => (
                        <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <td className="px-4 sm:px-6 py-4 font-medium text-gray-900 dark:text-white">{g.name}</td>
                          <td className="px-4 sm:px-6 py-4 text-gray-500 dark:text-gray-400 max-w-xs truncate">{g.description || 'No description'}</td>
                          <td className="px-4 sm:px-6 py-4 text-gray-500 dark:text-gray-400">{g.memberCount}</td>
                          <td className="px-4 sm:px-6 py-4 text-gray-500 dark:text-gray-400">{formatDate(g.createdAt)}</td>
                          <td className="px-4 sm:px-6 py-4 text-gray-500 dark:text-gray-400">{formatDate(g.updatedAt)}</td>
                          <td className="px-4 sm:px-6 py-4 text-right space-x-2">
                            <button onClick={() => openEditModal(g)} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30">
                              <Edit className="h-5 w-5" />
                            </button>
                            <button onClick={() => handleDeleteGroup(g.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30">
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="px-4 sm:px-6 py-12 text-center text-gray-500 dark:text-gray-400">No groups found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Tablet View */}
              <div className="hidden md:block lg:hidden">
                {filteredGroups.length > 0 ? (
                  <div className="space-y-4">
                    {filteredGroups.map(g => (
                      <div key={g.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900 dark:text-white text-lg">{g.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{g.description || 'No description'}</p>
                            <div className="flex items-center mt-2 text-sm text-gray-500 dark:text-gray-400">
                              <Users className="h-4 w-4 mr-1" />
                              <span>{g.memberCount} members</span>
                              <span className="mx-2">•</span>
                              <span>Created: {formatDate(g.createdAt)}</span>
                            </div>
                          </div>
                          <div className="flex space-x-2 ml-4">
                            <button onClick={() => openEditModal(g)} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30">
                              <Edit className="h-5 w-5" />
                            </button>
                            <button onClick={() => handleDeleteGroup(g.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30">
                              <Trash2 className="h-5 w-5" />
                            </button>
                            <button 
                              onClick={() => toggleGroupExpand(g.id)} 
                              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              {expandedGroup === g.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </button>
                          </div>
                        </div>
                        {expandedGroup === g.id && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="font-medium">Created:</span> {formatDate(g.createdAt)}
                              </div>
                              <div>
                                <span className="font-medium">Updated:</span> {formatDate(g.updatedAt)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">No groups found</p>
                    <button onClick={openCreateModal} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg shadow-sm mx-auto">
                      <Plus className="h-4 w-4" />
                      <span>New Group</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {filteredGroups.length > 0 ? (
                  filteredGroups.map(g => (
                    <div key={g.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{g.name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{g.description || 'No description'}</p>
                        </div>
                        <div className="flex space-x-2">
                          <button onClick={() => openEditModal(g)} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30">
                            <Edit className="h-5 w-5" />
                          </button>
                          <button onClick={() => handleDeleteGroup(g.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30">
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between text-sm text-gray-500 dark:text-gray-400">
                        <span><span className="font-medium">{g.memberCount}</span> members</span>
                        <span>Created: {formatDate(g.createdAt)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">No groups found</p>
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
          
          {/* Toast Component */}
          {toast && (
            <Toast 
              message={toast.text} 
              type={toast.type} 
              onClose={handleToastClose} 
            />
          )}
        </div>
      </div>
    </>
  );
}

// Modal with responsive improvements
function GroupFormModal({ group, onSave, onClose }) {
  const [name, setName] = useState(group?.name || "");
  const [description, setDescription] = useState(group?.description || "");
  const [errors, setErrors] = useState({});
  const [allUsers, setAllUsers] = useState([]);
  const [groupUsers, setGroupUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load users + group members
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setIsLoading(true);
        const users = await fetchUsers();
        setAllUsers(users);
        if (group?.id) {
          const groupMembers = await fetchGroupUsers(group.id);
          setGroupUsers(groupMembers);
          setSelectedUsers(groupMembers.map(u => u.id));
        }
      } catch (error) {
        console.error("Failed to load users:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadUsers();
  }, [group]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!name.trim()) newErrors.name = "Group name is required";
    if (name.length > 50) newErrors.name = "Name must be less than 50 characters";
    if (description.length > 200) newErrors.description = "Description must be less than 200 characters";
    if (Object.keys(newErrors).length) return setErrors(newErrors);

    try {
      // Save group details
      const savedGroup = await onSave({
        name: name.trim(),
        description: description.trim() || null,
      });

      // Sync users to group
      for (const userId of selectedUsers) {
        if (!groupUsers.find(u => u.id === userId)) {
          try {
            await addUserToGroup({ userId, groupId: savedGroup.id });
          } catch (err) {
            console.error("Failed to add user:", err);
          }
        }
      }

      for (const u of groupUsers) {
        if (!selectedUsers.includes(u.id)) {
          try {
            await removeUserFromGroup({ userId: u.id, groupId: savedGroup.id });
          } catch (err) {
            console.error("Failed to remove user:", err);
          }
        }
      }

      onClose();
    } catch (err) {
      console.error("Failed to save group:", err);
    }
  };

  const toggleUser = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {group ? "Edit Group" : "Create Group"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Group name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows="3"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 ${
                errors.description ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.description && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description}</p>}
          </div>

          {/* Users multi-select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Users</label>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 grid grid-cols-1 md:grid-cols-2 gap-2">
                {allUsers.map(user => (
                  <label key={user.id} className="flex items-center space-x-2 p-1 text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUser(user.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
                    />
                    <span className="truncate">{user.name} ({user.username})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 order-2 sm:order-1">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm order-1 sm:order-2">
              {group ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default GroupsManager;