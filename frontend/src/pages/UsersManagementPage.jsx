// src/pages/UsersManagementPage.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Edit, Trash, UserPlus, X } from 'lucide-react';
import { fetchUsers, createUser, updateUser, deleteUser, fetchRoles } from '../api/admin';
import Toast from '../components/common/Toast';

const UsersManagementPage = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    password: '',
    roleId: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '', visible: false });

  // Show toast notification
  const showToast = (message, type = 'info') => {
    setToast({ message, type, visible: true });
  };

  const handleToastClose = () => {
    setToast({ message: '', type: '', visible: false });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const usersData = await fetchUsers();
        setUsers(usersData || []);

        const rolesData = await fetchRoles();
        setRoles(rolesData || []);
      } catch (error) {
        showToast(t('admin.users.errors.loadFailed', { error: error?.message || error }), 'error');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [t]);

  const validateForm = () => {
    const errors = {};

    if (!formData.username.trim()) {
      errors.username = t('admin.users.errors.usernameRequired');
    }

    if (!formData.name.trim()) {
      errors.name = t('admin.users.errors.nameRequired');
    }

    if (!userToEdit && !formData.password) {
      errors.password = t('admin.users.errors.passwordRequired');
    } else if (formData.password && formData.password.length < 8) {
      errors.password = t('admin.users.errors.passwordTooShort');
    }

    if (!formData.roleId) {
      errors.roleId = t('admin.users.errors.roleRequired');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenUserModal = (user) => {
    if (user) {
      setFormData({
        username: user.username || '',
        name: user.name || '',
        password: '',
        roleId: user.roleId || ''
      });
      setUserToEdit(user);
    } else {
      setFormData({ username: '', name: '', password: '', roleId: '' });
      setUserToEdit(null);
    }
    setFormErrors({});
    setShowUserModal(true);
  };

  const handleCloseUserModal = () => {
    setShowUserModal(false);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast(t('admin.users.errors.formValidation'), 'error');
      return;
    }

    try {
      setSubmitting(true);
      if (userToEdit) {
        await updateUser(userToEdit.id, formData);
        showToast(t('admin.users.toasts.updateSuccess', { name: formData.name }), 'success');
      } else {
        await createUser(formData);
        showToast(t('admin.users.toasts.createSuccess', { name: formData.name }), 'success');
      }
      const updatedUsers = await fetchUsers();
      setUsers(updatedUsers || []);
      handleCloseUserModal();
    } catch (error) {
      showToast(t('admin.users.errors.saveFailed', { error: error?.message || error }), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeleteConfirmModal(true);
  };

  const confirmDelete = async () => {
    try {
      setSubmitting(true);
      await deleteUser(userToDelete.id);
      const updatedUsers = await fetchUsers();
      setUsers(updatedUsers || []);
      showToast(t('admin.users.toasts.deleteSuccess', { name: userToDelete.name }), 'success');
    } catch (error) {
      showToast(t('admin.users.errors.deleteFailed', { error: error?.message || error }), 'error');
    } finally {
      setSubmitting(false);
      setShowDeleteConfirmModal(false);
      setUserToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirmModal(false);
    setUserToDelete(null);
  };

  if (loading) {
    return (
      <section id="users" role="tabpanel" aria-labelledby="users-tab" className="p-4 sm:p-6 min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </section>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white bg-white dark:bg-gray-800 pb-5">
        {t('admin.users.title')}
      </h1>
      <section id="users" role="tabpanel" aria-labelledby="users-tab" className="p-4 sm:p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Toast Notification */}
        {toast.visible && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={handleToastClose}
          />
        )}

        {/* Add User Button */}
        <div className="flex justify-end mb-6">
          <button
            onClick={() => handleOpenUserModal(null)}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md transition-colors duration-200"
            disabled={submitting}
            aria-label={t('admin.users.addUser')}
          >
            <UserPlus size={18} /> <span>{t('admin.users.addUser')}</span>
          </button>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          {users.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('admin.users.table.username')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('admin.users.table.name')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('admin.users.table.role')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('admin.users.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.username}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">{user.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap space-x-1">
                      <button
                        onClick={() => handleOpenUserModal(user)}
                        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-150 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
                        title={t('admin.actions.edit')}
                        disabled={submitting}
                        aria-label={t('admin.actions.edit')}
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(user)}
                        className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors duration-150 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        title={t('admin.actions.delete')}
                        disabled={submitting}
                        aria-label={t('admin.actions.delete')}
                      >
                        <Trash size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center bg-white dark:bg-gray-800">
              <div className="text-gray-500 dark:text-gray-400 mb-4">
                <UserPlus size={48} className="mx-auto opacity-50" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('admin.users.noUsers')}</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">{t('admin.users.noUsersDescription')}</p>
              <button
                onClick={() => handleOpenUserModal(null)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors duration-200"
                disabled={submitting}
                aria-label={t('admin.users.addUser')}
              >
                <UserPlus size={18} /> {t('admin.users.addUser')}
              </button>
            </div>
          )}
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {users.length > 0 ? (
            users.map((user) => (
              <div key={user.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{user.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleOpenUserModal(user)}
                      className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150 text-blue-600 dark:text-blue-400"
                      disabled={submitting}
                      aria-label={t('admin.actions.edit')}
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(user)}
                      className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors duration-150 text-red-600 dark:text-red-400"
                      disabled={submitting}
                      aria-label={t('admin.actions.delete')}
                    >
                      <Trash size={18} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">{user.role}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-gray-400 dark:text-gray-500 mb-4">
                <UserPlus size={48} className="mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('admin.users.noUsers')}</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 px-4">{t('admin.users.noUsersDescription')}</p>
              <button
                onClick={() => handleOpenUserModal(null)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors duration-200"
                disabled={submitting}
                aria-label={t('admin.users.addUser')}
              >
                <UserPlus size={18} /> {t('admin.users.addUser')}
              </button>
            </div>
          )}
        </div>

        {/* User Form Modal */}
        {showUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {userToEdit ? t('admin.users.editUserTitle') : t('admin.users.createUserTitle')}
                </h3>
                <button
                  onClick={handleCloseUserModal}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  disabled={submitting}
                  aria-label={t('admin.actions.close')}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveUser} className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin.users.form.username')} *
                  </label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${formErrors.username ? 'border-red-500 ring-2 ring-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                    placeholder={t('admin.users.form.usernamePlaceholder')}
                    value={formData.username}
                    onChange={handleFormChange}
                    disabled={submitting || !!userToEdit}
                    aria-invalid={!!formErrors.username}
                  />
                  {formErrors.username && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.username}</p>}
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin.users.form.name')} *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${formErrors.name ? 'border-red-500 ring-2 ring-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                    placeholder={t('admin.users.form.namePlaceholder')}
                    value={formData.name}
                    onChange={handleFormChange}
                    disabled={submitting}
                    aria-invalid={!!formErrors.name}
                  />
                  {formErrors.name && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.name}</p>}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {userToEdit ? t('admin.users.form.newPassword') : t('admin.users.form.password')}
                    {!userToEdit && ' *'}
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${formErrors.password ? 'border-red-500 ring-2 ring-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                    placeholder={t('admin.users.form.passwordPlaceholder')}
                    value={formData.password}
                    onChange={handleFormChange}
                    disabled={submitting}
                    aria-invalid={!!formErrors.password}
                  />
                  {formErrors.password && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.password}</p>}
                </div>

                <div>
                  <label htmlFor="roleId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin.users.form.role')} *
                  </label>
                  <select
                    id="roleId"
                    name="roleId"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${formErrors.roleId ? 'border-red-500 ring-2 ring-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                    value={formData.roleId}
                    onChange={handleFormChange}
                    disabled={submitting}
                    aria-invalid={!!formErrors.roleId}
                  >
                    <option value="">{t('admin.users.form.selectRole')}</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                  {formErrors.roleId && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.roleId}</p>}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseUserModal}
                    className="flex-1 px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50"
                    disabled={submitting}
                  >
                    {t('admin.actions.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors duration-200 disabled:opacity-50"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        {t('admin.actions.processing')}
                      </div>
                    ) : userToEdit ? (
                      t('admin.actions.saveChanges')
                    ) : (
                      t('admin.actions.create')
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirmModal && userToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30">
                  <Trash className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">{t('admin.users.deleteConfirm.title')}</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400">{t('admin.users.deleteConfirm.message', { name: userToDelete.name })}</p>
              </div>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={cancelDelete}
                  className="flex-1 px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50"
                  disabled={submitting}
                >
                  {t('admin.actions.cancel')}
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm transition-colors duration-200 disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      {t('admin.actions.deleting')}
                    </div>
                  ) : (
                    t('admin.actions.delete')
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
};

export default UsersManagementPage;
