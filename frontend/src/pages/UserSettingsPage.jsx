import React, { useState, useEffect, useCallback } from 'react';
import { User, Lock, Palette, Sun, Moon, CheckCircle, AlertTriangle, X } from 'lucide-react';

// --- API SERVICE ---
// Replace with your actual API endpoint.
const API_URL =  import.meta.env.VITE_API_URL || 'https://sgms-production.up.railway.app';
; // Change this if your API is hosted elsewhere

const apiRequest = async (url, options = {}) => {
  // Assumes the JWT is stored in localStorage.
  const token = localStorage.getItem('jwt_token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { ...options, headers });
    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.message || `HTTP error! Status: ${response.status}`);
    }
    return responseData;
  } catch (error) {
    console.error("API Request Failed:", error);
    throw error;
  }
};

const getSettings = () => apiRequest(`${API_URL}/settings`);
const updateSettings = (settingsData) => apiRequest(`${API_URL}/settings`, {
  method: 'PUT',
  body: JSON.stringify(settingsData),
});
// --- END API SERVICE ---


// --- UI Components ---
const Toast = ({ message, type, onDismiss }) => {
  if (!message) return null;
  const styles = {
    success: { icon: <CheckCircle className="text-green-500" />, border: "border-green-500" },
    error: { icon: <AlertTriangle className="text-red-500" />, border: "border-red-500" },
  };
  return (
    <div className={`fixed top-5 right-5 z-[100] flex items-center w-full max-w-xs p-4 space-x-4 text-gray-600 bg-white rounded-lg shadow-lg dark:text-gray-300 dark:bg-gray-800 border-l-4 ${styles[type].border}`} role="alert">
      {styles[type].icon}
      <div className="text-sm font-normal">{message}</div>
      <button type="button" onClick={onDismiss} className="ms-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700" aria-label="Close">
        <X size={20} />
      </button>
    </div>
  );
};

const SettingsPage = () => {
  // --- STATE MANAGEMENT ---
  const [settings, setSettings] = useState({ language: 'en', darkMode: false });
  const [profileInfo, setProfileInfo] = useState({ username: '', name: '' });
  const [password, setPassword] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [toast, setToast] = useState({ message: '', type: '' });

  // --- DATA FETCHING ---
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSettings();
      setSettings({ language: data.language, darkMode: data.darkMode });
      setProfileInfo({ username: data.username, name: data.name });
      
      // Apply dark mode immediately based on fetched settings
      if (data.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // --- UTILITY & EVENT HANDLERS ---
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 4000);
  };

  const handleSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setSettings(prev => ({ ...prev, [name]: val }));

    if (name === 'darkMode') {
        if (checked) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPassword(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.newPassword && password.newPassword !== password.confirmPassword) {
      showToast("New passwords do not match.", "error");
      return;
    }
    
    setSaving(true);
    
    const payload = { ...settings };
    if (password.oldPassword && password.newPassword) {
      payload.oldPassword = password.oldPassword;
      payload.newPassword = password.newPassword;
    }

    try {
      const response = await updateSettings(payload);
      
      // CRITICAL: Update the JWT in localStorage with the new one from the backend
      if (response.token) {
        localStorage.setItem('jwt_token', response.token);
      }
      
      showToast(response.message || 'Settings updated successfully!');
      setPassword({ oldPassword: '', newPassword: '', confirmPassword: '' }); // Clear password fields
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // --- RENDER LOGIC ---
  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400">Loading settings...</div>;
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-900 min-h-screen">
      <Toast message={toast.message} type={toast.type} onDismiss={() => setToast({ message: '', type: '' })} />
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Account Settings</h1>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Profile Information Section */}
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-3 mb-6">
              <User /> Profile Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Username</label>
                <p className="mt-1 text-lg text-gray-800 dark:text-gray-200 p-3 bg-gray-100 dark:bg-gray-700 rounded-md">{profileInfo.username}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Name</label>
                <p className="mt-1 text-lg text-gray-800 dark:text-gray-200 p-3 bg-gray-100 dark:bg-gray-700 rounded-md">{profileInfo.name}</p>
              </div>
            </div>
          </div>

          {/* Appearance Section */}
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-3 mb-6">
              <Palette /> Appearance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                <label htmlFor="language" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Language</label>
                <select id="language" name="language" value={settings.language} onChange={handleSettingsChange} className="mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white">
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mt-2 md:mt-6">
                 <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    {settings.darkMode ? <Moon/> : <Sun/>} Dark Mode
                 </span>
                 <label htmlFor="darkMode" className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="darkMode" name="darkMode" className="sr-only peer" checked={settings.darkMode} onChange={handleSettingsChange} />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600"></div>
                 </label>
              </div>
            </div>
          </div>

          {/* Password Section */}
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-3 mb-6">
              <Lock /> Change Password
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="oldPassword" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Old Password</label>
                <input type="password" id="oldPassword" name="oldPassword" value={password.oldPassword} onChange={handlePasswordChange} className="mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-600 dark:text-gray-400">New Password</label>
                <input type="password" id="newPassword" name="newPassword" value={password.newPassword} onChange={handlePasswordChange} className="mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Confirm New Password</label>
                <input type="password" id="confirmPassword" name="confirmPassword" value={password.confirmPassword} onChange={handlePasswordChange} className="mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" />
              </div>
            </div>
          </div>
          
          {/* Submit Button */}
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed">
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
