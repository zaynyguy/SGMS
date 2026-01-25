import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import TopBar from '../components/layout/TopBar';

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
   Portal utilities (Modal + PortalToast)
   --------------------------- */

// Generic portal modal that attaches to document.body so it's centered in the viewport
const Modal = ({ children, onClose, backdropClassName = '', containerClassName = '' }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    // prevent body scroll while modal is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center p-3 z-50 ${backdropClassName}`}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        // close when clicking on backdrop (but not when clicking inside the dialog)
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={`max-w-full w-full ${containerClassName}`}>{children}</div>
    </div>,
    document.body
  );
};

// Portal for toast so it is rendered on body (avoids being clipped / positioned incorrectly)
const PortalToast = ({ toast, onClose }) => {
  if (!toast) return null;
  return createPortal(
    <div className="fixed z-50 right-4 bottom-4">
      <Toast key={toast?.id || 'portal-toast'} message={toast.text} type={toast.type} onClose={onClose} />
    </div>,
    document.body
  );
};

/* ---------------------------
   Material Design 3 Component
   --------------------------- */
const App = () => {
  const { t, i18n } = useTranslation();

  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);

  // Material Design 3 color system - light theme
  const lightColors = {
    primary: "#10B981",
    onPrimary: "#FFFFFF",
    primaryContainer: "#BBF7D0",
    onPrimaryContainer: "#047857",
    secondary: "#4F7AE6",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#DBE6FD",
    onSecondaryContainer: "#0B2962",
    tertiary: "#9333EA",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#E9D7FD",
    onTertiaryContainer: "#381E72",
    error: "#B3261E",
    onError: "#FFFFFF",
    errorContainer: "#F9DEDC",
    onErrorContainer: "#410E0B",
    background: "#FFFFFF",
    onBackground: "#111827",
    surface: "#FFFFFF",
    onSurface: "#111827",
    surfaceVariant: "#EEF2F7",
    onSurfaceVariant: "#444C45",
    outline: "#737B73",
    outlineVariant: "#C2C9C2",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#313033",
    inverseOnSurface: "#F4EFF4",
    inversePrimary: "#99F6E4",
    surfaceContainerLowest: "#FFFFFF",
    surfaceContainerLow: "#F5F9F2",
    surfaceContainer: "#F0F5ED",
    surfaceContainerHigh: "#EBF1E9",
    surfaceContainerHighest: "#E5ECE3",
  };

  // Material Design 3 color system - dark theme
  const darkColors = {
    primary: "#4ADE80",
    onPrimary: "#002115",
    primaryContainer: "#003925",
    onPrimaryContainer: "#BBF7D0",
    secondary: "#B6C9FF",
    onSecondary: "#1E307D",
    secondaryContainer: "#354796",
    onSecondaryContainer: "#DBE6FD",
    tertiary: "#D0BCFF",
    onTertiary: "#4F308B",
    tertiaryContainer: "#6745A3",
    onTertiaryContainer: "#E9D7FD",
    error: "#FFB4AB",
    onError: "#690005",
    errorContainer: "#93000A",
    onErrorContainer: "#FFDAD6",
    background: "#1A1C19",
    onBackground: "#E1E3DD",
    surface: "#1A1C19",
    onSurface: "#E1E3DD",
    surfaceVariant: "#444C45",
    onSurfaceVariant: "#C2C9C2",
    outline: "#8C948D",
    outlineVariant: "#444C45",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#E1E3DD",
    inverseOnSurface: "#1A1C19",
    inversePrimary: "#006D5B",
    surfaceContainerLowest: "#222421",
    surfaceContainerLow: "#2D2F2C",
    surfaceContainer: "#313330",
    surfaceContainerHigh: "#3B3D3A",
    surfaceContainerHighest: "#454744",
  };

  // Select colors based on dark mode
  const m3Colors = darkMode ? darkColors : lightColors;

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
    setToast({ id: Date.now(), text: message, type: tType });
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
      <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse text-gray-500 dark:text-gray-400 text-sm">
          {t('admin.roles.loading')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md text-center border border-red-100 dark:border-red-900 max-w-xl">
          <AlertTriangle className="h-5 w-5 text-red-500 mx-auto dark:text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            {t('admin.roles.errors.title')}
          </h3>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{error}</p>
          <button
            onClick={loadData}
            className="mt-3 px-4 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-full transition-all duration-200 shadow-md"
          >
            {t('admin.actions.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  // Render page
  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 font-sans p-3 sm:p-4 md:p-6 transition-colors duration-300 ${mounted ? 'animate-fade-in' : ''}`}
      style={{
        "--primary": m3Colors.primary,
        "--on-primary": m3Colors.onPrimary,
        "--primary-container": m3Colors.primaryContainer,
        "--on-primary-container": m3Colors.onPrimaryContainer,
        "--secondary": m3Colors.secondary,
        "--on-secondary": m3Colors.onSecondary,
        "--secondary-container": m3Colors.secondaryContainer,
        "--on-secondary-container": m3Colors.onSecondaryContainer,
        "--tertiary": m3Colors.tertiary,
        "--on-tertiary": m3Colors.onTertiary,
        "--tertiary-container": m3Colors.tertiaryContainer,
        "--on-tertiary-container": m3Colors.onTertiaryContainer,
        "--error": m3Colors.error,
        "--on-error": m3Colors.onError,
        "--error-container": m3Colors.errorContainer,
        "--on-error-container": m3Colors.onErrorContainer,
        "--background": m3Colors.background,
        "--on-background": m3Colors.onBackground,
        "--surface": m3Colors.surface,
        "--on-surface": m3Colors.onSurface,
        "--surface-variant": m3Colors.surfaceVariant,
        "--on-surface-variant": m3Colors.onSurfaceVariant,
        "--outline": m3Colors.outline,
        "--outline-variant": m3Colors.outlineVariant,
        "--shadow": m3Colors.shadow,
        "--scrim": m3Colors.scrim,
        "--inverse-surface": m3Colors.inverseSurface,
        "--inverse-on-surface": m3Colors.inverseOnSurface,
        "--inverse-primary": m3Colors.inversePrimary,
        "--surface-container-lowest": m3Colors.surfaceContainerLowest,
        "--surface-container-low": m3Colors.surfaceContainerLow,
        "--surface-container": m3Colors.surfaceContainer,
        "--surface-container-high": m3Colors.surfaceContainerHigh,
        "--surface-container-highest": m3Colors.surfaceContainerHighest,
      }}
    >
      <style>{`
        :root {
          --primary: ${m3Colors.primary};
          --on-primary: ${m3Colors.onPrimary};
          --primary-container: ${m3Colors.primaryContainer};
          --on-primary-container: ${m3Colors.onPrimaryContainer};
          --secondary: ${m3Colors.secondary};
          --on-secondary: ${m3Colors.onSecondary};
          --secondary-container: ${m3Colors.secondaryContainer};
          --on-secondary-container: ${m3Colors.onSecondaryContainer};
          --tertiary: ${m3Colors.tertiary};
          --on-tertiary: ${m3Colors.onTertiary};
          --tertiary-container: ${m3Colors.tertiaryContainer};
          --on-tertiary-container: ${m3Colors.onTertiaryContainer};
          --error: ${m3Colors.error};
          --on-error: ${m3Colors.onError};
          --error-container: ${m3Colors.errorContainer};
          --on-error-container: ${m3Colors.onErrorContainer};
          --background: ${m3Colors.background};
          --on-background: ${m3Colors.onBackground};
          --surface: ${m3Colors.surface};
          --on-surface: ${m3Colors.onSurface};
          --surface-variant: ${m3Colors.surfaceVariant};
          --on-surface-variant: ${m3Colors.onSurfaceVariant};
          --outline: ${m3Colors.outline};
          --outline-variant: ${m3Colors.outlineVariant};
          --shadow: ${m3Colors.shadow};
          --scrim: ${m3Colors.scrim};
          --inverse-surface: ${m3Colors.inverseSurface};
          --inverse-on-surface: ${m3Colors.inverseOnSurface};
          --inverse-primary: ${m3Colors.inversePrimary};
          --surface-container-lowest: ${m3Colors.surfaceContainerLowest};
          "--surface-container-low": ${m3Colors.surfaceContainerLow};
          "--surface-container": ${m3Colors.surfaceContainer};
          "--surface-container-high": ${m3Colors.surfaceContainerHigh};
          "--surface-container-highest": ${m3Colors.surfaceContainerHighest};
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @keyframes material-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }

        .surface-elevation-1 { box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04);  }
        .surface-elevation-2 { box-shadow: 0 2px 6px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06);  }
        .surface-elevation-3 { box-shadow: 0 4px 12px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08);  }
      `}</style>

      {/* Toast rendered into document.body via portal */}
      <PortalToast toast={toast} onClose={handleToastClose} />

      {/* Header */}
      <div className="max-w-8xl mx-auto px-4 mb-6">
        <div className='overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl'>
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="px-5 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center min-w-0 gap-4">
                  <div className="p-3 rounded-xl bg-green-100 dark:bg-indigo-900 surface-elevation-1">
                    <Shield className="h-6 w-6 text-green-800 dark:text-indigo-200" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {t('admin.roles.title')}
                    </h1>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                      {t("admin.roles.subtitle")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <TopBar />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-8xl mx-auto px-4 mb-6 bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
        <div className='overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl'>
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="px-5 py-4">
              <section className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Roles column */}
                  <div className="lg:col-span-1">
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl surface-elevation-1 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <Shield size={18} /> {t('admin.roles.rolesList')}
                        </h2>
                      </div>

                      {/* Desktop list */}
                      <div className="hidden md:block">
                        {roles.length > 0 ? (
                          <ul className="space-y-3 mb-5">
                            {roles.map((role, index) => (
                              <li
                                key={role.id}
                                className="flex items-center justify-between rounded-xl overflow-hidden surface-elevation-1 hover:surface-elevation-2 transition-shadow duration-200"
                                style={{ animation: `material-in 0.4s ease-out forwards`, animationDelay: `${index * 0.04}s` }}
                              >
                                <button
                                  onClick={() => setSelectedRoleId(role.id)}
                                  className={`flex-1 text-left p-3 text-sm rounded-l-xl font-medium transition-colors ${selectedRoleId === role.id
                                      ? 'bg-green-100 dark:bg-indigo-900 text-green-800 dark:text-indigo-200'
                                      : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                >
                                  {role.name}
                                </button>

                                <div className="flex items-center gap-1.5 p-2">
                                  <button
                                    onClick={() => handleDeleteClick(role)}
                                    disabled={role.name === 'Admin' || submitting}
                                    aria-label={t('admin.roles.deleteRole', { name: role.name })}
                                    className={`p-2 rounded-full transition-all duration-200 ${role.name === 'Admin'
                                        ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                        : 'text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900'
                                      }`}
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{t('admin.roles.noRoles')}</p>
                        )}

                        {/* add role */}
                        {isAddingRole ? (
                          <div className="flex flex-col gap-3 w-full surface-elevation-2 rounded-xl p-4 mb-3">
                            <div className="flex gap-3 w-full">
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
                                className="flex-1 px-3 py-2.5 text-sm border rounded-full bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 dark:ring-indigo-500"
                              />
                              <button
                                onClick={() => {
                                  setIsAddingRole(false);
                                  setNewRoleName("");
                                }}
                                className="p-2.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition duration-200"
                                aria-label={t("admin.roles.roleActions.remove")}
                              >
                                <X size={20} />
                              </button>
                            </div>

                            <button
                              onClick={handleAddRole}
                              className="w-full px-4 py-2.5 text-sm bg-green-500 hover:bg-green-600 dark:bg-indigo-500 hover:dark:bg-indigo-600 text-white rounded-full font-medium transition duration-200 surface-elevation-1"
                              aria-label={t("admin.roles.roleActions.add")}
                            >
                              {t("admin.roles.roleActions.add")}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setIsAddingRole(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition duration-200 surface-elevation-1"
                          >
                            <Plus size={18} /> {t("admin.roles.addRole")}
                          </button>
                        )}

                        <div className="flex flex-shrink-0 mt-6 justify-center items-center">
                          {hasUnsavedChanges && (
                            <button
                              onClick={handleSaveChanges}
                              className="hidden md:flex w-full px-4 py-2.5 text-sm bg-green-500 hover:bg-green-600 dark:text-indigo-200 dark:bg-indigo-900 text-white rounded-xl font-medium transition-all duration-200 shadow-md justify-center items-center gap-2 surface-elevation-1"
                              aria-label={t("admin.actions.saveChanges")}
                            >
                              {t("admin.actions.saveChanges")}
                            </button>
                          )}
                        </div>
                      </div>



                      {/* Mobile: horizontal role chips */}
                      <div className="md:hidden mt-3">
                        <div className="flex gap-2 overflow-x-auto py-2 mb-3">
                          {roles.map((role, index) => {
                            const active = selectedRoleId === role.id;
                            return (
                              <button
                                key={role.id}
                                onClick={() => setSelectedRoleId(role.id)}
                                className={`flex-shrink-0 px-3 py-1.5 text-sm rounded-full border transition-all duration-200 ${active
                                    ? 'bg-green-500 dark:bg-indigo-600 text-white border-green-500 dark:border-indigo-600'
                                    : 'bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500'
                                  }`}
                                aria-current={active ? 'true' : undefined}
                                style={{ animation: `material-in 0.4s ease-out forwards`, animationDelay: `${index * 0.04}s` }}
                              >
                                {role.name}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => setIsAddingRole(true)}
                            className="flex-shrink-0 p-1.5 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition duration-200 surface-elevation-1"
                            aria-label={t('admin.roles.addRole')}
                          >
                            <Plus size={16} />
                          </button>
                        </div>

                        {isAddingRole && (
                          <div className="flex flex-col gap-3 mb-3 surface-elevation-2 rounded-xl p-4">
                            <input
                              autoFocus
                              value={newRoleName}
                              onChange={(e) => setNewRoleName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddRole();
                                if (e.key === 'Escape') { setIsAddingRole(false); setNewRoleName(''); }
                              }}
                              placeholder={t('admin.roles.roleNamePlaceholder')}
                              className="w-full px-3 py-2.5 text-sm border rounded-full bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-indigo-600"
                            />
                            <button onClick={handleAddRole} className="w-full px-4 py-2.5 text-sm bg-green-500 dark:bg-indigo-600 text-white rounded-full font-medium transition duration-200 surface-elevation-1">{t('admin.actions2.create')}</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Permissions area */}
                  <div className="lg:col-span-2">
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl surface-elevation-1 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <Settings size={18} /> {t('admin.roles.permissions')}
                        </h2>
                      </div>

                      {/* Desktop table */}
                      <div className="hidden md:block overflow-x-auto">
                        {roles.length > 0 && permissions.length > 0 ? (
                          <table className="min-w-full table-auto text-sm">
                            <thead className="bg-gray-200 dark:bg-gray-600">
                              <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-200 dark:bg-gray-600 z-10">
                                  {t('admin.roles.permission')}
                                </th>
                                {roles.map(role => (
                                  <th key={role.id} className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {role.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                              {permissions.map((permission, index) => {
                                const meta = PERMISSION_META[permission.name] || { label: permission.name, description: permission.description || '', Icon: FileText };
                                const Icon = meta.Icon || FileText;
                                return (
                                  <tr
                                    key={permission.id}
                                    className="hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
                                    style={{ animation: `material-in 0.4s ease-out forwards`, animationDelay: `${index * 0.04}s` }}
                                  >
                                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white sticky left-0 bg-gray-100 dark:bg-gray-700 z-10">
                                      <div className="flex items-start gap-3">
                                        <div className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-600 surface-elevation-1">
                                          <Icon className="w-4.5 h-4.5 text-green-500 dark:text-indigo-500" />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="font-semibold text-gray-900 dark:text-white truncate">{meta.label}</div>
                                          {meta.description && <div className="text-sm text-gray-500 dark:text-gray-400">{meta.description}</div>}
                                        </div>
                                      </div>
                                    </td>

                                    {roles.map(role => {
                                      const checked = roleHasPermission(role, permission.id);
                                      return (
                                        <td
                                          key={`perm-${permission.id}-role-${role.id}`}
                                          className="px-4 py-3 whitespace-nowrap text-center cursor-pointer select-none"
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
                                          <div className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto transition-all duration-200 ${checked
                                              ? 'bg-green-500 dark:bg-indigo-600 text-white'
                                              : 'bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-500'
                                            }`}>
                                            {checked && (
                                              <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                                            )}
                                          </div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">{t('admin.roles.noPermissions')}</p>
                        )}
                      </div>

                      {/* Mobile single-role permission list */}
                      <div className="md:hidden">
                        {selectedRole ? (
                          <>
                            <div className="mb-3 text-sm text-gray-500 dark:text-gray-400 font-medium">{t('admin.roles.editingRole', { name: selectedRole.name })}</div>

                            <div className="space-y-4">
                              {permissions.map(permission => {
                                const meta = PERMISSION_META[permission.name] || { label: permission.name, description: permission.description || '', Icon: FileText };
                                const Icon = meta.Icon || FileText;
                                const checked = roleHasPermission(selectedRole, permission.id);

                                return (
                                  <div
                                    key={permission.id}
                                    className="flex items-start gap-3 p-3 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-600 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors duration-200 surface-elevation-1"
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
                                    <div className="p-2.5 rounded-xl bg-gray-300 dark:bg-gray-700 surface-elevation-1">
                                      <Icon className="w-5 h-5 text-green-500 dark:text-indigo-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-gray-900 dark:text-white truncate">{meta.label}</div>
                                      {meta.description && <div className="text-sm text-gray-500 dark:text-gray-400">{meta.description}</div>}
                                    </div>

                                    <div className="flex items-center">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${checked
                                          ? 'bg-green-500 dark:bg-indigo-600 text-white'
                                          : 'bg-gray-300 dark:bg-gray-500 border border-gray-400 dark:border-gray-500'
                                        }`}>
                                        {checked && (
                                          <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Mobile action row */}
                            <div className="mt-5 flex flex-col sm:flex-row gap-3">
                              <button
                                onClick={() => handleDeleteClick(selectedRole)}
                                disabled={selectedRole.name === 'Admin' || submitting}
                                className="flex-1 px-4 py-2.5 text-sm rounded-full font-medium transition duration-200 surface-elevation-1 flex items-center justify-center gap-2
                                  bg-red-800 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                                aria-label={t('admin.roles.deleteRole', { name: selectedRole.name })}
                              >
                                <span>{t('admin.roles.deleteRole')}</span>
                              </button>

                              <button
                                onClick={handleSaveChanges}
                                className="flex-1 px-4 py-2.5 text-sm bg-green-500 hover:bg-green-600 text-white rounded-full font-medium transition duration-200 surface-elevation-1 flex items-center justify-center gap-2"
                                aria-label={t('admin.actions.saveChanges')}
                              >
                                {t('admin.actions.saveChanges')}
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">{t('admin.roles.noRoles')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal - rendered via portal Modal component */}
      {showDeleteConfirmModal && roleToDelete && (
        <Modal onClose={cancelDelete} backdropClassName="bg-black/[0.6] dark:bg-gray-900/[0.8] animate-fade-in">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl w-full max-w-md surface-elevation-3 text-sm mx-auto">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900">
                <Trash2 className="h-6 w-6 text-red-600 dark:text-red-300" />
              </div>
              <h3 id="delete-title" className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">
                {t('admin.roles.deleteRole') || t('admin.roles.deleteConfirm.heading') || t('admin.roles.deleteConfirm')}
              </h3>
              <p id="delete-desc" className="mt-2 text-gray-500 dark:text-gray-400">
                {t('admin.roles.deleteConfirm.message', { name: roleToDelete.name })}
              </p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={cancelDelete} className="flex-1 px-4 py-2.5 text-sm rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-200" disabled={submitting}>
                {t('admin.actions.cancel')}
              </button>
              <button type="button" onClick={confirmDelete} className="flex-1 px-4 py-2.5 text-sm rounded-full bg-red-500 hover:bg-red-600 text-white font-medium transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed surface-elevation-1" disabled={submitting || roleToDelete.name === 'Admin'}>
                {submitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>{t('admin.actions.deleting')}</span>
                  </div>
                ) : (
                  t('admin.actions2.delete')
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default App;