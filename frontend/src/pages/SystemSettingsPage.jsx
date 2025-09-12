import React, { useState, useEffect } from "react";
import { fetchSystemSettings, updateSystemSettings } from "../api/systemSettings";

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState({
    allowed_attachment_types: ["application/pdf", "image/png", "image/jpeg", "text/plain"],
    audit_retention_days: 0,
    max_attachment_size_mb: 0,
    reporting_active: false,
    resubmission_deadline_days: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check user's system preference for dark mode
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
    
    async function loadSettings() {
      try {
        const data = await fetchSystemSettings();
        setSettings(data);
      } catch (err) {
        setMessage("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSystemSettings(settings);
      setMessage("Settings updated successfully!");
    } catch (err) {
      setMessage("Failed to update settings");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 4000);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-screen bg-gray-200 dark:bg-gray-900">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400"></div>
    </div>
  );
  
  if (!settings) return (
    <div className="flex justify-center items-center h-screen bg-gray-200 dark:bg-gray-900">
      <p className="text-red-500 dark:text-red-400">No settings found</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 py-4 md:py-8 transition-colors duration-200">
      <div className="max-w-8xl mx-auto px-3 sm:px-4">
        {/* Header with theme toggle */}
        <div className="flex justify-between items-center mb-6 px-2">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">System Settings</h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6 transition-colors duration-200">
          <div className="space-y-5">
            {/* Allowed attachment types */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors duration-200">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Allowed Attachment Types</label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Enter MIME types separated by commas (e.g., application/pdf, image/png)</p>
              <textarea
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 bg-white dark:bg-gray-600 text-gray-900 dark:text-white transition-colors duration-200"
                value={(settings.allowed_attachment_types || []).join(", ")}
                onChange={(e) =>
                  handleChange(
                    "allowed_attachment_types",
                    e.target.value.split(",").map((v) => v.trim())
                  )
                }
                placeholder="application/pdf, image/png, image/jpeg"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Audit retention days */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors duration-200">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Audit Retention Days</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">How long to keep audit logs (in days)</p>
                <input
                  type="number"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 bg-white dark:bg-gray-600 text-gray-900 dark:text-white transition-colors duration-200"
                  value={settings.audit_retention_days ?? ""}
                  onChange={(e) => handleChange("audit_retention_days", Number(e.target.value))}
                  placeholder="Enter number of days"
                  min="0"
                />
              </div>

              {/* Max attachment size */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors duration-200">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Max Attachment Size (MB)</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Maximum file size allowed for uploads</p>
                <input
                  type="number"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 bg-white dark:bg-gray-600 text-gray-900 dark:text-white transition-colors duration-200"
                  value={settings.max_attachment_size_mb ?? ""}
                  onChange={(e) => handleChange("max_attachment_size_mb", Number(e.target.value))}
                  placeholder="Enter size in MB"
                  min="0"
                />
              </div>
            </div>

            {/* Reporting active */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors duration-200">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reporting</label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Enable or disable system reporting</p>
              <div className="flex items-center">
                <div className="relative inline-block w-12 mr-2 align-middle select-none">
                  <input 
                    type="checkbox" 
                    id="reporting-toggle"
                    checked={!!settings.reporting_active}
                    onChange={(e) => handleChange("reporting_active", e.target.checked)}
                    className="sr-only"
                  />
                  <label 
                    htmlFor="reporting-toggle"
                    className={`block h-6 w-12 rounded-full cursor-pointer ${settings.reporting_active ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'} transition-colors duration-200`}
                  >
                    <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${settings.reporting_active ? 'transform translate-x-6' : ''}`}></span>
                  </label>
                </div>
                <span className="text-gray-700 dark:text-gray-300">{settings.reporting_active ? "Enabled" : "Disabled"}</span>
              </div>
            </div>

            {/* Resubmission deadline */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors duration-200">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Resubmission Deadline (days)</label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Number of days allowed for resubmission</p>
              <input
                type="number"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 bg-white dark:bg-gray-600 text-gray-900 dark:text-white transition-colors duration-200"
                value={settings.resubmission_deadline_days}
                onChange={(e) => handleChange("resubmission_deadline_days", Number(e.target.value))}
                placeholder="Enter number of days"
                min="0"
              />
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center transition-colors duration-200 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Save Settings
                </>
              )}
            </button>
            
            {message && (
              <div className={`w-full sm:w-auto px-4 py-2 rounded-lg text-center ${message.includes("Failed") ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"}`}>
                {message}
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Configure system-wide settings and preferences</p>
        </div>
      </div>
    </div>
  );
}