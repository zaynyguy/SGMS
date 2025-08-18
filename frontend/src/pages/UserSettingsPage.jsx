import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, Info, ChevronDown, Moon, Sun, X } from "lucide-react";
import LanguageSwitcher from "../components/common/LanguageSwitcher";

const UserSettingsPage = () => {
  const { t } = useTranslation();
  const { token, updateUser } = useAuth();
  const [settings, setSettings] = useState({
    username: "",
    name: "",
    language: "en",
    darkMode: false,
  });
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [passwordError, setPasswordError] = useState("");

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      showToast(t('settings.errors.loadError'), "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = "info") => {
    setToast({ message, type });
  };

  useEffect(() => { fetchSettings(); }, []);

  // Password validation function
  const validatePassword = () => {
    if (newPassword && newPassword.length < 8) {
      setPasswordError(t('settings.errors.passwordTooShort'));
      return false;
    }
    setPasswordError("");
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate password before submission
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
          language: settings.language,
          darkMode: settings.darkMode,
          oldPassword: oldPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      if (!response.ok) throw new Error(t('settings.errors.updateError'));
      const data = await response.json();
      updateUser(data.user, data.token);
      showToast(t('settings.toasts.updateSuccess'), "success");
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleDarkMode = () => {
    setSettings({ ...settings, darkMode: !settings.darkMode });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-600">
          {t('settings.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10 p-4">
        <h1 className="text-xl font-bold">{t('settings.title')}</h1>
      </header>

      <div className="container mx-auto px-40 py-10">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <form onSubmit={handleSubmit} className="divide-y divide-gray-200 dark:divide-gray-700">
            
            {/* Personal Info */}
            <div className="p-6">
              <h2 className="font-medium mb-3">{t('settings.personalInfo')}</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {t('settings.username')}
                  </label>
                  <input
                    type="text"
                    value={settings.username}
                    readOnly
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {t('settings.name')}
                  </label>
                  <input
                    type="text"
                    value={settings.name}
                    readOnly
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700"
                  />
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div className="p-6">
              <h2 className="font-medium mb-3">{t('settings.appearance')}</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {t('settings.language')}
                  </label>
                  <LanguageSwitcher
                    compact
                    value={settings.language}
                    onChange={(lang) => setSettings({ ...settings, language: lang })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {t('settings.theme')}
                  </label>
                  <button
                    type="button"
                    onClick={toggleDarkMode}
                    className="flex items-center px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700"
                  >
                    {settings.darkMode ? (
                      <>
                        <Sun className="w-4 h-4 mr-2" />
                        {t('settings.lightMode')}
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4 mr-2" />
                        {t('settings.darkMode')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="p-6">
              <h2 className="font-medium mb-3">{t('settings.changePassword')}</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {t('settings.oldPassword')}
                  </label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder={t('settings.passwordPlaceholder')}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {t('settings.newPassword')}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      // Validate password on change
                      if (e.target.value && e.target.value.length < 8) {
                        setPasswordError(t('settings.errors.passwordTooShort'));
                      } else {
                        setPasswordError("");
                      }
                    }}
                    placeholder={t('settings.passwordPlaceholder')}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700"
                  />
                  {passwordError && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                      {passwordError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700">
              <button
                type="submit"
                disabled={saving || (newPassword && newPassword.length < 8)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded shadow-sm disabled:opacity-50 flex items-center justify-center"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('settings.saving')}
                  </>
                ) : t('settings.saveChanges')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto p-3 rounded shadow-lg flex items-center ${
            toast.type === 'success' ? 'bg-green-500' :
            toast.type === 'error' ? 'bg-red-500' :
            'bg-blue-500'
          } text-white text-sm`}
        >
          {toast.type === 'success' && <CheckCircle className="w-4 h-4 mr-2" />}
          {toast.type === 'error' && <XCircle className="w-4 h-4 mr-2" />}
          {toast.type === 'info' && <Info className="w-4 h-4 mr-2" />}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default UserSettingsPage;