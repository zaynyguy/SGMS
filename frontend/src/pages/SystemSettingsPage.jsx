  // src/pages/SystemSettingsPage.jsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
  import { fetchSystemSettings, updateSystemSettings } from "../api/systemSettings";
  import AllowedTypesInput from "../components/AllowedTypesInput";

  /**
   * Helpers
   */
  function parseMaybeJson(v) {
    if (v === null || v === undefined) return v;
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }

  function shapeSettingsFromApi(data) {
    // Accepts array of { key, value, description } or already keyed object
    if (!data) return { obj: {}, desc: {} };

    if (Array.isArray(data)) {
      const obj = {};
      const desc = {};
      data.forEach((r) => {
        obj[r.key] = parseMaybeJson(r.value);
        if (r.description) desc[r.key] = r.description;
      });
      return { obj, desc };
    }

    if (typeof data === "object") {
      // ensure values parsed if strings
      const obj = {};
      Object.entries(data).forEach(([k, v]) => {
        obj[k] = parseMaybeJson(v);
      });
      return { obj, desc: {} };
    }

    return { obj: {}, desc: {} };
  }

  // shallow diff to only send changed keys
  function diffObjects(oldObj = {}, newObj = {}) {
    const diffs = {};
    const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    for (const k of keys) {
      const a = oldObj[k];
      const b = newObj[k];

      // For arrays, compare JSON stringified
      const equal =
        Array.isArray(a) && Array.isArray(b)
          ? JSON.stringify(a) === JSON.stringify(b)
          : a === b;

      if (!equal) {
        // If user cleared field and left empty string "", convert to null to avoid sending empty string
        if (b === "") {
          diffs[k] = null;
        } else {
          diffs[k] = b;
        }
      }
    }
    return diffs;
  }

  /**
   * Component
   */
  export default function SystemSettingsPage() {
    const defaults = {
      allowed_attachment_types: ["application/pdf", "image/png", "image/jpeg", "text/plain"],
      audit_retention_days: 0,
      max_attachment_size_mb: 0,
      reporting_active: false,
      resubmission_deadline_days: 0,
    };

    const [settings, setSettings] = useState({ ...defaults });
    const [descriptions, setDescriptions] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const lastSavedRef = useRef(null); // keep the last successfully fetched/saved settings for diffing

    useEffect(() => {
      // load settings and convert shape
      async function loadSettings() {
        setLoading(true);
        try {
          const data = await fetchSystemSettings(); // uses your existing api helper
          const { obj, desc } = shapeSettingsFromApi(data);
          // Merge DB object with defaults so controlled inputs always have a value
          const merged = { ...defaults, ...obj };
          setSettings(merged);
          setDescriptions(desc || {});
          lastSavedRef.current = merged;
        } catch (err) {
          console.error("fetchSystemSettings failed:", err);
          setMessage("Failed to load settings from server.");
          // keep defaults in UI so the page remains usable
          lastSavedRef.current = { ...defaults };
        } finally {
          setLoading(false);
          // clear message after a while
          setTimeout(() => setMessage(""), 4000);
        }
      }
      loadSettings();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (key, value) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    };
    const handleAllowedTypesChange = useCallback(
      (arr) => {
        // avoid unnecessary state updates by checking shallow equality
        const prev = lastSavedRef.current ? lastSavedRef.current.allowed_attachment_types : undefined;
        const cur = Array.isArray(arr) ? arr : [];
        if (Array.isArray(prev) && JSON.stringify(prev) === JSON.stringify(cur)) return;
        setSettings((s) => ({ ...s, allowed_attachment_types: cur }));
      },
      [setSettings]
    );

    const handleSave = async () => {
      if (saving) return;
      const original = lastSavedRef.current || {};
      const diffs = diffObjects(original, settings);
      if (Object.keys(diffs).length === 0) {
        setMessage("No changes to save.");
        setTimeout(() => setMessage(""), 2500);
        return;
      }



      // Normalize common fields before sending
      if (typeof diffs.allowed_attachment_types === "string") {
        diffs.allowed_attachment_types = diffs.allowed_attachment_types
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      // save
      setSaving(true);
      try {
        await updateSystemSettings(diffs); // your existing API helper
        // update lastSavedRef and UI to reflect saved data
        const newSaved = { ...original, ...diffs };
        lastSavedRef.current = newSaved;
        setMessage("Settings saved successfully.");
        // keep UI state consistent
        setSettings((prev) => ({ ...prev, ...diffs }));
      } catch (err) {
        console.error("updateSystemSettings failed:", err);
        setMessage("Failed to save settings. Try again.");
      } finally {
        setSaving(false);
        setTimeout(() => setMessage(""), 4000);
      }
    };

    const allowedTypesArray = useMemo(() => {
    if (Array.isArray(settings.allowed_attachment_types)) {
      return settings.allowed_attachment_types;
    }
    if (typeof settings.allowed_attachment_types === "string") {
      return settings.allowed_attachment_types
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, [settings.allowed_attachment_types]);

    if (loading) {
      return (
        <div className="flex justify-center items-center h-screen bg-gray-200 dark:bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-200 dark:bg-gray-900 py-4 md:py-8 transition-colors duration-200">
        <div className="max-w-6xl mx-auto px-3 sm:px-4">
          <div className="flex justify-between items-center mb-6 px-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">System Settings</h1>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6 transition-colors duration-200">
            <div className="space-y-5">
              {/* Allowed attachment types */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Allowed Attachment Types</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Enter MIME types separated by commas (e.g., application/pdf, image/png)</p>
                <AllowedTypesInput
                  value={allowedTypesArray}
                  onChange={handleAllowedTypesChange}
                  placeholder="application/pdf, image/png or .pdf, .png"
                />


                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <div>Current: <code className="text-xs">{JSON.stringify(lastSavedRef.current?.allowed_attachment_types ?? settings.allowed_attachment_types)}</code></div>
                  {descriptions.allowed_attachment_types && <div className="mt-1 italic">{descriptions.allowed_attachment_types}</div>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Audit retention days */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Audit Retention Days</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">How long to keep audit logs (in days)</p>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                    value={settings.audit_retention_days ?? ""}
                    onChange={(e) => handleChange("audit_retention_days", e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Enter number of days"
                  />
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Current: <code>{JSON.stringify(lastSavedRef.current?.audit_retention_days ?? settings.audit_retention_days)}</code></div>
                  {descriptions.audit_retention_days && <div className="mt-1 italic text-xs">{descriptions.audit_retention_days}</div>}
                </div>

                {/* Max attachment size */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Max Attachment Size (MB)</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Maximum file size allowed for uploads</p>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                    value={settings.max_attachment_size_mb ?? ""}
                    onChange={(e) => handleChange("max_attachment_size_mb", e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Enter size in MB"
                  />
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Current: <code>{JSON.stringify(lastSavedRef.current?.max_attachment_size_mb ?? settings.max_attachment_size_mb)}</code></div>
                  {descriptions.max_attachment_size_mb && <div className="mt-1 italic text-xs">{descriptions.max_attachment_size_mb}</div>}
                </div>
              </div>

              {/* Reporting */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
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
                    <label htmlFor="reporting-toggle" className={`block h-6 w-12 rounded-full cursor-pointer ${settings.reporting_active ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"} transition-colors duration-200`}>
                      <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${settings.reporting_active ? "transform translate-x-6" : ""}`} />
                    </label>
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">{settings.reporting_active ? "Enabled" : "Disabled"}</span>
                </div>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Current: <code>{JSON.stringify(lastSavedRef.current?.reporting_active ?? settings.reporting_active)}</code></div>
                {descriptions.reporting_active && <div className="mt-1 italic text-xs">{descriptions.reporting_active}</div>}
              </div>

              {/* Resubmission deadline */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Resubmission Deadline (days)</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Number of days allowed for resubmission</p>
                <input
                  type="number"
                  min="0"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                  value={settings.resubmission_deadline_days ?? ""}
                  onChange={(e) => handleChange("resubmission_deadline_days", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Enter number of days"
                />
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Current: <code>{JSON.stringify(lastSavedRef.current?.resubmission_deadline_days ?? settings.resubmission_deadline_days)}</code></div>
                {descriptions.resubmission_deadline_days && <div className="mt-1 italic text-xs">{descriptions.resubmission_deadline_days}</div>}
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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
