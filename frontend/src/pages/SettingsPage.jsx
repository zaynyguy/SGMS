import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import { Moon, Sun, Upload, X, User, Save, Shield, Palette, UserCircle } from "lucide-react";
import LanguageSwitcher from "../components/common/LanguageSwitcher";
import Toast from "../components/common/Toast";

const SettingsPage = () => {
  const { t } = useTranslation();
  const { token, updateUser } = useAuth();
  const [settings, setSettings] = useState({
    username: "",
    name: "",
    language: "en",
    darkMode: false,
    profilePicture: null,
  });
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [passwordError, setPasswordError] = useState("");
  const [oldPasswordError, setOldPasswordError] = useState("");
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      setSettings(data);

      // Apply saved theme
      if (data.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (err) {
      showToast(t('settings.errors.loadError'), "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = "create") => {
    setToast({ message, type });
  };

  const handleToastClose = () => {
    setToast(null);
  };

  useEffect(() => { 
    fetchSettings(); 
  }, []);

  // Handle profile picture selection
  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      showToast(t('settings.errors.invalidImage'), "error");
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast(t('settings.errors.imageTooLarge'), "error");
      return;
    }

    setProfilePictureFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setProfilePicturePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Upload profile picture
  const uploadProfilePicture = async () => {
    if (!profilePictureFile) return;

    setUploadingPicture(true);
    try {
      const formData = new FormData();
      formData.append('profilePicture', profilePictureFile);

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/settings/profile-picture`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('settings.errors.uploadError'));
      }
      
      const data = await response.json();
      updateUser(data.user, data.token);
      setSettings(prev => ({ ...prev, profilePicture: data.user.profilePicture }));
      setProfilePictureFile(null);
      setProfilePicturePreview(null);
      showToast(t('settings.toasts.pictureSuccess'), "update");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setUploadingPicture(false);
    }
  };

  // Remove profile picture preview
  const removeProfilePicturePreview = () => {
    setProfilePictureFile(null);
    setProfilePicturePreview(null);
  };

  // Password validation function
  const validatePassword = () => {
    let isValid = true;
    
    // Validate old password if new password is provided
    if (newPassword && !oldPassword) {
      setOldPasswordError(t('settings.errors.oldPasswordRequired'));
      isValid = false;
    } else {
      setOldPasswordError("");
    }
    
    // Validate new password length
    if (newPassword && newPassword.length < 8) {
      setPasswordError(t('settings.errors.passwordTooShort'));
      isValid = false;
    } else {
      setPasswordError("");
    }
    
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate passwords before submission
    if (!validatePassword()) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: settings.name,
          language: settings.language,
          darkMode: settings.darkMode,
          oldPassword: oldPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('settings.errors.updateError'));
      }
      
      const data = await response.json();
      updateUser(data.user, data.token);
      showToast(t('settings.toasts.updateSuccess'), "update");
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleDarkMode = () => {
    setSettings(prev => {
      const newDarkMode = !prev.darkMode;
      // Apply immediately to the page
      if (newDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return { ...prev, darkMode: newDarkMode };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-500 mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">{t('settings.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <header className="sticky bg-gray-200 dark:bg-gray-900  z-10 p-5">
        <div className="max-w-8xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center">
            <UserCircle className="mr-2" size={24} />
            {t('settings.title')}
          </h1>
        </div>
      </header>

      <div className="container max-w-8xl mx-auto px-4 py-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden divide-y divide-gray-200 dark:divide-gray-700">
          <form onSubmit={handleSubmit}>
            
            {/* Profile Picture */}
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mr-3">
                  <User size={18} />
                </div>
                <h2 className="font-semibold text-lg">{t('settings.profilePicture')}</h2>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                  <img
                    src={profilePicturePreview || settings.profilePicture || "/default-avatar.png"}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                  />
                  {profilePicturePreview && (
                    <button
                      type="button"
                      onClick={removeProfilePicturePreview}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div>
                    <input
                      type="file"
                      id="profile-picture"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="profile-picture"
                      className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {t('settings.chooseImage')}
                    </label>
                  </div>
                  {profilePictureFile && (
                    <button
                      type="button"
                      onClick={uploadProfilePicture}
                      disabled={uploadingPicture}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {uploadingPicture ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          {t('settings.uploading')}
                        </>
                      ) : (
                        t('settings.upload')
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Personal Info */}
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mr-3">
                  <UserCircle size={18} />
                </div>
                <h2 className="font-semibold text-lg">{t('settings.personalInfo')}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.username')}
                  </label>
                  <input
                    type="text"
                    value={settings.username}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('settings.usernameHelp')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.name')}
                  </label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t('settings.namePlaceholder')}
                  />
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mr-3">
                  <Palette size={18} />
                </div>
                <h2 className="font-semibold text-lg">{t('settings.appearance')}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.language')}
                  </label>
                  <LanguageSwitcher
                    compact
                    value={settings.language}
                    onChange={(lang) => setSettings({ ...settings, language: lang })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.theme')}
                  </label>
                  <button
                    type="button"
                    onClick={toggleDarkMode}
                    className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    <span>
                      {settings.darkMode ? t('settings.lightMode') : t('settings.darkMode')}
                    </span>
                    {settings.darkMode ? (
                      <Sun className="w-4 h-4" />
                    ) : (
                      <Moon className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mr-3">
                  <Shield size={18} />
                </div>
                <h2 className="font-semibold text-lg">{t('settings.changePassword')}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.oldPassword')}
                  </label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => {
                      setOldPassword(e.target.value);
                      if (e.target.value && oldPasswordError) {
                        setOldPasswordError("");
                      }
                    }}
                    placeholder={t('settings.passwordPlaceholder')}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      oldPasswordError 
                        ? "border-red-500 dark:border-red-400" 
                        : "border-gray-300 dark:border-gray-600"
                    } bg-white dark:bg-gray-700`}
                  />
                  {oldPasswordError && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                      {oldPasswordError}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.newPassword')}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (e.target.value && e.target.value.length < 8) {
                        setPasswordError(t('settings.errors.passwordTooShort'));
                      } else {
                        setPasswordError("");
                      }
                    }}
                    placeholder={t('settings.passwordPlaceholder')}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      passwordError 
                        ? "border-red-500 dark:border-red-400" 
                        : "border-gray-300 dark:border-gray-600"
                    } bg-white dark:bg-gray-700`}
                  />
                  {passwordError && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                      {passwordError}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('settings.passwordRequirements')}
                  </p>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50">
              <button
                type="submit"
                disabled={saving || (newPassword && newPassword.length < 8) || (newPassword && !oldPassword)}
                className="w-full md:w-auto flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    {t('settings.saving')}
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    {t('settings.saveChanges')}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast Component */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={handleToastClose} 
        />
      )}
    </div>
  );
};

export default SettingsPage;