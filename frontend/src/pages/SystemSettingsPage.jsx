import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { fetchSystemSettings, updateSystemSettings } from "../api/systemSettings";
import AllowedTypesInput from "../components/AllowedTypesInput";
import TopBar from "../components/layout/TopBar";
import Toast from "../components/common/Toast";
import { Settings2Icon, Save } from "lucide-react";

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
  const [mounted, setMounted] = useState(false);

  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);

  // Material Design 3 color system - light theme
  const lightColors = {
    primary: "#00684A", // Deep green (MD3 primary)
    onPrimary: "#FFFFFF",
    primaryContainer: "#94F4C6", // Light green container
    onPrimaryContainer: "#002015", // Dark green text on container
    secondary: "#4F616E",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#D2E4F2",
    onSecondaryContainer: "#0D1E2A",
    tertiary: "#7A5571",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#FFD8F1",
    onTertiaryContainer: "#2F1328",
    error: "#BA1A1A",
    onError: "#FFFFFF",
    errorContainer: "#FFDAD6",
    onErrorContainer: "#410002",
    background: "#FFFFFF",
    onBackground: "#111827",
    surface: "#FFFFFF",
    onSurface: "#111827",
    surfaceVariant: "#EEF2F7",
    onSurfaceVariant: "#414941",
    outline: "#717970",
    outlineVariant: "#C1C9C0",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#2E312E",
    inverseOnSurface: "#F0F2EC",
    inversePrimary: "#77D8B8",
    surfaceContainerLowest: "#FFFFFF",
    surfaceContainerLow: "#F8FAFB",
    surfaceContainer: "#F4F6F8",
    surfaceContainerHigh: "#EEF2F7",
    surfaceContainerHighest: "#EEF2F7",
  };

  // Material Design 3 color system - dark theme
  const darkColors = {
    primary: "#4ADE80", // Lighter green for dark mode
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

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => setMounted(false);
  }, []);

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
  const [toast, setToast] = useState(null);
  const lastSavedRef = useRef(null);

  // normalize toast types to match your Toast component
  const normalizeToastType = (type) => {
    if (!type) return "create";
    const tLower = String(type).toLowerCase();
    if (tLower === "success") return "create";
    if (tLower === "info") return "read";
    if (tLower === "warning") return "update";
    if (["create", "read", "update", "delete", "error"].includes(tLower)) return tLower;
    return "create";
  };

  const showToastLocal = (message, type = "create") => {
    const normalized = normalizeToastType(type);
    setToast({ id: Date.now(), message, type: normalized });
  };

  // use this to show a toast from this page
  const showToast = (message, type = "create") => {
    showToastLocal(message, type);
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
        showToast(text, "error");
        // keep defaults in UI so the page remains usable
        lastSavedRef.current = { ...defaults };
      } finally {
        setLoading(false);
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
      showToast(text, "info");
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
      showToast(savedText, "success");
      // keep UI state consistent
      setSettings((prev) => ({ ...prev, ...diffs }));
    } catch (err) {
      console.error("updateSystemSettings failed:", err);
      const errText = t("systemSettings.messages.failedSave") || "Failed to save settings";
      showToast(errText, "error");
    } finally {
      setSaving(false);
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

  // Button style helpers with MD3 styling
  const primaryBtn = "px-4 py-2.5 text-sm font-medium rounded-xl bg-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary),white_10%)] text-[var(--on-primary)] transition-all duration-200 shadow-md hover:shadow-lg";
  const ghostBtn = "px-4 py-2.5 text-sm font-medium rounded-xl border border-[var(--outline-variant)] dark:border-gray-600 bg-[var(--surface-container-low)] dark:bg-gray-800 text-[var(--on-surface)] dark:text-white hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 transition-all duration-200";
  const outlineBtn = "px-4 py-2.5 text-sm font-medium rounded-xl border border-[var(--outline-variant)] dark:border-gray-600 text-[var(--on-surface)] dark:text-white hover:bg-[color-mix(in_srgb,var(--surface),black_4%)] dark:hover:bg-gray-700 transition-all duration-200";

  return (
    <div 
      className={`min-h-screen font-sans transition-colors duration-300 bg-gray-50 dark:bg-gray-900 ${mounted ? 'opacity-100' : 'opacity-0'}`}
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
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fade-in-down {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in-down {
          animation: fade-in-down 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .surface-elevation-0 { 
          box-shadow: none;
        }
        .surface-elevation-1 { 
          box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04); 
          border: none;
        }
        .surface-elevation-2 { 
          box-shadow: 0 2px 6px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06); 
          border: none;
        }
        .surface-elevation-3 { 
          box-shadow: 0 4px 12px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08); 
          border: none;
        }
        .md3-container {
          border-radius: 28px;
          overflow: hidden;
        }
        .md3-card {
          border-radius: 20px;
          overflow: hidden;
        }
        .md3-input {
          border-radius: 16px;
          padding: 10px 16px;
          border: 1px solid var(--outline-variant);
          background: var(--surface-container-lowest);
          transition: all 0.2s ease;
        }
        .md3-input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 2px var(--primary-container);
        }
        .md3-button {
          border-radius: 20px;
          padding: 8px 16px;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        .md3-icon-container {
          border-radius: 16px;
          padding: 10px;
        }
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 52px;
          height: 32px;
          transition: all 0.2s ease;
        }
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--outline-variant);
          transition: all 0.2s ease;
          border-radius: 999px;
        }
        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 24px;
          width: 24px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          transition: all 0.2s ease;
          border-radius: 50%;
        }
        input:checked + .toggle-slider {
          background-color: var(--primary);
        }
        input:checked + .toggle-slider:before {
          transform: translateX(20px);
        }
        .setting-section {
          transition: all 0.2s ease;
        }
        .setting-section:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 6px rgba(0,0,0,0.06);
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header container with MD3 container styling */}
        <div className="mb-6 animate-fade-in-down">
          <div className="md3-container surface-elevation-3 overflow-hidden">
            <div className="bg-[var(--surface-container-low)] dark:bg-gray-800 px-5 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex min-w-0 gap-4 items-center">
                  <div className="md3-icon-container bg-[var(--primary-container)] dark:bg-indigo-900 surface-elevation-1">
                    <Settings2Icon className="h-6 w-6 text-green-800 dark:text-indigo-200 transition-transform duration-300 hover:scale-110" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-[var(--on-surface)] dark:text-white truncate">
                      {t("systemSettings.title")}
                    </h1>
                    <p className="mt-1 text-[var(--on-surface-variant)] dark:text-gray-400 max-w-2xl">
                      {t("systemSettings.subtitle")}
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

        {/* Main content container with MD3 card styling */}
        <div className="md3-card bg-[var(--surface-container-low)] dark:bg-gray-800 surface-elevation-3">
          <div className="p-4 sm:p-6 space-y-6">
            {/* Allowed attachment types */}
            <div className="setting-section bg-[var(--surface-container-lowest)] dark:bg-gray-800 rounded-2xl p-5 border border-[var(--outline-variant)] dark:border-gray-700 surface-elevation-1">
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 mb-1">
                  {t("systemSettings.allowedAttachmentTypes.label")}
                </label>
                <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                  {t("systemSettings.allowedAttachmentTypes.help")}
                </p>
              </div>
              <AllowedTypesInput
                value={allowedTypesArray}
                onChange={handleAllowedTypesChange}
              />

              <div className="mt-4 pt-4 border-t border-[var(--outline-variant)] dark:border-gray-700">
                <div className="text-xs font-medium text-[var(--on-surface-variant)] dark:text-gray-400 mb-2">
                  {t("systemSettings.current")}
                </div>
                <div className="text-xs bg-[var(--surface-container)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white p-3 rounded-xl break-all font-mono">
                  {JSON.stringify(lastSavedRef.current?.allowed_attachment_types ?? settings.allowed_attachment_types)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Audit retention days */}
              <div className="setting-section bg-[var(--surface-container-lowest)] dark:bg-gray-800 rounded-2xl p-5 border border-[var(--outline-variant)] dark:border-gray-700 surface-elevation-1">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 mb-1">
                    {t("systemSettings.auditRetention.label")}
                  </label>
                  <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                    {t("systemSettings.auditRetention.help")}
                  </p>
                </div>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  className="w-full md3-input text-base bg-[var(--surface-container-lowest)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white"
                  value={settings.audit_retention_days ?? ""}
                  onChange={(e) => handleChange("audit_retention_days", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder={t("systemSettings.auditRetention.placeholder")}
                />
                <div className="mt-4 pt-4 border-t border-[var(--outline-variant)] dark:border-gray-700">
                  <div className="text-xs font-medium text-[var(--on-surface-variant)] dark:text-gray-400 mb-2">
                    {t("systemSettings.current")}
                  </div>
                  <div className="text-xs bg-[var(--surface-container)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white p-3 rounded-xl font-mono">
                    {JSON.stringify(lastSavedRef.current?.audit_retention_days ?? settings.audit_retention_days)}
                  </div>
                </div>
              </div>

              {/* Max attachment size */}
              <div className="setting-section bg-[var(--surface-container-lowest)] dark:bg-gray-800 rounded-2xl p-5 border border-[var(--outline-variant)] dark:border-gray-700 surface-elevation-1">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 mb-1">
                    {t("systemSettings.maxAttachmentSize.label")}
                  </label>
                  <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                    {t("systemSettings.maxAttachmentSize.help")}
                  </p>
                </div>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  className="w-full md3-input text-base bg-[var(--surface-container-lowest)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white"
                  value={settings.max_attachment_size_mb ?? ""}
                  onChange={(e) => handleChange("max_attachment_size_mb", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder={t("systemSettings.maxAttachmentSize.placeholder")}
                />
                <div className="mt-4 pt-4 border-t border-[var(--outline-variant)] dark:border-gray-700">
                  <div className="text-xs font-medium text-[var(--on-surface-variant)] dark:text-gray-400 mb-2">
                    {t("systemSettings.current")}
                  </div>
                  <div className="text-xs bg-[var(--surface-container)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white p-3 rounded-xl font-mono">
                    {JSON.stringify(lastSavedRef.current?.max_attachment_size_mb ?? settings.max_attachment_size_mb)}
                  </div>
                </div>
              </div>
            </div>

            {/* Reporting */}
            <div className="setting-section bg-[var(--surface-container-lowest)] dark:bg-gray-800 rounded-2xl p-5 border border-[var(--outline-variant)] dark:border-gray-700 surface-elevation-1">
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 mb-1">
                  {t("systemSettings.reporting.label")}
                </label>
                <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                  {t("systemSettings.reporting.help")}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <label className="toggle-switch ">
                  <input
                    type="checkbox"
                    checked={!!settings.reporting_active}
                    onChange={(e) => handleChange("reporting_active", e.target.checked)}
                    className="bg-purple-500"
                  />
                  <span className="toggle-slider "></span>
                </label>
                <span className="text-lg font-medium text-[var(--on-surface)] dark:text-white">
                  {settings.reporting_active ? t("systemSettings.enabled") : t("systemSettings.disabled")}
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--outline-variant)] dark:border-gray-700">
                <div className="text-xs font-medium text-[var(--on-surface-variant)] dark:text-gray-400 mb-2">
                  {t("systemSettings.current")}
                </div>
                <div className="text-xs bg-[var(--surface-container)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white p-3 rounded-xl font-mono">
                  {JSON.stringify(lastSavedRef.current?.reporting_active ?? settings.reporting_active)}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 border-t border-[var(--outline-variant)] dark:border-gray-700 bg-[var(--surface-container-low)] dark:bg-gray-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-[var(--on-surface-variant)] dark:text-gray-400 max-w-md">
                {t("systemSettings.description")}
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                aria-label={t("systemSettings.saveButtonAria")}
                className={`${primaryBtn} dark:bg-indigo-800 w-full sm:w-auto flex items-center justify-center gap-2`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-transparent border-t-[var(--on-primary)]"></div>
                    <span>{t("systemSettings.saving") || "Saving..."}</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 text-[var(--on-primary)]" />
                    <span>{t("systemSettings.saveButton") || "Save settings"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast render (single toast) */}
      {toast && (
        <div className="fixed z-50 right-4 bottom-4 animate-fade-in">
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
}