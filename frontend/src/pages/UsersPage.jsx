import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Edit, Trash, Plus, UserPlus } from 'lucide-react';
import { fetchUsers, createUser, updateUser, deleteUser, fetchRoles } from '../api/admin';

const UsersPage = ({ showToast }) => {
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
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usersData, rolesData] = await Promise.all([
          fetchUsers(),
          fetchRoles()
        ]);
        setUsers(usersData);
        setRoles(rolesData);
      } catch (error) {
        showToast(t('admin.users.errors.loadFailed', { error: error.message }), "error");
      }
    };
    loadData();
  }, [t]);

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
    setShowUserModal(true);
  };

  const handleCloseUserModal = () => {
    setShowUserModal(false);
  };

  const handleFormChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (userToEdit) {
        await updateUser(userToEdit.id, formData);
        showToast(t('admin.users.toasts.updateSuccess', { name: formData.name }), 'success');
      } else {
        await createUser(formData);
        showToast(t('admin.users.toasts.createSuccess', { name: formData.name }), 'success');
      }
      const updatedUsers = await fetchUsers();
      setUsers(updatedUsers);
      handleCloseUserModal();
    } catch (error) {
      showToast(t('admin.users.errors.saveFailed', { error: error.message }), "error");
    }
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeleteConfirmModal(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteUser(userToDelete.id);
      const updatedUsers = await fetchUsers();
      setUsers(updatedUsers);
      showToast(t('admin.users.toasts.deleteSuccess', { name: userToDelete.name }), 'success');
    } catch (error) {
      showToast(t('admin.users.errors.deleteFailed', { error: error.message }), "error");
    } finally {
      setShowDeleteConfirmModal(false);
      setUserToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirmModal(false);
    setUserToDelete(null);
  };

  const handleStatusToggle = (userId) => {
    setUsers(users.map(user => {
      if (user.id === userId) {
        let newStatus;
        switch (user.status) {
          case 'Active':
            newStatus = t('admin.users.status.inactive');
            break;
          case 'Inactive':
            newStatus = t('admin.users.status.pending');
            break;
          case 'Pending':
            newStatus = t('admin.users.status.active');
            break;
          default:
            newStatus = user.status;
        }
        showToast(t('admin.users.statusChanged', { 
          name: user.name, 
          status: newStatus 
        }), 'info');
        return { ...user, status: newStatus };
      }
      return user;
    }));
  };

  return (
    <section id="users" role="tabpanel" aria-labelledby="users-tab">
      {/* Add User Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => handleOpenUserModal(null)}
          className="btn-primary flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md transition-colors duration-200"
          aria-label={t('admin.users.addUser')}
        >
          <UserPlus size={20} /> {t('admin.users.addUser')}
        </button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {users.length > 0 ? (
          <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {['username', 'name', 'role', 'status', 'actions'].map((header) => (
                  <th 
                    key={header}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    {t(`admin.users.tableHeaders.${header}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                  <td className="px-4 py-3 whitespace-nowrap">{user.username}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{user.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {user.role?.name || t('admin.users.notAvailable')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleStatusToggle(user.id)}
                      className={`px-3 py-1 text-xs leading-5 font-semibold rounded-full transition-colors duration-200
                        ${user.status === t('admin.users.status.active') ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 hover:bg-green-200 dark:hover:bg-green-700' : ''}
                        ${user.status === t('admin.users.status.inactive') ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100 hover:bg-red-200 dark:hover:bg-red-700' : ''}
                        ${user.status === t('admin.users.status.pending') ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100 hover:bg-yellow-200 dark:hover:bg-yellow-700' : ''}
                      `}
                      title={t('admin.users.changeStatus')}
                    >
                      {user.status || t('admin.users.notAvailable')}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center space-x-1">
                    <button
                      onClick={() => handleOpenUserModal(user)}
                      className="btn-icon p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-150"
                      title={t('admin.users.edit')}
                      aria-label={t('admin.users.editUser', { name: user.name })}
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(user)}
                      className="btn-icon p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900 transition-colors duration-150"
                      title={t('admin.users.delete')}
                      aria-label={t('admin.users.deleteUser', { name: user.name })}
                    >
                      <Trash size={18} className="text-red-600 dark:text-red-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            <p className="mb-4">{t('admin.users.noUsers')}</p>
            <button
              onClick={() => handleOpenUserModal(null)}
              className="btn-primary flex items-center gap-2 mx-auto px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md transition-colors duration-200"
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
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-lg">{user.name}</div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleOpenUserModal(user)}
                    className="btn-icon p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-150"
                    title={t('admin.users.edit')}
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(user)}
                    className="btn-icon p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900 transition-colors duration-150"
                    title={t('admin.users.delete')}
                  >
                    <Trash size={18} className="text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">@{user.username}</div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {t('admin.users.role')}: {user.role?.name || t('admin.users.notAvailable')}
                </span>
                <button
                  onClick={() => handleStatusToggle(user.id)}
                  className={`px-3 py-1 text-xs leading-5 font-semibold rounded-full transition-colors duration-200
                    ${user.status === t('admin.users.status.active') ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 hover:bg-green-200 dark:hover:bg-green-700' : ''}
                    ${user.status === t('admin.users.status.inactive') ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100 hover:bg-red-200 dark:hover:bg-red-700' : ''}
                    ${user.status === t('admin.users.status.pending') ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100 hover:bg-yellow-200 dark:hover:bg-yellow-700' : ''}
                  `}
                  title={t('admin.users.changeStatus')}
                >
                  {user.status || t('admin.users.notAvailable')}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            <p className="mb-4">{t('admin.users.noUsers')}</p>
            <button
              onClick={() => handleOpenUserModal(null)}
              className="btn-primary flex items-center gap-2 mx-auto px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md transition-colors duration-200"
            >
              <UserPlus size={18} /> {t('admin.users.addUser')}
            </button>
          </div>
        )}
      </div>

      {/* User Form Modal */}
      {showUserModal && (
        <div className={`fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50`}>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {userToEdit ? t('admin.users.editUserTitle') : t('admin.users.createUserTitle')}
            </h3>
            <form onSubmit={handleSaveUser}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('admin.users.form.username')}
                  </label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    className="mt-1 block w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white"
                    placeholder={t('admin.users.form.usernamePlaceholder')}
                    value={formData.username}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('admin.users.form.name')}
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    className="mt-1 block w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white"
                    placeholder={t('admin.users.form.namePlaceholder')}
                    value={formData.name}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {userToEdit 
                      ? t('admin.users.form.newPassword') 
                      : t('admin.users.form.password')}
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    className={`mt-1 block w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white ${
                      formData.password && formData.password.length < 8 ? 'border-red-500' : ''
                    }`}
                    placeholder={t('admin.users.form.passwordPlaceholder')}
                    value={formData.password}
                    onChange={(e) => {
                      handleFormChange(e);
                      // Validate password length
                      if (e.target.value && e.target.value.length < 8) {
                        showToast(t('admin.users.errors.passwordTooShort'), 'error');
                      }
                    }}
                    required={!userToEdit}
                  />
                  {formData.password && formData.password.length < 8 && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {t('admin.users.errors.passwordTooShort')}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="roleId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('admin.users.form.role')}
                  </label>
                  <select
                    id="roleId"
                    name="roleId"
                    className="mt-1 block w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white"
                    value={formData.roleId}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">{t('admin.users.form.selectRole')}</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseUserModal}
                  className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  {t('admin.actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors duration-200"
                  disabled={formData.password && formData.password.length < 8}
                >
                  {userToEdit 
                    ? t('admin.actions.saveChanges') 
                    : t('admin.actions.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && userToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-red-600 dark:text-red-400">
              {t('admin.users.deleteConfirm.title')}
            </h3>
            <p className="mb-6 text-gray-700 dark:text-gray-300">
              {t('admin.users.deleteConfirm.message', { name: userToDelete.name })}
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                {t('admin.actions.cancel')}
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm transition-colors duration-200"
              >
                {t('admin.actions.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default UsersPage;