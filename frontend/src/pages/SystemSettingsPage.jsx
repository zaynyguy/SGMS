// src/pages/SystemSettingsPage.jsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { fetchSystemSettings, updateSystemSettings } from "../api/systemSettings";
import AllowedTypesInput from "../components/AllowedTypesInput";
import TopBar from "../components/layout/TopBar";
import Toast from "../components/common/Toast"; // <-- adjust path if needed
import { Settings2Icon } from "lucide-react";

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

  // Toast state (single toast at a time)
  const [toast, setToast] = useState(null);

  // normalize message types to your Toast component types
  const normalizeToastType = (type) => {
    if (!type) return "create";
    const tLower = String(type).toLowerCase();
    if (tLower === "success") return "create";
    if (tLower === "info") return "read";
    if (tLower === "error") return "error";
    if (["create", "read", "update", "delete"].includes(tLower)) return tLower;
    return "create";
  };

  const showToastLocal = (messageText, type = "create") => {
    const normalized = normalizeToastType(type);
    setToast({ id: Date.now(), message: messageText, type: normalized });
  };

  // use this to show a toast from this page
  const showToast = (messageText, type = "create") => {
    showToastLocal(messageText, type);
  };

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
        const text = t("systemSettings.messages.failedLoad") || "Failed to load system settings";
        setMessage({ text, type: "error" });
        showToast(text, "error");
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
      const text = t("systemSettings.messages.noChanges") || "No changes to save";
      setMessage({ text, type: "info" });
      showToast(text, "info");
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
      const savedText = t("systemSettings.messages.saved") || "Settings saved";
      setMessage({ text: savedText, type: "success" });
      showToast(savedText, "success");
      // keep UI state consistent
      setSettings((prev) => ({ ...prev, ...diffs }));
    } catch (err) {
      console.error("updateSystemSettings failed:", err);
      const errText = t("systemSettings.messages.failedSave") || "Failed to save settings";
      setMessage({ text: errText, type: "error" });
      showToast(errText, "error");
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
      <div className="flex justify-center items-center h-screen bg-gray-200 dark:bg-gray-900 transition-all duration-500">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 dark:border-blue-400 transition-colors duration-300" />
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
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 py-3 px-3 transition-all duration-500 ease-in-out text-xs">
      <div className="max-w-8xl mx-auto animate-fade-in-up">
        {/* Header card: title (single line) + TopBar */}
        <div className="mb-6">
          <div className="rounded-2xl bg-white dark:bg-gray-800 backdrop-blur-xs border border-gray-200/60 dark:border-gray-700/40 shadow-sm px-4 py-3 transition-all duration-300 animate-fade-in-down">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 gap-3 items-center">
                <div className="p-2 rounded-lg bg-gray-200 dark:bg-gray-900 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-105">
                  <Settings2Icon className="h-5 w-5 text-sky-600 dark:text-sky-300 transition-colors duration-300" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white truncate transition-colors duration-300">
                    {t("systemSettings.title")}
                  </h1>
                  <p className="mt-0.5 text-xs sm:text-xs text-gray-600 dark:text-gray-300 max-w-2xl transition-colors duration-300 truncate">
                    {t("systemSettings.subtitle")}
                  </p>
                </div>
              </div>

              <div className="flex-shrink-0">
                <TopBar />
              </div>
            </div>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-5 transition-all duration-300 ease-in-out transform hover:shadow-lg">
          <div className="space-y-4">
            {/* Allowed attachment types */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-3 transition-all duration-300 ease-in-out transform hover:scale-[1.009] hover:shadow-sm">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-300">
                {t("systemSettings.allowedAttachmentTypes.label")}
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 transition-colors duration-300">
                {t("systemSettings.allowedAttachmentTypes.help")}
              </p>
              <AllowedTypesInput
                value={allowedTypesArray}
                onChange={handleAllowedTypesChange}
              />

              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">
                <div className="mb-1 text-[10px]">{t("systemSettings.current")}</div>
                <code className="text-[10px] break-all bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded-md block transition-all duration-300 hover:bg-gray-200 dark:hover:bg-gray-500">
                  {JSON.stringify(lastSavedRef.current?.allowed_attachment_types ?? settings.allowed_attachment_types)}
                </code>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Audit retention days */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-3 transition-all duration-300 ease-in-out transform hover:scale-[1.009] hover:shadow-sm">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-300">
                  {t("systemSettings.auditRetention.label")}
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 transition-colors duration-300">
                  {t("systemSettings.auditRetention.help")}
                </p>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 ease-in-out transform hover:border-blue-400 dark:hover:border-blue-400"
                  value={settings.audit_retention_days ?? ""}
                  onChange={(e) => handleChange("audit_retention_days", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder={t("systemSettings.auditRetention.placeholder")}
                />
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">
                  <div className="mb-1 text-[10px]">{t("systemSettings.current")}</div>
                  <code className="text-[10px] bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded-md transition-all duration-300 hover:bg-gray-200 dark:hover:bg-gray-500">
                    {JSON.stringify(lastSavedRef.current?.audit_retention_days ?? settings.audit_retention_days)}
                  </code>
                </div>
              </div>

              {/* Max attachment size */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-3 transition-all duration-300 ease-in-out transform hover:scale-[1.009] hover:shadow-sm">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-300">
                  {t("systemSettings.maxAttachmentSize.label")}
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 transition-colors duration-300">
                  {t("systemSettings.maxAttachmentSize.help")}
                </p>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 ease-in-out transform hover:border-blue-400 dark:hover:border-blue-400"
                  value={settings.max_attachment_size_mb ?? ""}
                  onChange={(e) => handleChange("max_attachment_size_mb", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder={t("systemSettings.maxAttachmentSize.placeholder")}
                />
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">
                  <div className="mb-1 text-[10px]">{t("systemSettings.current")}</div>
                  <code className="text-[10px] bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded-md transition-all duration-300 hover:bg-gray-200 dark:hover:bg-gray-500">
                    {JSON.stringify(lastSavedRef.current?.max_attachment_size_mb ?? settings.max_attachment_size_mb)}
                  </code>
                </div>
              </div>
            </div>

            {/* Reporting */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-3 transition-all duration-300 ease-in-out transform hover:scale-[1.009] hover:shadow-sm">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-300">
                {t("systemSettings.reporting.label")}
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 transition-colors duration-300">
                {t("systemSettings.reporting.help")}
              </p>
              <div className="flex items-center">
                <div className="relative inline-block w-12 h-6 mr-3 align-middle select-none transition-transform duration-300 hover:scale-110">
                  <input
                    type="checkbox"
                    id="reporting-toggle"
                    checked={!!settings.reporting_active}
                    onChange={(e) => handleChange("reporting_active", e.target.checked)}
                    className="sr-only"
                  />
                  <label
                    htmlFor="reporting-toggle"
                    className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-all duration-500 ease-in-out ${settings.reporting_active ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"} hover:shadow-md`}
                  >
                    <span className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full transition-all duration-500 ease-in-out ${settings.reporting_active ? "transform translate-x-6 bg-blue-100" : ""} hover:shadow-sm`} />
                  </label>
                </div>
                <span className="text-gray-700 dark:text-gray-300 text-xs transition-colors duration-300">
                  {settings.reporting_active ? t("systemSettings.enabled") : t("systemSettings.disabled")}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">
                <div className="mb-1 text-[10px]">{t("systemSettings.current")}</div>
                <code className="text-[10px] bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded-md transition-all duration-300 hover:bg-gray-200 dark:hover:bg-gray-500">
                  {JSON.stringify(lastSavedRef.current?.reporting_active ?? settings.reporting_active)}
                </code>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 transition-all duration-300">
            <button
              onClick={handleSave}
              disabled={saving}
              aria-label={t("systemSettings.saveButtonAria")}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-md font-medium flex items-center justify-center disabled:opacity-50 transition-all duration-500 ease-in-out transform hover:scale-105 active:scale-95 text-xs"
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white transition-transform duration-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-xs">{t("systemSettings.saving") || "Saving..."}</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs">{t("systemSettings.saveButton") || "Save settings"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex justify-center mt-4 text-center text-xs text-gray-500 dark:text-gray-400 transition-all duration-500 animate-fade-in">
          <p>{t("systemSettings.description")}</p>
        </div>
      </div>

      {/* Toast render (single toast) */}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out;
        }
        .animate-fade-in {
          animation: fade-in 1.2s ease-out;
        }
      `}</style>
    </div>
  );
}
