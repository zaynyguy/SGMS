// src/pages/UsersManagementPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Edit, Trash, UserPlus, X } from 'lucide-react';
import { fetchUsers, createUser, updateUser, deleteUser, fetchRoles } from '../api/admin';
import { api as apiAuth } from '../api/auth'; // used for multipart upload to new backend route
import Toast from '../components/common/Toast';

/* ---------- Helpers ---------- */
const initialsFromName = (name, fallback) => {
  const n = (name || "").trim();
  if (!n) {
    const u = (fallback || "").trim();
    return (u[0] || "?").toUpperCase();
  }
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const gradientFromString = (s) => {
  let hash = 0;
  for (let i = 0; i < (s || "").length; i += 1) hash = (hash << 5) - hash + s.charCodeAt(i);
  const a = Math.abs(hash);
  const h1 = a % 360;
  const h2 = (180 + h1) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 60%), hsl(${h2} 70% 40%))`;
};

// Convert data: URL to File
const dataURLToFile = (dataURL, filename = 'upload.png') => {
  const arr = dataURL.split(',');
  const match = arr[0].match(/:(.*?);/);
  const mime = match ? match[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

/* ---------- Component ---------- */
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

  // For profile picture selection (file or URL)
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null); // objectURL or URL or data:
  const previewRef = useRef(null);

  // Toast helpers
  const showToast = (message, type = 'info') => setToast({ message, type, visible: true });
  const handleToastClose = () => setToast({ message: '', type: '', visible: false });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const usersData = await fetchUsers();
        setUsers(usersData || []);

        const rolesData = await fetchRoles();
        setRoles(rolesData || []);
      } catch (error) {
        console.error("load users error:", error);
        showToast(t('admin.users.errors.loadFailed', { error: error?.message || error }), 'error');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [t]);

  // cleanup object URL
  React.useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
      }
    };
  }, []);

  const validateForm = () => {
    const errors = {};
    if (!formData.username.trim()) errors.username = t('admin.users.errors.usernameRequired');
    if (!formData.name.trim()) errors.name = t('admin.users.errors.nameRequired');
    if (!userToEdit && !formData.password) errors.password = t('admin.users.errors.passwordRequired');
    else if (formData.password && formData.password.length < 8) errors.password = t('admin.users.errors.passwordTooShort');
    if (!formData.roleId) errors.roleId = t('admin.users.errors.roleRequired');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenUserModal = (user) => {
    if (user) {
      setFormData({
        username: user.username || '',
        name: user.name || '',
        password: '',
        roleId: user.role?.id || user.roleId || ''
      });
      setUserToEdit(user);
      setProfilePicturePreview(user.profilePicture || user.profilePictureUrl || null);
      setProfilePictureFile(null);
    } else {
      setFormData({ username: '', name: '', password: '', roleId: '' });
      setUserToEdit(null);
      setProfilePictureFile(null);
      setProfilePicturePreview(null);
    }
    setFormErrors({});
    setShowUserModal(true);
  };

  const handleCloseUserModal = () => {
    setShowUserModal(false);
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setProfilePictureFile(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  // file -> objectURL preview
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast(t('admin.users.errors.invalidImage') || "Invalid image file", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(t('admin.users.errors.imageTooLarge') || "Image too large (max 5 MB)", "error");
      return;
    }
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setProfilePicturePreview(url);
    setProfilePictureFile(file);
  };

  const removeProfilePreview = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setProfilePicturePreview(null);
    setProfilePictureFile(null);
  };

  /**
   * Upload file for given userId using new admin route:
   * PUT /api/users/:id/profile-picture  (field name: 'file')
   * Uses apiAuth helper so cookies/auth are handled.
   */
  const uploadProfileFileForUser = async (userId, file) => {
    if (!userId || !file) return null;
    const fd = new FormData();
    fd.append('file', file);
    // call auth.api helper - it prefixes with API_URL and uses _doFetch so credentials included
    // options.isFormData ensures Content-Type is not forced and browser sets boundary
    const result = await apiAuth(`/api/users/${userId}/profile-picture`, 'PUT', fd, { isFormData: true });
    return result;
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      showToast(t('admin.users.errors.formValidation'), 'error');
      return;
    }

    try {
      setSubmitting(true);

      // Build payload WITHOUT embedding large base64. We'll handle files separately.
      const payload = {
        username: formData.username.trim(),
        name: formData.name.trim(),
        roleId: Number(formData.roleId),
        ...(formData.password ? { password: formData.password } : {}),
      };

      // If profilePicturePreview is a plain remote/local URL and NOT a data: URL and no file selected,
      // we allow sending it as the profilePicture string (it's already a URL, small).
      const isPreviewUrl =
        profilePicturePreview &&
        (profilePicturePreview.startsWith('http') || profilePicturePreview.startsWith('/') || profilePicturePreview.startsWith('https'));
      if (!profilePictureFile && isPreviewUrl) {
        payload.profilePicture = profilePicturePreview;
      }

      // Create or update user first, then upload file (if any).
      let savedUser = null;
      if (userToEdit) {
        // update existing user (no profilePicture file yet)
        savedUser = await updateUser(userToEdit.id, payload);
      } else {
        // create new user (without file)
        savedUser = await createUser(payload);
      }

      // If admin selected a file -> upload to new admin upload endpoint
      if (profilePictureFile) {
        try {
          // If we created user, use new id; if updated, use existing id.
          const idForUpload = savedUser?.id;
          if (!idForUpload) throw new Error('User id not available for upload');

          // Upload file (FormData) — server responds with JSON including profilePicture and user
          await uploadProfileFileForUser(idForUpload, profilePictureFile);
        } catch (uploadErr) {
          // We do not abort the whole operation on upload failure, but notify admin
          console.error('Profile picture upload failed:', uploadErr);
          showToast(t('admin.users.errors.pictureUploadFailed') || 'Profile picture upload failed', 'error');
        }
      } else if (profilePicturePreview && profilePicturePreview.startsWith('data:') && savedUser?.id) {
        // preview is a data URL (maybe from a paste). Convert to File and upload so we avoid sending huge JSON.
        try {
          const f = dataURLToFile(profilePicturePreview, `${savedUser.username || savedUser.id}_pic.png`);
          await uploadProfileFileForUser(savedUser.id, f);
        } catch (err) {
          console.error('DataURL profile picture upload failed:', err);
          showToast(t('admin.users.errors.pictureUploadFailed') || 'Profile picture upload failed', 'error');
        }
      }

      // refresh list
      const updatedUsers = await fetchUsers();
      setUsers(updatedUsers || []);
      handleCloseUserModal();

      showToast(
        userToEdit
          ? t('admin.users.toasts.updateSuccess', { name: formData.name })
          : t('admin.users.toasts.createSuccess', { name: formData.name }),
        'success'
      );
    } catch (error) {
      console.error("save user error:", error);
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
      console.error("delete user error:", error);
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
        {toast.visible && <Toast message={toast.message} type={toast.type} onClose={handleToastClose} />}

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

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          {users.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('admin.users.table.user')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('admin.users.table.role')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('admin.users.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => {
                  const avatar = user.profilePicture || user.profilePictureUrl || null;
                  const roleLabel = user.role || user.role?.name || user.roleId || t('admin.users.noRole');
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-3">
                          {avatar ? (
                            <img src={avatar} alt={user.name || user.username} className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-700" />
                          ) : (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: gradientFromString(user.name || user.username || "user") }}>
                              {initialsFromName(user.name || "", user.username || "")}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white truncate">{user.name || user.username}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                          {roleLabel}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap space-x-1 text-right">
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
                  );
                })}
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
            users.map((user) => {
              const avatar = user.profilePicture || user.profilePictureUrl || null;
              const roleLabel = user.role || user.role?.name || user.roleId || t('admin.users.noRole');
              return (
                <div key={user.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {avatar ? (
                        <img src={avatar} alt={user.name || user.username} className="w-12 h-12 rounded-full object-cover border border-gray-100 dark:border-gray-700" />
                      ) : (
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: gradientFromString(user.name || user.username || "user") }}>
                          {initialsFromName(user.name || "", user.username || "")}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">{user.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</div>
                      </div>
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
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">{roleLabel}</span>
                  </div>
                </div>
              );
            })
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
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {profilePicturePreview ? (
                      <img src={profilePicturePreview} alt="preview" className="w-20 h-20 rounded-full object-cover border border-gray-100 dark:border-gray-700" />
                    ) : userToEdit?.profilePicture ? (
                      <img src={userToEdit.profilePicture} alt={userToEdit.name} className="w-20 h-20 rounded-full object-cover border border-gray-100 dark:border-gray-700" />
                    ) : (
                      <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: gradientFromString(formData.name || formData.username || "user") }}>
                        {initialsFromName(formData.name || "", formData.username || "")}
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('admin.users.form.picture')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input id="user-picture" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                      <label htmlFor="user-picture" className="inline-flex items-center px-3 py-2 border rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                        Upload
                      </label>
                      {profilePicturePreview && (
                        <button type="button" onClick={removeProfilePreview} className="text-sm text-red-600 dark:text-red-400">Remove</button>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('admin.users.form.pictureHint') || 'You can upload an image or leave blank.'}</p>
                  </div>
                </div>

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
