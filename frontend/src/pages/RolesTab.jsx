import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Shield, Settings, Trash, AlertTriangle, X } from 'lucide-react';
import { fetchRoles, fetchPermissions, createRole, updateRole, deleteRole } from '../api/admin';

const RolesTab = ({ showToast }) => {
  const { t } = useTranslation();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal States
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    permissions: [] 
  });

  // Delete Confirmation Modal State
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [rolesData, permissionsData] = await Promise.all([
        fetchRoles(),
        fetchPermissions()
      ]);
      
      const rolesWithPermissionIds = rolesData.map(role => {
        const permissionIds = role.permissions
          .map(pName => permissionsData.find(p => p.name === pName)?.id)
          .filter(Boolean);
        return { ...role, permissions: permissionIds };
      });

      setRoles(rolesWithPermissionIds);
      setPermissions(permissionsData);
    } catch (err) {
      setError(err.message || t('admin.roles.errors.loadError'));
      showToast(t('admin.roles.errors.loadError'), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenModal = (role = null) => {
    setRoleToEdit(role);
    setFormData({
      name: role?.name || '',
      description: role?.description || '',
      permissions: role?.permissions || []
    });
    setShowAddRoleModal(true);
  };

  const handleCloseModal = () => {
    setShowAddRoleModal(false);
    setRoleToEdit(null);
  };

  const handlePermissionChange = (permissionId) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(id => id !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (roleToEdit) {
        await updateRole(roleToEdit.id, formData);
        showToast(t('admin.roles.toasts.updateSuccess', { name: formData.name }), 'success');
      } else {
        await createRole(formData);
        showToast(t('admin.roles.toasts.createSuccess', { name: formData.name }), 'success');
      }
      await loadData();
      handleCloseModal();
    } catch (err) {
      console.error("Failed to save role:", err);
      showToast(t('admin.roles.errors.saveError', { error: err.message }), "error");
    }
  };

  const handleDeleteClick = (role) => {
    setRoleToDelete(role);
    setShowDeleteConfirmModal(true);
  };

  const confirmDelete = async () => {
    if (!roleToDelete) return;
    try {
      await deleteRole(roleToDelete.id);
      showToast(t('admin.roles.toasts.deleteSuccess', { name: roleToDelete.name }), 'success');
      await loadData();
    } catch (err) {
      console.error("Failed to delete role:", err);
      showToast(t('admin.roles.errors.deleteError', { error: err.message }), "error");
    } finally {
      setShowDeleteConfirmModal(false);
      setRoleToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirmModal(false);
    setRoleToDelete(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-72 bg-gray-100 dark:bg-gray-900">
        <div className="animate-pulse text-gray-400 dark:text-gray-600">
          {t('admin.roles.loading')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg text-center border border-red-200 dark:border-red-700">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-gray-100">
            {t('admin.roles.errors.title')}
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{error}</p>
          <button 
            onClick={loadData} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {t('admin.actions.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <section id="roles" role="tabpanel" aria-labelledby="roles-tab" className="bg-gray-50 dark:bg-gray-800 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {t('admin.roles.title')}
        </h1>
        
        <div className="grid grid-cols-12 gap-6">
          {/* Roles List Panel */}
          <div className="col-span-12 md:col-span-4 lg:col-span-3 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Shield size={20} /> {t('admin.roles.rolesList')}
            </h2>
            
            {roles.length > 0 ? (
              <ul className="space-y-1 mb-4">
                {roles.map((role) => (
                  <li key={role.id} className='flex items-center'>
                    <button
                      onClick={() => handleOpenModal(role)}
                      className={`w-full text-left p-3 rounded-md transition-colors duration-150 ${
                        roleToEdit?.id === role.id
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      aria-label={t('admin.roles.editRole', { name: role.name })}
                    >
                      {role.name}
                    </button>
                    <button
                      onClick={() => handleDeleteClick(role)}
                      disabled={role.name === 'Admin'}
                      className={`ml-2 p-2 rounded-md ${
                        role.name === 'Admin' 
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50'
                      }`}
                      aria-label={t('admin.roles.deleteRole', { name: role.name })}
                    >
                      <Trash size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 mb-4">
                {t('admin.roles.noRoles')}
              </p>
            )}
            
            <button
              onClick={() => handleOpenModal()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              <Plus size={18} /> {t('admin.roles.addRole')}
            </button>
          </div>

          {/* Permissions Matrix Panel */}
          <div className="col-span-12 md:col-span-8 lg:col-span-9 overflow-x-auto bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Settings size={20} /> {t('admin.roles.permissions')}
            </h2>
            
            {roles.length > 0 && permissions.length > 0 ? (
              <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('admin.roles.permission')}
                    </th>
                    {roles.map((role) => (
                      <th key={role.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {permissions.map((permission) => (
                    <tr key={permission.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200">
                        {permission.name}
                      </td>
                      {roles.map((role) => (
                        <td key={`perm-${permission.id}-role-${role.id}`} className="px-4 py-3 whitespace-nowrap text-center">
                          <input
                            type="checkbox"
                            className="h-5 w-5 text-blue-600 rounded cursor-not-allowed focus:ring-0 focus:ring-offset-0"
                            checked={role.permissions.includes(permission.id)}
                            readOnly
                            aria-label={t('admin.roles.permissionStatus', {
                              permission: permission.name,
                              role: role.name,
                              status: role.permissions.includes(permission.id) 
                                ? t('admin.roles.enabled') 
                                : t('admin.roles.disabled')
                            })}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 mt-8">
                {t('admin.roles.noPermissions')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Role Modal */}
      {showAddRoleModal && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              {roleToEdit ? t('admin.roles.editRoleTitle') : t('admin.roles.createRoleTitle')}
            </h3>
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="role-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('admin.roles.roleName')}
                  </label>
                  <input
                    type="text"
                    id="role-name"
                    name="name"
                    className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white"
                    placeholder={t('admin.roles.roleNamePlaceholder')}
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    disabled={roleToEdit?.name === 'Admin'}
                  />
                </div>
                
                <div>
                  <label htmlFor="role-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('admin.roles.description')} ({t('admin.roles.optional')})
                  </label>
                  <textarea
                    id="role-description"
                    name="description"
                    rows="2"
                    className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white"
                    placeholder={t('admin.roles.descriptionPlaceholder')}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  ></textarea>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin.roles.permissions')}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-md max-h-60 overflow-y-auto">
                    {permissions.map(permission => (
                      <label key={permission.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(permission.id)}
                          onChange={() => handlePermissionChange(permission.id)}
                          className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:checked:bg-blue-600 dark:checked:border-transparent"
                          aria-label={permission.name}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {permission.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  {t('admin.actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors duration-200"
                >
                  {roleToEdit ? t('admin.actions.saveChanges') : t('admin.actions.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && roleToDelete && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {t('admin.roles.deleteConfirm.title')}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {t('admin.roles.deleteConfirm.message', { name: roleToDelete.name })}
                </p>
              </div>
            </div>
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

export default RolesTab;