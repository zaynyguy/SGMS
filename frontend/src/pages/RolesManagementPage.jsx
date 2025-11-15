import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Shield, Settings, Trash2, AlertTriangle, X, FileText, Eye,
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
  submit_reports: { label: "Submit Reports", description: "Create and submit reports for activities", Icon: FileText },
  view_reports: { label: "View Reports", description: "View submitted reports", Icon: FileText },
  manage_reports: { label: "Manage Reports", description: "Approve/Reject or manage reports", Icon: FileText },
  manage_settings: { label: "Manage Settings", description: "Access and modify system settings", Icon: Shield },
  view_audit_logs: { label: "View Audit Logs", description: "See audit log entries", Icon: FileText },
  manage_notifications: { label: "Manage Notifications", description: "Create and manage notifications", Icon: FileText },
  manage_dashboard: { label: "Manage Dashboard", description: "Edit dashboards & widgets", Icon: FileText },
  view_dashboard: { label: "View Dashboard", description: "View dashboards", Icon: FileText },
  manage_attachments: { label: "Manage Attachments", description: "Add/remove attachments", Icon: FileText },
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
  const [toast, setToast] = useState(null);

  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');

  const [pendingPermissionChanges, setPendingPermissionChanges] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Mobile-specific state
  const [isMobile, setIsMobile] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState(null);

  // Deletion modal state
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const showToast = (message, semanticType = 'info') => {
    const map = {
      success: 'create',
      info: 'read',
      update: 'update',
      delete: 'delete',
      error: 'error',
    };
    const tType = map[semanticType] || semanticType || 'create';
    setToast({ text: message, type: tType });
  };
  const handleToastClose = () => setToast(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [rolesData, permissionsData] = await Promise.all([fetchRoles(), fetchPermissions()]);

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

  const handleDeleteClick = (role) => {
    setRoleToDelete(role);
    setShowDeleteConfirmModal(true);
  };

  const cancelDelete = () => {
    setShowDeleteConfirmModal(false);
    setRoleToDelete(null);
  };

  const confirmDelete = async () => {
    if (!roleToDelete) return;
    try {
      setSubmitting(true);
      await deleteRole(roleToDelete.id);
      showToast(t('admin.roles.toasts.deleteSuccess', { name: roleToDelete.name }), 'delete');

      if (isMobile && selectedRoleId === roleToDelete.id) {
        setSelectedRoleId(prev => {
          const remaining = roles.filter(r => r.id !== roleToDelete.id);
          return remaining.length ? remaining[0].id : null;
        });
      }

      await loadData();
    } catch (err) {
      console.error('deleteRole failed', err);
      showToast(t('admin.roles.errors.deleteError', { error: err?.message || '' }), 'error');
    } finally {
      setSubmitting(false);
      setShowDeleteConfirmModal(false);
      setRoleToDelete(null);
    }
  };

  const handlePermissionChange = (roleId, permissionId, checked) => {
    setPendingPermissionChanges(prev => {
      const next = { ...prev };
      if (!next[roleId]) next[roleId] = {};
      next[roleId][permissionId] = checked;
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const togglePermission = (roleId, permissionId) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;
    const current = roleHasPermission(role, permissionId);
    handlePermissionChange(roleId, permissionId, !current);
  };

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
      showToast(t('admin.roles.toasts.updateSuccess'), 'update');
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

  const roleHasPermission = (role, permissionId) => {
    const pendingForRole = pendingPermissionChanges[role.id] || {};
    if (permissionId in pendingForRole) return pendingForRole[permissionId];
    return (role.permissions || []).includes(permissionId);
  };

  const selectedRole = roles.find(r => r.id === selectedRoleId) || roles[0] || null;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="animate-pulse text-gray-400 dark:text-gray-600 text-sm">
          {t('admin.roles.loading')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg text-center border border-red-200 dark:border-red-700 max-w-xl">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            {t('admin.roles.errors.title')}
          </h3>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{error}</p>
          <button
            onClick={loadData}
            className="mt-3 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-transform rm-action-btn"
          >
            {t('admin.actions.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 p-3 sm:p-4 lg:p-6 ${mounted ? 'rm-mounted' : ''}`}>
      <style>{`
        @keyframes rm-pop {
          from { transform: translateY(8px) scale(.992); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }

        .rm-overlay { transition: opacity 220ms cubic-bezier(.2,.8,.2,1); }
        .rm-panel { animation: rm-pop 220ms cubic-bezier(.2,.8,.2,1) both; will-change: transform, opacity; }
        .rm-avatar { transition: transform 160ms cubic-bezier(.2,.8,.2,1), box-shadow 160ms; will-change: transform; }
        .rm-avatar:hover { transform: scale(1.06) rotate(0.6deg); }
        .rm-row { transition: transform 150ms ease, box-shadow 150ms, background-color 150ms; will-change: transform; }
        .rm-row:hover { transform: translateY(-4px); box-shadow: 0 8px 20px rgba(2,6,23,0.06); }
        .rm-action-btn { transition: transform 120ms ease, box-shadow 120ms; }
        .rm-action-btn:active { transform: scale(.985); }
        .rm-perm-cell { transition: transform 140ms ease; }
        .rm-perm-cell:active { transform: scale(.98); }
        .rm-chip:active { transform: translateY(1px) scale(.99); }
      `}</style>

      {toast && (
        <div className="fixed z-50 right-4 bottom-4">
          <Toast message={toast.text} type={toast.type} onClose={handleToastClose} />
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <div className='flex items-center min-w-0 gap-3'>
            <div className="p-2.5 rounded-lg bg-gray-200 dark:bg-gray-800 rm-avatar">
              <Shield className="h-5 w-5 text-sky-600 dark:text-sky-300" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                {t('admin.roles.title')}
              </h1>
              <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300 max-w-2xl">
                {t("admin.roles.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <button
                onClick={handleSaveChanges}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm rm-action-btn"
                aria-label={t('admin.actions.saveChanges')}
              >
                {t('admin.actions.saveChanges')}
              </button>
            )}
          </div>
        </div>
      </div>

      <section className="max-w-7xl mx-auto">
        <div className="grid grid-cols-12 gap-4">
          {/* Roles column (desktop) */}
          <aside className="col-span-12 md:col-span-4 lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 rm-panel">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Shield size={16} /> {t('admin.roles.rolesList')}
                </h2>
              </div>

              {/* Desktop list */}
              <div className="hidden md:block">
                {roles.length > 0 ? (
                  <ul className="space-y-1.5 mb-3">
                    {roles.map(role => (
                      <li key={role.id} className="flex items-center justify-between rounded-md overflow-hidden rm-row">
                        <button
                          onClick={() => setSelectedRoleId(role.id)}
                          className="text-left w-full p-2 text-xs bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300 truncate rm-action-btn"
                        >
                          {role.name}
                        </button>

                        <div className="flex items-center gap-1.5 ml-1.5">
                          <button
                            onClick={() => handleDeleteClick(role)}
                            disabled={role.name === 'Admin' || submitting}
                            aria-label={t('admin.roles.deleteRole', { name: role.name })}
                            className={`${role.name === 'Admin' ? 'text-gray-400 cursor-not-allowed' : 'text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50'} p-1.5 rounded rm-action-btn`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t('admin.roles.noRoles')}</p>
                )}

                {/* add role */}
                {isAddingRole ? (
                  <div className="flex flex-col gap-1.5 w-full rm-panel">
                    <div className="flex gap-1.5 w-full">
                      <input
                        autoFocus
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddRole();
                          if (e.key === "Escape") {
                            setIsAddingRole(false);
                            setNewRoleName("");
                          }
                        }}
                        placeholder={t("admin.roles.roleNamePlaceholder")}
                        aria-label={t("admin.roles.roleNameAria")}
                        className="flex-1 p-1.5 text-xs border rounded-md bg-gray-50 dark:bg-gray-700 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <button
                        onClick={() => {
                          setIsAddingRole(false);
                          setNewRoleName("");
                        }}
                        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 transition rm-action-btn"
                        aria-label={t("admin.roles.roleActions.remove")}
                        title={t("admin.roles.roleActions.remove")}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <button
                      onClick={handleAddRole}
                      className="w-full px-2.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition rm-action-btn"
                      aria-label={t("admin.roles.roleActions.add")}
                    >
                      {t("admin.roles.roleActions.add")}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingRole(true)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rm-action-btn"
                  >
                    <Plus size={14} /> {t('admin.roles.addRole')}
                  </button>
                )}
              </div>

              {/* Mobile: horizontal role chips */}
              <div className="md:hidden mt-2">
                <div className="flex gap-1.5 overflow-x-auto py-1.5 mb-2">
                  {roles.map(role => {
                    const active = selectedRoleId === role.id;
                    return (
                      <button
                        key={role.id}
                        onClick={() => setSelectedRoleId(role.id)}
                        className={`flex-shrink-0 px-2 py-1 text-xs rounded-full border rm-chip ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}
                        aria-current={active ? 'true' : undefined}
                      >
                        {role.name}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setIsAddingRole(true)}
                    className="flex-shrink-0 px-2 py-1 text-xs rounded-full border bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-dashed border-gray-300 dark:border-gray-600 rm-action-btn"
                    aria-label={t('admin.roles.addRole')}
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {isAddingRole && (
                  <div className="flex gap-1.5 mb-2 rm-panel">
                    <input
                      autoFocus
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddRole();
                        if (e.key === 'Escape') { setIsAddingRole(false); setNewRoleName(''); }
                      }}
                      placeholder={t('admin.roles.roleNamePlaceholder')}
                      className="flex-1 p-1.5 text-xs border rounded-md bg-gray-50 dark:bg-gray-700 dark:text-white border-gray-300 dark:border-gray-600"
                    />
                    <button onClick={handleAddRole} className="px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-md rm-action-btn">{t('admin.actions2.create')}</button>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Permissions area (right) */}
          <div className="col-span-12 md:col-span-8 lg:col-span-9">
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 rm-panel">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Settings size={16} /> {t('admin.roles.permissions')}
                </h2>
              </div>

              {/* Desktop table (md+) */}
              <div className="hidden md:block overflow-x-auto">
                {roles.length > 0 && permissions.length > 0 ? (
                  <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-10">
                          {t('admin.roles.permission')}
                        </th>
                        {roles.map(role => (
                          <th key={role.id} className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
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
                          <tr key={permission.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150 rm-row">
                            <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800 dark:text-gray-200 sticky left-0 bg-white dark:bg-gray-800 z-10">
                              <div className="flex items-start gap-2">
                                <div className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-700/30 rm-avatar">
                                  <Icon className="w-3.5 h-3.5 text-gray-700 dark:text-gray-300" />
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
                                <td
                                  key={`perm-${permission.id}-role-${role.id}`}
                                  className="px-3 py-2 whitespace-nowrap text-center cursor-pointer select-none rm-perm-cell"
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => togglePermission(role.id, permission.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      togglePermission(role.id, permission.id);
                                    }
                                  }}
                                  aria-pressed={checked}
                                  title={checked ? t('admin.roles.enabled') : t('admin.roles.disabled')}
                                >
                                  <input
                                    type="checkbox"
                                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:checked:bg-blue-600 dark:checked:border-transparent cursor-pointer"
                                    checked={Boolean(checked)}
                                    readOnly
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePermission(role.id, permission.id);
                                    }}
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
                  <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-6">{t('admin.roles.noPermissions')}</p>
                )}
              </div>

              {/* Mobile single-role permission list */}
              <div className="md:hidden">
                {selectedRole ? (
                  <>
                    <div className="mb-2 text-xs text-gray-600 dark:text-gray-400">{t('admin.roles.editingRole', { name: selectedRole.name })}</div>

                    <div className="space-y-2">
                      {permissions.map(permission => {
                        const meta = PERMISSION_META[permission.name] || { label: permission.name, description: permission.description || '', Icon: FileText };
                        const Icon = meta.Icon || FileText;
                        const checked = roleHasPermission(selectedRole, permission.id);

                        return (
                          <div
                            key={permission.id}
                            className="flex items-start gap-2 p-2 text-xs rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer rm-row"
                            onClick={() => togglePermission(selectedRole.id, permission.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                togglePermission(selectedRole.id, permission.id);
                              }
                            }}
                            aria-pressed={checked}
                          >
                            <div className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-700/20 rm-avatar">
                              <Icon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-white truncate">{meta.label}</div>
                              {meta.description && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{meta.description}</div>}
                            </div>

                            <div className="flex-1 text-right">
                              <input
                                type="checkbox"
                                checked={Boolean(checked)}
                                readOnly
                                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePermission(selectedRole.id, permission.id);
                                }}
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
                    <div className="mt-3 flex gap-1.5">
                      <button
                        onClick={() => handleDeleteClick(selectedRole)}
                        disabled={selectedRole.name === 'Admin' || submitting}
                        className="flex-1 px-3 py-1.5 text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md rm-action-btn"
                        aria-label={t('admin.roles.deleteRole', { name: selectedRole.name })}
                      >
                        <span>{t('admin.roles.deleteRole')}</span>
                      </button>

                      <button
                        onClick={handleSaveChanges}
                        className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md rm-action-btn"
                        aria-label={t('admin.actions.saveChanges')}
                      >
                        {t('admin.actions.saveChanges')}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin.roles.noRoles')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && roleToDelete && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center p-3 z-50 rm-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          aria-describedby="delete-desc"
        >
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-2xl w-full max-w-sm rm-panel text-sm">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <h3
                id="delete-title"
                className="mt-3 text-base font-semibold text-gray-900 dark:text-white"
              >
                {t('admin.roles.deleteRole') || t('admin.roles.deleteConfirm.heading') || t('admin.roles.deleteConfirm')}
              </h3>
              <p
                id="delete-desc"
                className="mt-1 text-gray-600 dark:text-gray-400"
              >
                {t('admin.roles.deleteConfirm.message', { name: roleToDelete.name })}
              </p>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={cancelDelete}
                className="flex-1 px-4 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition rm-action-btn"
                disabled={submitting}
              >
                {t('admin.actions.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm transition rm-action-btn disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? (
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                    <span>{t('admin.actions.deleting')}</span>
                  </div>
                ) : (
                  t('admin.actions2.delete')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RolesManagementPage;