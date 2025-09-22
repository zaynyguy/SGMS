// src/pages/SystemSettingsPage.jsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { fetchSystemSettings, updateSystemSettings } from "../api/systemSettings";
import AllowedTypesInput from "../components/AllowedTypesInput";
import TopBar from "../components/layout/TopBar";
import {Settings2Icon} from "lucide-react"

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
  const { t } = useTranslation();

  const defaults = {
    allowed_attachment_types: ["application/pdf", "image/png", "image/jpeg", "text/plain"],
    audit_retention_days: 0,
    max_attachment_size_mb: 0,
    reporting_active: false,
  };

  const [settings, setSettings] = useState({ ...defaults });
  const [descriptions, setDescriptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // message: { text, type } where type is 'success'|'error'|'info'
  const [message, setMessage] = useState({ text: "", type: "" });
  const lastSavedRef = useRef(null);

  useEffect(() => {
    // load settings and convert shape
    async function loadSettings() {
      setLoading(true);
      try {
        const data = await fetchSystemSettings();
        const { obj, desc } = shapeSettingsFromApi(data);
        // Merge DB object with defaults so controlled inputs always have a value
        const merged = { ...defaults, ...obj };
        setSettings(merged);
        setDescriptions(desc || {});
        lastSavedRef.current = merged;
      } catch (err) {
        console.error("fetchSystemSettings failed:", err);
        setMessage({ text: t("systemSettings.messages.failedLoad") || "Failed to load system settings", type: "error" });
        // keep defaults in UI so the page remains usable
        lastSavedRef.current = { ...defaults };
      } finally {
        setLoading(false);
        // clear message after a while
        setTimeout(() => setMessage({ text: "", type: "" }), 4000);
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
      setMessage({ text: t("systemSettings.messages.noChanges") || "No changes to save", type: "info" });
      setTimeout(() => setMessage({ text: "", type: "" }), 2500);
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
      await updateSystemSettings(diffs);
      // update lastSavedRef and UI to reflect saved data
      const newSaved = { ...original, ...diffs };
      lastSavedRef.current = newSaved;
      setMessage({ text: t("systemSettings.messages.saved") || "Settings saved", type: "success" });
      // keep UI state consistent
      setSettings((prev) => ({ ...prev, ...diffs }));
    } catch (err) {
      console.error("updateSystemSettings failed:", err);
      setMessage({ text: t("systemSettings.messages.failedSave") || "Failed to save settings", type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ text: "", type: "" }), 4000);
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
      <div className="flex justify-center items-center h-screen bg-gray-200 dark:bg-gray-900 transition-colors duration-200">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" />
      </div>
    );
  }

  // message color helpers
  const messageBgClass = message.type === "error"
    ? "bg-red-100 dark:bg-red-900/30"
    : message.type === "info"
      ? "bg-blue-100 dark:bg-blue-900/30"
      : "bg-green-100 dark:bg-green-900/30";
  const messageTextClass = message.type === "error"
    ? "text-red-700 dark:text-red-400"
    : message.type === "info"
      ? "text-blue-700 dark:text-blue-400"
      : "text-green-700 dark:text-green-400";

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 py-4 px-3 transition-colors duration-200">
      <div className="max-w-8xl mx-auto">
        {/* Header: title (single line) + TopBar */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex min-w-0 gap-4 items-center">
            <div className="p-3 rounded-lg bg-white dark:bg-gray-800">
                        <Settings2Icon className="h-6 w-6 text-sky-600 dark:text-sky-300" />
                      </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white truncate">{t("systemSettings.title")}</h1>
            <p className="mt-1 text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-2xl">
                {t("systemSettings.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 w-auto">
            <TopBar />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 transition-colors duration-200">
          <div className="space-y-5">
            {/* Allowed attachment types */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4 transition-colors duration-200">
              <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">{t("systemSettings.allowedAttachmentTypes.label")}</label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t("systemSettings.allowedAttachmentTypes.help")}</p>
              <AllowedTypesInput
                value={allowedTypesArray}
                onChange={handleAllowedTypesChange}
                placeholder={t("systemSettings.allowedAttachmentTypes.placeholder")}
              />

              <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                <div className="mb-1">{t("systemSettings.current")}</div>
                <code className="text-xs break-all bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded-md block overflow-x-auto">
                  {JSON.stringify(lastSavedRef.current?.allowed_attachment_types ?? settings.allowed_attachment_types)}
                </code>
                {descriptions.allowed_attachment_types && (
                  <div className="mt-2 italic text-sm">{descriptions.allowed_attachment_types}</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Audit retention days */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4 transition-colors duration-200">
                <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t("systemSettings.auditRetention.label")}
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  {t("systemSettings.auditRetention.help")}
                </p>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  className="w-full text-base border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  value={settings.audit_retention_days ?? ""}
                  onChange={(e) => handleChange("audit_retention_days", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder={t("systemSettings.auditRetention.placeholder")}
                />
                <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  <div className="mb-1">{t("systemSettings.current")}</div>
                  <code className="text-xs bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded-md">
                    {JSON.stringify(lastSavedRef.current?.audit_retention_days ?? settings.audit_retention_days)}
                  </code>
                </div>
                {descriptions.audit_retention_days && (
                  <div className="mt-2 italic text-sm">{descriptions.audit_retention_days}</div>
                )}
              </div>

              {/* Max attachment size */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4 transition-colors duration-200">
                <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t("systemSettings.maxAttachmentSize.label")}
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  {t("systemSettings.maxAttachmentSize.help")}
                </p>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  className="w-full text-base border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  value={settings.max_attachment_size_mb ?? ""}
                  onChange={(e) => handleChange("max_attachment_size_mb", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder={t("systemSettings.maxAttachmentSize.placeholder")}
                />
                <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  <div className="mb-1">{t("systemSettings.current")}</div>
                  <code className="text-xs bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded-md">
                    {JSON.stringify(lastSavedRef.current?.max_attachment_size_mb ?? settings.max_attachment_size_mb)}
                  </code>
                </div>
                {descriptions.max_attachment_size_mb && (
                  <div className="mt-2 italic text-sm">{descriptions.max_attachment_size_mb}</div>
                )}
              </div>
            </div>

            {/* Reporting */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4 transition-colors duration-200">
              <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("systemSettings.reporting.label")}
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {t("systemSettings.reporting.help")}
              </p>
              <div className="flex items-center">
                <div className="relative inline-block w-14 h-7 mr-3 align-middle select-none">
                  <input
                    type="checkbox"
                    id="reporting-toggle"
                    checked={!!settings.reporting_active}
                    onChange={(e) => handleChange("reporting_active", e.target.checked)}
                    className="sr-only"
                  />
                  <label 
                    htmlFor="reporting-toggle" 
                    className={`block overflow-hidden h-7 rounded-full cursor-pointer transition-colors duration-200 ${settings.reporting_active ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"}`}
                  >
                    <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full transition-transform duration-200 ${settings.reporting_active ? "transform translate-x-7" : ""}`} />
                  </label>
                </div>
                <span className="text-gray-700 dark:text-gray-300 text-base">
                  {settings.reporting_active ? t("systemSettings.enabled") : t("systemSettings.disabled")}
                </span>
              </div>
              <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                <div className="mb-1">{t("systemSettings.current")}</div>
                <code className="text-xs bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded-md">
                  {JSON.stringify(lastSavedRef.current?.reporting_active ?? settings.reporting_active)}
                </code>
              </div>
              {descriptions.reporting_active && (
                <div className="mt-2 italic text-sm">{descriptions.reporting_active}</div>
              )}
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              aria-label={t("systemSettings.saveButtonAria")}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center disabled:opacity-50 transition-colors duration-200 text-base"
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t("systemSettings.saving") || "Saving..."}
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {t("systemSettings.saveButton") || "Save settings"}
                </>
              )}
            </button>

            {message.text && (
              <div className={`w-full sm:w-auto px-4 py-3 rounded-lg text-center ${messageBgClass} ${messageTextClass} transition-colors duration-200 text-sm`}>
                {message.text}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
          <p>{t("systemSettings.description")}</p>
        </div>
      </div>
    </div>
  );
}