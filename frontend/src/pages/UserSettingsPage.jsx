import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

const UserSettingsPage = () => {
  const { user, updateUser } = useAuth();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Profile form
  const { register: profileRegister, handleSubmit: handleProfileSubmit, reset: resetProfile } = useForm();
  // Password form, with validation errors, getValues, and watch for comparison
  const {
    register: passwordRegister,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors },
    getValues,
    watch
  } = useForm();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const settings = await getMySettings();
        resetProfile({
          name: settings.name,
          language: settings.language,
        });
        setDarkMode(settings.darkMode);
        // Set the language in i18n
        if (settings.language) {
          i18n.changeLanguage(settings.language);
        }
      } catch (error) {
        showToast(t('settings.loadError'), 'error');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [resetProfile, i18n, t]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleProfileUpdate = async (data) => {
    try {
      const updatedSettings = await updateMySettings({
        name: data.name,
        language: data.language,
        darkMode,
      });
      // Change language if it was updated
      if (data.language !== i18n.language) {
        i18n.changeLanguage(data.language);
      }
      updateUser(updatedSettings);
      showToast(t('settings.profileSuccess'));
    } catch (error) {
      showToast(t('settings.profileError'), 'error');
    }
  };

  const handlePasswordUpdate = async (data) => {
    try {
      console.log("Updating password with new data:", data);
      await new Promise(resolve => setTimeout(resolve, 500));
      resetPassword();
      showToast(t('settings.passwordSuccess'));
    } catch (error) {
      showToast(t('settings.passwordError'), 'error');
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Watch the newPassword field for real-time validation feedback
  const newPasswordValue = watch('newPassword');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100 dark:bg-gray-900">
        <img className="animate-pulse text-6xl" src="src/assets/logo.png" alt={t('loading')}></img>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col font-sans antialiased">
      <header className="w-full bg-white dark:bg-gray-800 shadow-sm z-30 sticky top-0 px-8 py-4 flex items-center justify-between">
        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('settings.title')}</div>
      </header>

      <div className="max-w-6xl w-full mx-auto px-8 py-8 flex-grow">
        <div className="space-y-8">
          {/* Profile Settings Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">{t('settings.profileTitle')}</h2>
            <form onSubmit={handleProfileSubmit(handleProfileUpdate)} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.name')}
                </label>
                <input
                  type="text"
                  id="name"
                  {...profileRegister('name', { required: true })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white transition-colors"
                  placeholder={t('settings.namePlaceholder')}
                />
              </div>

              <div>
                <label htmlFor="language" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.language')}
                </label>
                <select
                  id="language"
                  {...profileRegister('language')}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white transition-colors"
                >
                  <option value="en">{t('languages.english')}</option>
                  <option value="om">{t('languages.oromo')}</option>
                  <option value="am">{t('languages.amharic')}</option>
                  <option value="hr">{t('languages.harari')}</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label htmlFor="darkMode" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t('settings.darkMode')}
                </label>
                <div
                  className={`relative w-14 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                    darkMode ? 'bg-green-500 dark:bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  onClick={toggleDarkMode}
                >
                  <div
                    className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${
                      darkMode ? 'translate-x-6' : ''
                    }`}
                  ></div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-green-500 dark:bg-blue-600 text-white rounded-lg font-bold hover:bg-green-600 hover:dark:bg-blue-700 transition-colors duration-300 shadow-md"
                >
                  {t('settings.saveProfile')}
                </button>
              </div>
            </form>
          </div>

          {/* Password Settings Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">{t('settings.passwordTitle')}</h2>
            <form onSubmit={handlePasswordSubmit(handlePasswordUpdate)} className="space-y-6">
              <div className="relative">
                <label htmlFor="currentPassword" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.currentPassword')}
                </label>
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  id="currentPassword"
                  {...passwordRegister('currentPassword', {
                    required: t('settings.errors.currentPasswordRequired'),
                    minLength: {
                      value: 8,
                      message: t('settings.errors.passwordMinLength')
                    }
                  })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white transition-colors pr-12"
                  placeholder={t('settings.currentPasswordPlaceholder')}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 top-6 flex items-center px-4 text-gray-600 dark:text-gray-400 focus:outline-none"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
                {passwordErrors.currentPassword && (
                  <p className="mt-1 text-sm text-red-500">{passwordErrors.currentPassword.message}</p>
                )}
              </div>

              <div className="relative">
                <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.newPassword')}
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    id="newPassword"
                    {...passwordRegister('newPassword', {
                      required: t('settings.errors.newPasswordRequired'),
                      minLength: {
                        value: 8,
                        message: t('settings.errors.passwordMinLength')
                      },
                      validate: {
                        hasNumber: value => /[0-9]/.test(value) || t('settings.errors.hasNumber'),
                        hasSpecialChar: value => /[!@#$%^&*(),.?":{}|<>]/.test(value) || t('settings.errors.hasSpecialChar'),
                        hasUpperCase: value => /[A-Z]/.test(value) || t('settings.errors.hasUpperCase'),
                        notSameAsCurrent: value =>
                          value !== watch('currentPassword') ||
                          t('settings.errors.notSameAsCurrent')
                      }
                    })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white transition-colors pr-12"
                    placeholder={t('settings.newPasswordPlaceholder')}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {passwordErrors.newPassword && (
                  <p className="mt-1 text-sm text-red-500">{passwordErrors.newPassword.message}</p>
                )}
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <p>{t('settings.passwordRequirements')}:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li className={newPasswordValue?.length >= 8 ? 'text-green-500' : 'text-red-500'}>
                      {t('settings.requirements.minLength')}
                    </li>
                    <li className={/[0-9]/.test(newPasswordValue) ? 'text-green-500' : 'text-red-500'}>
                      {t('settings.requirements.number')}
                    </li>
                    <li className={/[A-Z]/.test(newPasswordValue) ? 'text-green-500' : 'text-red-500'}>
                      {t('settings.requirements.uppercase')}
                    </li>
                    <li className={/[!@#$%^&*(),.?":{}|<>]/.test(newPasswordValue) ? 'text-green-500' : 'text-red-500'}>
                      {t('settings.requirements.specialChar')}
                    </li>
                  </ul>
                </div>
              </div>

              <div className="relative">
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.confirmPassword')}
                </label>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  {...passwordRegister('confirmPassword', {
                    required: t('settings.errors.confirmPasswordRequired'),
                    validate: value =>
                      value === watch('newPassword') || t('settings.errors.passwordsDontMatch')
                  })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white transition-colors pr-12"
                  placeholder={t('settings.confirmPasswordPlaceholder')}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 top-6 flex items-center px-4 text-gray-600 dark:text-gray-400 focus:outline-none"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
                {passwordErrors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-500">{passwordErrors.confirmPassword.message}</p>
                )}
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={Object.keys(passwordErrors).length > 0 || !newPasswordValue || newPasswordValue === watch('currentPassword')}
                  className={`w-full py-3 bg-green-500 dark:bg-blue-600 text-white rounded-lg font-bold transition-colors duration-300 shadow-md ${
                    Object.keys(passwordErrors).length > 0 || !newPasswordValue || newPasswordValue === watch('currentPassword')
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-green-600 hover:dark:bg-blue-700'
                  }`}
                >
                  {t('settings.changePassword')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-8 right-8 px-6 py-4 rounded-xl shadow-lg flex items-center space-x-3 transform transition-transform duration-300 ease-out z-50 ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle size={24} /> : <XCircle size={24} />}
          <span className="text-lg font-semibold">{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default UserSettingsPage;