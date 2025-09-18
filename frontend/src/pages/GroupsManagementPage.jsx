// src/pages/GroupsManager.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Edit,
  Trash2,
  X,
  Search,
  Users,
  ChevronDown,
  ChevronUp,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import { fetchGroups, createGroup, updateGroup, deleteGroup } from '../api/groups';
import { addUserToGroup, removeUserFromGroup, fetchGroupUsers } from '../api/userGroups';
import { fetchUsers } from '../api/admin';
import Toast from '../components/common/Toast';
import { rawFetch } from '../api/auth'; // used for FormData upload similar to settings

/* Helpers for avatar fallback */
const initialsFromName = (name, fallback) => {
  const n = (name || '').trim();
  if (!n) {
    const u = (fallback || '').trim();
    return (u[0] || '?').toUpperCase();
  }
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const gradientFromString = (s) => {
  let hash = 0;
  for (let i = 0; i < (s || '').length; i += 1) hash = (hash << 5) - hash + s.charCodeAt(i);
  const a = Math.abs(hash);
  const h1 = a % 360;
  const h2 = (180 + h1) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 60%), hsl(${h2} 70% 40%))`;
};

// GroupFormModal Component (supports optional picture upload)
const GroupFormModal = ({ group, onSave, onClose, t }) => {
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => {
    setName(group?.name || '');
    setDescription(group?.description || '');
    setProfilePictureFile(null);
    setProfilePicturePreview(null);
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id]);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setErrors({ file: t('groups.form.errors.invalidImage') || 'Invalid image' });
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setErrors({ file: t('groups.form.errors.imageTooLarge') || 'Image too large' });
      return;
    }
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    const url = URL.createObjectURL(f);
    previewRef.current = url;
    setProfilePicturePreview(url);
    setProfilePictureFile(f);
    setErrors({});
  };

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!name.trim()) newErrors.name = t('groups.form.errors.nameRequired');
    if (name.length > 50) newErrors.name = t('groups.form.errors.nameTooLong');
    if (description.length > 300) newErrors.description = t('groups.form.errors.descriptionTooLong');
    if (Object.keys(newErrors).length) return setErrors(newErrors);

    try {
      setIsLoading(true);

      // If a file is provided, build FormData and pass it to parent
      if (profilePictureFile) {
        const fd = new FormData();
        fd.append('profilePicture', profilePictureFile);
        fd.append('name', name.trim());
        fd.append('description', description.trim() || '');
        // Parent will detect FormData and call correct endpoint (POST/PUT) with multipart
        await onSave(fd);
      } else {
        // No file: use plain JSON payload (backwards-compatible)
        const payload = {
          name: name.trim(),
          description: description.trim() || null,
        };
        await onSave(payload);
      }
    } catch (err) {
      console.error('Failed to save group:', err);
      setErrors({ submit: err.message || (t('groups.form.errors.saveFailed') || 'Save failed') });
    } finally {
      setIsLoading(false);
    }
  };

  const removePreview = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setProfilePictureFile(null);
    setProfilePicturePreview(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {group ? t('groups.form.title.edit') : t('groups.form.title.create')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label={t('groups.form.close')}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
            <div className="col-span-1 flex flex-col items-center">
              {profilePicturePreview ? (
                <img
                  src={profilePicturePreview}
                  alt="preview"
                  className="w-28 h-28 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700 mb-3"
                />
              ) : group?.profilePicture ? (
                <img
                  src={group.profilePicture}
                  alt={group.name}
                  className="w-28 h-28 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700 mb-3"
                />
              ) : (
                <div
                  className="w-28 h-28 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{ background: gradientFromString(name || group?.name || 'group') }}
                >
                  {initialsFromName(name || group?.name || '', '')}
                </div>
              )}

              <div className="mt-3">
                <input id="group-picture-input" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                <label
                  htmlFor="group-picture-input"
                  className="inline-flex items-center px-3 py-2 border rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Upload picture
                </label>
                {profilePicturePreview && (
                  <button type="button" onClick={removePreview} className="ml-2 text-sm text-red-600 dark:text-red-400">
                    Remove
                  </button>
                )}
              </div>

              {errors.file && <p className="text-xs text-red-500 mt-2">{errors.file}</p>}
            </div>

            <div className="col-span-2">
              {/* Group name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groups.form.labels.name')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'name-error' : undefined}
                />
                {errors.name && <p id="name-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groups.form.labels.description')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="3"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 ${
                    errors.description ? 'border-red-500' : 'border-gray-300'
                  }`}
                  aria-invalid={!!errors.description}
                  aria-describedby={errors.description ? 'description-error' : undefined}
                />
                {errors.description && <p id="description-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description}</p>}
              </div>
            </div>
          </div>

          {errors.submit && <p className="text-sm text-red-600">{errors.submit}</p>}

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 order-2 sm:order-1">
              {t('groups.form.buttons.cancel')}
            </button>
            <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm order-1 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? t('groups.form.buttons.saving') : group ? t('groups.form.buttons.save') : t('groups.form.buttons.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Group Members Component
const GroupMembers = ({ group, onClose, allUsers, onUpdateMemberCount, t }) => {
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState(null);

  const loadMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      const membersData = await fetchGroupUsers(group.id);
      setMembers(membersData || []);
    } catch (err) {
      console.error('Failed to load group members:', err);
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, [group.id]);

  useEffect(() => {
    if (group?.id) loadMembers();
  }, [loadMembers, group]);

  const availableUsers = useMemo(() => {
    return (allUsers || []).filter((user) => !members.some((member) => member.id === user.id));
  }, [allUsers, members]);

  const handleAddMember = async () => {
    if (!selectedUser) return;
    try {
      setIsAdding(true);
      const uid = typeof selectedUser === 'string' ? Number(selectedUser) : selectedUser;
      await addUserToGroup(group.id, uid);
      const membersData = await fetchGroupUsers(group.id);
      setMembers(membersData || []);
      onUpdateMemberCount(group.id, (membersData || []).length);
      setSelectedUser('');
    } catch (err) {
      console.error('Failed to add member:', err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      setIsRemoving(userId);
      await removeUserFromGroup(group.id, userId);
      const membersData = await fetchGroupUsers(group.id);
      setMembers(membersData || []);
      onUpdateMemberCount(group.id, (membersData || []).length);
    } catch (err) {
      console.error('Failed to remove member:', err);
    } finally {
      setIsRemoving(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('groups.members.title.manage')} - {group.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700" aria-label={t('groups.form.close')}>
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">{t('groups.members.add.title')}</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white"
                disabled={availableUsers.length === 0}
              >
                <option value="">{t('groups.members.add.selectUser')}</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.username})
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddMember}
                disabled={!selectedUser || isAdding}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                aria-label={t('groups.members.add.button')}
              >
                <UserPlus className="h-4 w-4" />
                {isAdding ? t('groups.members.add.adding') : t('groups.members.add.button')}
              </button>
            </div>
            {availableUsers.length === 0 && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('groups.members.add.noAvailable')}</p>}
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
              {t('groups.members.current.title', { count: members.length })}
            </h3>

            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">{t('groups.members.current.empty')}</p>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {members.map((member) => (
                  <div key={member.id} className="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{member.username}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={isRemoving === member.id}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                      title={t('groups.members.remove.title')}
                      aria-label={t('groups.members.remove.title')}
                    >
                      {isRemoving === member.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" /> : <UserMinus className="h-5 w-5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Main GroupsManager Component (shows avatars in lists)
function GroupsManager() {
  const { t, i18n } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [allUsers, setAllUsers] = useState([]);

  const showToast = useCallback((text, type = 'success') => {
    setToast({ text, type });
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [groupsData, usersData] = await Promise.all([fetchGroups(), fetchUsers()]);

      setAllUsers(usersData || []);
      setGroups(groupsData || []);
    } catch (err) {
      console.error('Failed to load data:', err);
      showToast(t('groups.messages.loadFailed'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToastClose = useCallback(() => {
    setToast(null);
  }, []);

  const openCreateModal = useCallback(() => {
    setCurrentGroup(null);
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((group) => {
    setCurrentGroup(group);
    setIsModalOpen(true);
  }, []);

  const openMembersModal = useCallback((group) => {
    setCurrentGroup(group);
    setIsMembersModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setCurrentGroup(null);
  }, []);

  const closeMembersModal = useCallback(() => {
    setIsMembersModalOpen(false);
    setCurrentGroup(null);
  }, []);

  const handleSaveGroup = useCallback(
    async (groupData) => {
      try {
        // If caller passed FormData (file upload), use rawFetch directly and send multipart
        if (groupData instanceof FormData) {
          let resp;
          if (currentGroup) {
            // update existing group
            resp = await rawFetch(`/api/groups/${currentGroup.id}`, 'PUT', groupData, { isFormData: true });
          } else {
            // create new group
            resp = await rawFetch('/api/groups/', 'POST', groupData, { isFormData: true });
          }

          if (!resp.ok) {
            const txt = await resp.text().catch(() => null);
            let parsed;
            try {
              parsed = txt ? JSON.parse(txt) : null;
            } catch {
              parsed = txt;
            }
            throw new Error(parsed?.message || 'Failed to save group');
          }

          const data = await resp.json().catch(() => null);
          showToast(currentGroup ? t('groups.messages.updated') : t('groups.messages.created'), 'success');
        } else {
          // plain JSON path
          if (currentGroup) {
            await updateGroup(currentGroup.id, groupData);
            showToast(t('groups.messages.updated'), 'success');
          } else {
            await createGroup(groupData);
            showToast(t('groups.messages.created'), 'success');
          }
        }

        await loadData();
        closeModal();
      } catch (err) {
        console.error('Error saving group:', err);
        showToast(t('groups.messages.saveFailed'), 'error');
        // rethrow so modal can show inline errors if it wants
        throw err;
      }
    },
    [currentGroup, closeModal, loadData, showToast, t]
  );

  const handleUpdateMemberCount = useCallback((groupId, newCount) => {
    setGroups((prevGroups) => prevGroups.map((g) => (g.id === groupId ? { ...g, memberCount: newCount } : g)));
  }, []);

  const handleDeleteGroup = useCallback(
    async (id) => {
      if (!window.confirm(t('groups.confirmDelete'))) return;
      try {
        await deleteGroup(id);
        await loadData();
        showToast(t('groups.messages.deleted'), 'success');
      } catch (err) {
        console.error('Error deleting group:', err);
        showToast(t('groups.messages.deleteFailed'), 'error');
      }
    },
    [loadData, showToast, t]
  );

  const requestSort = useCallback(
    (key) => {
      let direction = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
      setSortConfig({ key, direction });
    },
    [sortConfig]
  );

  const formatDate = useCallback(
    (dateString) => {
      if (!dateString) return t('groups.na');
      try {
        return new Date(dateString).toLocaleDateString(i18n.language);
      } catch {
        return dateString;
      }
    },
    [i18n.language, t]
  );

  const toggleGroupExpand = useCallback(
    (groupId) => {
      setExpandedGroup(expandedGroup === groupId ? null : groupId);
    },
    [expandedGroup]
  );

  const filteredGroups = useMemo(() => {
    let result = groups || [];
    if (searchTerm) {
      result = result.filter(
        (g) =>
          (g.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (g.description && g.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    result = [...result].sort((a, b) => {
      if (sortConfig.key === 'memberCount') {
        if ((a.memberCount || 0) < (b.memberCount || 0)) return sortConfig.direction === 'asc' ? -1 : 1;
        if ((a.memberCount || 0) > (b.memberCount || 0)) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }

      const av = a[sortConfig.key];
      const bv = b[sortConfig.key];
      if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
      if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [groups, searchTerm, sortConfig]);

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white bg-white dark:bg-gray-800 pb-4">{t('groups.title')}</h1>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div className="relative w-full md:w-1/2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder={t('groups.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                aria-label={t('groups.searchAria')}
              />
            </div>
            <button onClick={openCreateModal} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg shadow-sm transition-colors duration-200 w-full md:w-auto">
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base font-medium">{t('groups.newGroup')}</span>
            </button>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">{t('groups.loading')}</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th onClick={() => requestSort('name')} className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">{t('groups.table.name')}</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('groups.table.description')}</th>
                      <th onClick={() => requestSort('memberCount')} className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">{t('groups.table.members')}</th>
                      <th onClick={() => requestSort('createdAt')} className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">{t('groups.table.created')}</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('groups.table.updated')}</th>
                      <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('groups.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredGroups.length > 0 ? (
                      filteredGroups.map((g) => (
                        <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <td className="px-4 sm:px-6 py-4 font-medium text-gray-900 dark:text-white flex items-center gap-3">
                            {g.profilePicture ? (
                              <img src={g.profilePicture} alt={g.name} className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-700" />
                            ) : (
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: gradientFromString(g.name || 'group') }}>
                                {initialsFromName(g.name || '', '')}
                              </div>
                            )}
                            <span>{g.name}</span>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-gray-500 dark:text-gray-400 max-w-xs truncate">{g.description || t('groups.noDescription')}</td>
                          <td className="px-4 sm:px-6 py-4 text-gray-500 dark:text-gray-400">
                            <button onClick={() => openMembersModal(g)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline">
                              {t('groups.members.linkText', { count: g.memberCount || 0 })}
                            </button>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-gray-500 dark:text-gray-400">{formatDate(g.createdAt)}</td>
                          <td className="px-4 sm:px-6 py-4 text-gray-500 dark:text-gray-400">{formatDate(g.updatedAt)}</td>
                          <td className="px-4 sm:px-6 py-4 text-right space-x-2">
                            <button onClick={() => openEditModal(g)} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30" aria-label={t('groups.actions.edit')}>
                              <Edit className="h-5 w-5" />
                            </button>
                            <button onClick={() => handleDeleteGroup(g.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30" aria-label={t('groups.actions.delete')}>
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="px-4 sm:px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                          {t('groups.noResults')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Tablet View */}
              <div className="hidden md:block lg:hidden">
                {filteredGroups.length > 0 ? (
                  <div className="space-y-4">
                    {filteredGroups.map((g) => (
                      <div key={g.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              {g.profilePicture ? (
                                <img src={g.profilePicture} alt={g.name} className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-700" />
                              ) : (
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: gradientFromString(g.name || 'group') }}>
                                  {initialsFromName(g.name || '', '')}
                                </div>
                              )}
                              <div>
                                <h3 className="font-medium text-gray-900 dark:text-white text-lg">{g.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{g.description || t('groups.noDescription')}</p>
                                <div className="flex items-center mt-2 text-sm text-gray-500 dark:text-gray-400">
                                  <Users className="h-4 w-4 mr-1" />
                                  <button onClick={() => openMembersModal(g)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline">
                                    {t('groups.members.linkText', { count: g.memberCount || 0 })}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex space-x-2 ml-4">
                            <button onClick={() => openEditModal(g)} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30" aria-label={t('groups.actions.edit')}>
                              <Edit className="h-5 w-5" />
                            </button>
                            <button onClick={() => handleDeleteGroup(g.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30" aria-label={t('groups.actions.delete')}>
                              <Trash2 className="h-5 w-5" />
                            </button>
                            <button onClick={() => toggleGroupExpand(g.id)} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700" aria-label={t('groups.actions.toggle')}>
                              {expandedGroup === g.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </button>
                          </div>
                        </div>
                        {expandedGroup === g.id && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="font-medium">{t('groups.createdPrefix')}</span> {formatDate(g.createdAt)}
                              </div>
                              <div>
                                <span className="font-medium">{t('groups.updatedPrefix')}</span> {formatDate(g.updatedAt)}
                              </div>
                              <div className="col-span-2 flex justify-between items-center">
                                <span className="font-medium">{t('groups.members.label')}</span>
                                <button onClick={() => openMembersModal(g)} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                                  {t('groups.members.manage')}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">{t('groups.noResults')}</p>
                    <button onClick={openCreateModal} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg shadow-sm mx-auto">
                      <Plus className="h-4 w-4" />
                      <span>{t('groups.newGroup')}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {filteredGroups.length > 0 ? (
                  filteredGroups.map((g) => (
                    <div key={g.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-3">
                            {g.profilePicture ? (
                              <img src={g.profilePicture} alt={g.name} className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-700" />
                            ) : (
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: gradientFromString(g.name || 'group') }}>
                                {initialsFromName(g.name || '', '')}
                              </div>
                            )}
                            <div>
                              <h3 className="font-medium text-gray-900 dark:text-white">{g.name}</h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{g.description || t('groups.noDescription')}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button onClick={() => openEditModal(g)} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30" aria-label={t('groups.actions.edit')}>
                            <Edit className="h-5 w-5" />
                          </button>
                          <button onClick={() => handleDeleteGroup(g.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30" aria-label={t('groups.actions.delete')}>
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                        <span>
                          <span className="font-medium">{g.memberCount || 0}</span> {t('groups.members.label')}
                        </span>
                        <button onClick={() => openMembersModal(g)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm">
                          {t('groups.members.manage')}
                        </button>
                      </div>
                      <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('groups.createdPrefix')} {formatDate(g.createdAt)}</div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">{t('groups.noResults')}</p>
                    <button onClick={openCreateModal} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg shadow-sm mx-auto">
                      <Plus className="h-4 w-4" />
                      <span>{t('groups.newGroup')}</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {isModalOpen && <GroupFormModal group={currentGroup} onSave={handleSaveGroup} onClose={closeModal} t={t} />}

          {isMembersModalOpen && currentGroup && (
            <GroupMembers group={currentGroup} onClose={closeMembersModal} allUsers={allUsers} onUpdateMemberCount={handleUpdateMemberCount} t={t} />
          )}

          {toast && <Toast message={toast.text} type={toast.type} onClose={handleToastClose} />}
        </div>
      </div>
    </>
  );
}

export default GroupsManager;
