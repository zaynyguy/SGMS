// src/pages/RolesManagementPage.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Shield, Settings, Trash, AlertTriangle, X } from 'lucide-react';
import { fetchRoles, fetchPermissions, createRole, updateRole, deleteRole } from '../api/admin';
import Toast from '../components/common/Toast';

const RolesManagementPage = () => {
  const { t, i18n } = useTranslation();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ message: '', type: '', visible: false });

  // New state for inline role addition
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  
  // State for pending permission changes
  const [pendingPermissionChanges, setPendingPermissionChanges] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const showToast = (message, type = 'info') => {
    setToast({ message, type, visible: true });
  };

  const handleToastClose = () => {
    setToast({ message: '', type: '', visible: false });
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [rolesData, permissionsData] = await Promise.all([
        fetchRoles(),
        fetchPermissions()
      ]);
      
      // Map permission names -> ids for role.permissions if backend returns names
      const rolesWithPermissionIds = (rolesData || []).map(role => {
        const permissionIds = (role.permissions || [])
          .map(pName => permissionsData.find(p => p.name === pName)?.id)
          .filter(Boolean);
        return { ...role, permissions: permissionIds };
      });

      setRoles(rolesWithPermissionIds);
      setPermissions(permissionsData || []);
      setPendingPermissionChanges({});
      setHasUnsavedChanges(false);
    } catch (err) {
      const msg = err?.message || t('admin.roles.errors.loadError');
      setError(msg);
      showToast(t('admin.roles.errors.loadError'), "error");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddRole = async () => {
    if (!newRoleName.trim()) {
      setIsAddingRole(false);
      return;
    }

    try {
      await createRole({ 
        name: newRoleName, 
        description: '', 
        permissions: [] 
      });
      showToast(t('admin.roles.toasts.createSuccess', { name: newRoleName }), 'success');
      setNewRoleName('');
      setIsAddingRole(false);
      await loadData();
    } catch (err) {
      console.error("Failed to create role:", err);
      showToast(t('admin.roles.errors.saveError', { error: err?.message || '' }), "error");
    }
  };

  const handlePermissionChange = (roleId, permissionId, checked) => {
    setPendingPermissionChanges(prev => {
      const newChanges = { ...prev };
      if (!newChanges[roleId]) newChanges[roleId] = {};
      newChanges[roleId][permissionId] = checked;
      return newChanges;
    });
    setHasUnsavedChanges(true);
  };

  const handleSaveChanges = async () => {
    try {
      const updatePromises = [];
      
      for (const roleId in pendingPermissionChanges) {
        const role = roles.find(r => r.id === Number(roleId));
        if (!role) continue;

        let updatedPermissions = [...(role.permissions || [])];

        for (const permissionId in pendingPermissionChanges[roleId]) {
          const hasPermission = pendingPermissionChanges[roleId][permissionId];
          const permIdNum = Number(permissionId);

          if (hasPermission && !updatedPermissions.includes(permIdNum)) {
            updatedPermissions.push(permIdNum);
          } else if (!hasPermission && updatedPermissions.includes(permIdNum)) {
            updatedPermissions = updatedPermissions.filter(id => id !== permIdNum);
          }
        }

        updatePromises.push(
          updateRole(role.id, {
            name: role.name,
            description: role.description,
            permissions: updatedPermissions,
          })
        );
      }
      
      await Promise.all(updatePromises);
      showToast(t('admin.roles.toasts.updateSuccess'), 'success');
      await loadData();
    } catch (err) {
      console.error("Failed to save permissions:", err);
      showToast(t('admin.roles.errors.saveError', { error: err?.message || '' }), "error");
    }
  };

  const handleDeleteClick = async (role) => {
    // Keep server canonical role name check (e.g. "Admin") — don't localize stored role name
    if (window.confirm(t('admin.roles.deleteConfirm.message', { name: role.name }))) {
      try {
        await deleteRole(role.id);
        showToast(t('admin.roles.toasts.deleteSuccess', { name: role.name }), 'success');
        await loadData();
      } catch (err) {
        console.error("Failed to delete role:", err);
        showToast(t('admin.roles.errors.deleteError', { error: err?.message || '' }), "error");
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return t('admin.na');
    try {
      return new Date(dateString).toLocaleDateString(i18n.language || undefined);
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center h-screen items-center bg-gray-100 dark:bg-gray-900">
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
    <>
      {/* Toast Notification */}
      {toast.visible && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={handleToastClose} 
        />
      )}
      
      <h1 className="sticky text-2xl font-bold text-gray-900 dark:text-white bg-white dark:bg-gray-800 shadow-sm pb-4 flex items-center justify-between w-full">
        {t('admin.roles.title')}
        {hasUnsavedChanges && (
          <button
            onClick={handleSaveChanges}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            {t('admin.actions.saveChanges')}
          </button>
        )}
      </h1>
      
      <section id="roles" role="tabpanel" aria-labelledby="roles-tab" className="bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          
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
                      <div className="w-full text-left p-3 rounded-md text-gray-700 dark:text-gray-300">
                        {role.name}
                      </div>
                      <button
                        onClick={() => handleDeleteClick(role)}
                        disabled={role.name === 'Admin'}
                        className={`ml-2 p-2 rounded-md ${
                          role.name === 'Admin' 
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50'
                        }`}
                        aria-label={t('admin.roles.deleteRole', { name: role.name })}
                        title={role.name === 'Admin' ? t('admin.roles.deleteDisabled') : undefined}
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
              
              {isAddingRole ? (
                <div className="flex items-center mb-2">
                  <input
                    type="text"
                    className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white"
                    placeholder={t('admin.roles.roleNamePlaceholder')}
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddRole();
                      } else if (e.key === 'Escape') {
                        setIsAddingRole(false);
                        setNewRoleName('');
                      }
                    }}
                    autoFocus
                    aria-label={t('admin.roles.roleNameAria')}
                  />
                  <button
                    onClick={() => {
                      setIsAddingRole(false);
                      setNewRoleName('');
                    }}
                    className="ml-2 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    aria-label={t('admin.actions.cancel')}
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingRole(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                  aria-label={t('admin.roles.addRole')}
                >
                  <Plus size={18} /> {t('admin.roles.addRole')}
                </button>
              )}
            </div>

            {/* Permissions Matrix Panel */}
            <div className="col-span-12 md:col-span-8 lg:col-span-9 overflow-x-auto bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Settings size={20} /> {t('admin.roles.permissions')}
              </h2>
              
              {roles.length > 0 && permissions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-10">
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
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200 sticky left-0 bg-white dark:bg-gray-800 z-10">
                            {permission.name}
                          </td>
                          {roles.map((role) => {
                            const hasPendingChange = pendingPermissionChanges[role.id] && 
                                                    permission.id in pendingPermissionChanges[role.id];
                            const isChecked = hasPendingChange 
                              ? pendingPermissionChanges[role.id][permission.id]
                              : (role.permissions || []).includes(permission.id);
                              
                            return (
                              <td key={`perm-${permission.id}-role-${role.id}`} className="px-4 py-3 whitespace-nowrap text-center">
                                <input
                                  type="checkbox"
                                  className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:checked:bg-blue-600 dark:checked:border-transparent cursor-pointer"
                                  checked={isChecked}
                                  onChange={(e) => handlePermissionChange(role.id, permission.id, e.target.checked)}
                                  aria-label={t('admin.roles.permissionStatus', {
                                    permission: permission.name,
                                    role: role.name,
                                    status: isChecked 
                                      ? t('admin.roles.enabled') 
                                      : t('admin.roles.disabled')
                                  })}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 mt-8">
                  {t('admin.roles.noPermissions')}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default RolesManagementPage;
