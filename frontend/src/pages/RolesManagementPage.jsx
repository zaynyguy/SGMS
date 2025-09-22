import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Shield, Settings, Trash, AlertTriangle, X, FileText, Eye, Send, Zap, Bell, Monitor, Folder,
  Key
} from 'lucide-react';
import {
  fetchRoles,
  fetchPermissions,
  createRole,
  updateRole,
  deleteRole
} from '../api/admin';
import Toast from '../components/common/Toast';

/* ---------------------------
   Permission metadata (icons + labels)
   --------------------------- */
const PERMISSION_META = {
  manage_gta: { label: "Manage GTA", description: "Create & edit GTA items", Icon: Settings },
  view_gta: { label: "View GTA", description: "View GTA items", Icon: Eye },
  submit_reports: { label: "Submit Reports", description: "Create and submit reports for activities", Icon: Send },
  view_reports: { label: "View Reports", description: "View submitted reports", Icon: FileText },
  manage_reports: { label: "Manage Reports", description: "Approve/Reject or manage reports", Icon: Zap },
  manage_settings: { label: "Manage Settings", description: "Access and modify system settings", Icon: Shield },
  view_audit_logs: { label: "View Audit Logs", description: "See audit log entries", Icon: FileText },
  manage_notifications: { label: "Manage Notifications", description: "Create and manage notifications", Icon: Bell },
  manage_dashboard: { label: "Manage Dashboard", description: "Edit dashboards & widgets", Icon: Monitor },
  view_dashboard: { label: "View Dashboard", description: "View dashboards", Icon: Monitor },
  manage_attachments: { label: "Manage Attachments", description: "Add/remove attachments", Icon: Folder },
  manage_access: { label: "Manage Access", description: "Role & group management controls", Icon: Shield },
};

/* ---------------------------
   Component
   --------------------------- */
const RolesManagementPage = () => {
  const { t, i18n } = useTranslation();

  // Data
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ message: '', type: '', visible: false });

  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');

  const [pendingPermissionChanges, setPendingPermissionChanges] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Mobile-specific state
  const [isMobile, setIsMobile] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState(null);

  // Helpers
  const showToast = (message, type = 'info') => setToast({ message, type, visible: true });
  const handleToastClose = () => setToast({ message: '', type: '', visible: false });

  // Resize listener to detect mobile breakpoint (md ~ 768px)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* Load roles + permissions */
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [rolesData, permissionsData] = await Promise.all([fetchRoles(), fetchPermissions()]);

      // Normalize role permissions to arrays of permission IDs (numbers)
      const normalizedRoles = (rolesData || []).map(role => {
        const permissionIds = (role.permissions || [])
          .map(pNameOrId => {
            const found = (permissionsData || []).find(p => p.name === pNameOrId || p.id === pNameOrId);
            return found ? found.id : null;
          })
          .filter(Boolean);
        return { ...role, permissions: permissionIds };
      });

      setRoles(normalizedRoles);
      setPermissions(permissionsData || []);
      setPendingPermissionChanges({});
      setHasUnsavedChanges(false);

      // select first role for mobile if none selected
      if ((normalizedRoles || []).length > 0 && selectedRoleId === null) {
        setSelectedRoleId(normalizedRoles[0].id);
      }
    } catch (err) {
      const msg = err?.message || t('admin.roles.errors.loadError');
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [t, selectedRoleId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* Add role */
  const handleAddRole = async () => {
    const name = newRoleName.trim();
    if (!name) {
      setIsAddingRole(false);
      setNewRoleName('');
      return;
    }
    try {
      await createRole({ name, description: '', permissions: [] });
      showToast(t('admin.roles.toasts.createSuccess', { name }), 'success');
      setNewRoleName('');
      setIsAddingRole(false);
      await loadData();
    } catch (err) {
      console.error('createRole failed', err);
      showToast(t('admin.roles.errors.saveError', { error: err?.message || '' }), 'error');
    }
  };

  /* Remove role */
  const handleDeleteClick = async (role) => {
    if (!window.confirm(t('admin.roles.deleteConfirm.message', { name: role.name }))) return;
    try {
      await deleteRole(role.id);
      showToast(t('admin.roles.toasts.deleteSuccess', { name: role.name }), 'success');
      // if deleted role was selected in mobile, pick another
      if (isMobile && selectedRoleId === role.id) {
        setSelectedRoleId(prev => {
          const remaining = roles.filter(r => r.id !== role.id);
          return remaining.length ? remaining[0].id : null;
        });
      }
      await loadData();
    } catch (err) {
      console.error('deleteRole failed', err);
      showToast(t('admin.roles.errors.deleteError', { error: err?.message || '' }), 'error');
    }
  };

  /* Toggle permission change */
  const handlePermissionChange = (roleId, permissionId, checked) => {
    setPendingPermissionChanges(prev => {
      const next = { ...prev };
      if (!next[roleId]) next[roleId] = {};
      next[roleId][permissionId] = checked;
      return next;
    });
    setHasUnsavedChanges(true);
  };

  /* Save changes to roles (applies pendingPermissionChanges) */
  const handleSaveChanges = async () => {
    try {
      const updatePromises = [];

      for (const roleIdStr in pendingPermissionChanges) {
        const roleId = Number(roleIdStr);
        const role = roles.find(r => r.id === roleId);
        if (!role) continue;

        let updatedPermissions = [...(role.permissions || [])];

        const changesForRole = pendingPermissionChanges[roleIdStr] || {};
        for (const permIdStr in changesForRole) {
          const permId = Number(permIdStr);
          const enable = changesForRole[permIdStr];

          if (enable && !updatedPermissions.includes(permId)) updatedPermissions.push(permId);
          if (!enable && updatedPermissions.includes(permId)) {
            updatedPermissions = updatedPermissions.filter(id => id !== permId);
          }
        }

        updatePromises.push(updateRole(role.id, {
          name: role.name,
          description: role.description || '',
          permissions: updatedPermissions,
        }));
      }

      await Promise.all(updatePromises);
      showToast(t('admin.roles.toasts.updateSuccess'), 'success');
      await loadData();
    } catch (err) {
      console.error('Failed to save permissions', err);
      showToast(t('admin.roles.errors.saveError', { error: err?.message || '' }), 'error');
    }
  };

  const formatDateStr = (dateString) => {
    if (!dateString) return t('admin.na');
    try {
      return new Date(dateString).toLocaleDateString(i18n.language || undefined);
    } catch {
      return dateString;
    }
  };

  /* ---------------------------
     Render
     --------------------------- */
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="animate-pulse text-gray-400 dark:text-gray-600 text-base">
          {t('admin.roles.loading')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg text-center border border-red-200 dark:border-red-700 max-w-xl">
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

  /* helpers for checking current/changed state */
  const roleHasPermission = (role, permissionId) => {
    const pendingForRole = pendingPermissionChanges[role.id] || {};
    if (permissionId in pendingForRole) return pendingForRole[permissionId];
    return (role.permissions || []).includes(permissionId);
  };

  /* Selected role object for mobile */
  const selectedRole = roles.find(r => r.id === selectedRoleId) || roles[0] || null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      {/* Toast */}
      {toast.visible && <Toast message={toast.message} type={toast.type} onClose={handleToastClose} />}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className='flex items-center min-w-0 gap-4'>
            <div className="p-3 rounded-lg bg-gray-200 dark:bg-gray-800">
                        <Key className="h-6 w-6 text-sky-600 dark:text-sky-300" />
                      </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            {t('admin.roles.title')}
          </h1>
          <p className="mt-1 text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-2xl">
                {t("admin.roles.subtitle")}
              </p>
          </div>
          </div>

          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <button
                onClick={handleSaveChanges}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm shadow-sm"
                aria-label={t('admin.actions.saveChanges')}
              >
                {t('admin.actions.saveChanges')}
              </button>
            )}
          </div>
        </div>
      </div>

      <section className="max-w-7xl mx-auto">
        {/* GRID: left (roles list) + right (permissions)
            On mobile we'll replace the left column with horizontal chips and show permissions below
        */}
        <div className="grid grid-cols-12 gap-6">
          {/* Roles column (desktop) */}
          <aside className="col-span-12 md:col-span-4 lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <Shield size={18} /> {t('admin.roles.rolesList')}
                </h2>
              </div>

              {/* Desktop list */}
              <div className="hidden md:block">
                {roles.length > 0 ? (
                  <ul className="space-y-2 mb-4">
                    {roles.map(role => (
                      <li key={role.id} className="flex items-center justify-between rounded-md overflow-hidden">
                        <button
                          onClick={() => setSelectedRoleId(role.id)}
                          className="text-left w-full p-3 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300 truncate"
                        >
                          {role.name}
                        </button>

                        <div className="flex items-center gap-2 ml-2">
                          <button
                            onClick={() => handleDeleteClick(role)}
                            disabled={role.name === 'Admin'}
                            aria-label={t('admin.roles.deleteRole', { name: role.name })}
                            className={`${role.name === 'Admin' ? 'text-gray-400 cursor-not-allowed' : 'text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50'} p-2 rounded`}
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 mb-4">{t('admin.roles.noRoles')}</p>
                )}

                {/* add role */}
                {isAddingRole ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddRole();
                        if (e.key === 'Escape') { setIsAddingRole(false); setNewRoleName(''); }
                      }}
                      placeholder={t('admin.roles.roleNamePlaceholder')}
                      className="flex-1 p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:text-white border-gray-300 dark:border-gray-600"
                      aria-label={t('admin.roles.roleNameAria')}
                    />
                    <button onClick={() => { setIsAddingRole(false); setNewRoleName(''); }} className="p-2 text-gray-500">
                      <X size={18} />
                    </button>
                    <button onClick={handleAddRole} className="px-3 py-2 bg-blue-600 text-white rounded-md">{t('admin.actions.create')}</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingRole(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Plus size={16} /> {t('admin.roles.addRole')}
                  </button>
                )}
              </div>

              {/* Mobile: horizontal role chips */}
              <div className="md:hidden">
                <div className="flex gap-2 overflow-x-auto py-2 mb-3">
                  {roles.map(role => {
                    const active = selectedRoleId === role.id;
                    return (
                      <button
                        key={role.id}
                        onClick={() => setSelectedRoleId(role.id)}
                        className={`flex-shrink-0 px-3 py-2 rounded-full border ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}
                        aria-current={active ? 'true' : undefined}
                      >
                        <span className="text-sm">{role.name}</span>
                      </button>
                    );
                  })}
                  {/* add role quickchip */}
                  <button
                    onClick={() => setIsAddingRole(true)}
                    className="flex-shrink-0 px-3 py-2 rounded-full border bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-dashed border-gray-300 dark:border-gray-600"
                    aria-label={t('admin.roles.addRole')}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Add role panel (mobile inline) */}
                {isAddingRole && (
                  <div className="flex gap-2 mb-3">
                    <input
                      autoFocus
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddRole();
                        if (e.key === 'Escape') { setIsAddingRole(false); setNewRoleName(''); }
                      }}
                      placeholder={t('admin.roles.roleNamePlaceholder')}
                      className="flex-1 p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:text-white border-gray-300 dark:border-gray-600"
                    />
                    <button onClick={handleAddRole} className="px-3 py-2 bg-blue-600 text-white rounded-md">{t('admin.actions2.create')}</button>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Permissions area (right) */}
          <div className="col-span-12 md:col-span-8 lg:col-span-9">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <Settings size={18} /> {t('admin.roles.permissions')}
                </h2>
              </div>

              {/* Desktop table (md+) */}
              <div className="hidden md:block overflow-x-auto">
                {roles.length > 0 && permissions.length > 0 ? (
                  <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-10">
                          {t('admin.roles.permission')}
                        </th>
                        {roles.map(role => (
                          <th key={role.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            {role.name}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {permissions.map(permission => {
                        const meta = PERMISSION_META[permission.name] || { label: permission.name, description: permission.description || '', Icon: FileText };
                        const Icon = meta.Icon || FileText;
                        return (
                          <tr key={permission.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200 sticky left-0 bg-white dark:bg-gray-800 z-10">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-md bg-gray-100 dark:bg-gray-700/30">
                                  <Icon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-900 dark:text-white truncate">{meta.label}</div>
                                  {meta.description && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{meta.description}</div>}
                                </div>
                              </div>
                            </td>

                            {roles.map(role => {
                              const checked = roleHasPermission(role, permission.id);
                              return (
                                <td key={`perm-${permission.id}-role-${role.id}`} className="px-4 py-3 whitespace-nowrap text-center">
                                  <input
                                    type="checkbox"
                                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:checked:bg-blue-600 dark:checked:border-transparent cursor-pointer"
                                    checked={Boolean(checked)}
                                    onChange={(e) => handlePermissionChange(role.id, permission.id, e.target.checked)}
                                    aria-label={t('admin.roles.permissionStatus', {
                                      permission: permission.name,
                                      role: role.name,
                                      status: checked ? t('admin.roles.enabled') : t('admin.roles.disabled')
                                    })}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center text-gray-500 dark:text-gray-400 mt-8">{t('admin.roles.noPermissions')}</p>
                )}
              </div>

              {/* Mobile single-role permission list */}
              <div className="md:hidden">
                {selectedRole ? (
                  <>
                    <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">{t('admin.roles.editingRole', { name: selectedRole.name })}</div>

                    <div className="space-y-3">
                      {permissions.map(permission => {
                        const meta = PERMISSION_META[permission.name] || { label: permission.name, description: permission.description || '', Icon: FileText };
                        const Icon = meta.Icon || FileText;
                        const checked = roleHasPermission(selectedRole, permission.id);

                        return (
                          <div key={permission.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                            <div className="p-2 rounded-md bg-gray-100 dark:bg-gray-700/20">
                              <Icon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-white truncate">{meta.label}</div>
                              {meta.description && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{meta.description}</div>}
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={Boolean(checked)}
                                onChange={(e) => handlePermissionChange(selectedRole.id, permission.id, e.target.checked)}
                                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                aria-label={t('admin.roles.permissionStatus', {
                                  permission: permission.name,
                                  role: selectedRole.name,
                                  status: checked ? t('admin.roles.enabled') : t('admin.roles.disabled')
                                })}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Mobile action row */}
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleDeleteClick(selectedRole)}
                        disabled={selectedRole.name === 'Admin'}
                        className="flex-1 px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md"
                        aria-label={t('admin.roles.deleteRole', { name: selectedRole.name })}
                      >
                         <span className="ml-2">{t('admin.roles.deleteRole')}</span>
                      </button>

                      <button
                        onClick={handleSaveChanges}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md"
                        aria-label={t('admin.actions.saveChanges')}
                      >
                        {t('admin.actions.saveChanges')}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.roles.noRoles')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default RolesManagementPage;
