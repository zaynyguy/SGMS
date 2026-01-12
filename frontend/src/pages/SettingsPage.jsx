import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import {
  Upload,
  X,
  User,
  Save,
  Shield,
  Palette,
  UserCircle,
  Settings,
} from "lucide-react";
import LanguageSwitcher from "../components/common/LanguageSwitcher";
import Toast from "../components/common/Toast";
import { api } from "../api/auth";
import TopBar from "../components/layout/TopBar";
import { useTheme } from "../context/ThemeContext";
import AuthenticatedImage from "../components/common/AuthenticatedImage";
import LoadingSpinner from "../components/ui/LoadingSpinner";

/* ---------- Helpers (unchanged) ---------- */
const formatBytes = (n) => {
  if (!n) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  let i = 0;
  let num = n;
  while (num >= 1024 && i < sizes.length - 1) {
    num /= 1024;
    i += 1;
  }
  return `${Math.round(num * 10) / 10} ${sizes[i]}`;
};

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
  for (let i = 0; i < (s || "").length; i += 1)
    hash = (hash << 5) - hash + s.charCodeAt(i);
  const a = Math.abs(hash);
  const h1 = a % 360;
  const h2 = (180 + h1) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 60%), hsl(${h2} 70% 40%))`;
};
/* ------------------------------------- */

const SettingsPage = () => {
  const { t } = useTranslation();
  const { updateUser } = useAuth();
  const { dark } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Dark mode state
  const [darkMode, setDarkMode] = useState(dark);

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

  const [settings, setSettings] = useState({
    username: "",
    name: "",
    language: "en",
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

  const previewObjectUrlRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api("/api/settings", "GET");
        if (data) {
          const sanitized = { ...data };
          if (Object.prototype.hasOwnProperty.call(sanitized, "darkMode"))
            delete sanitized.darkMode;
          setSettings((prev) => ({ ...prev, ...sanitized }));
        }
      } catch (err) {
        console.error("Failed to load settings", err);
        setToast({
          message: t("settings.errors.loadError") || "Failed to load settings",
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (message, type = "create") => setToast({ message, type });
  const handleToastClose = () => setToast(null);

  const handleProfilePictureChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast(
        t("settings.errors.invalidImage") || "Invalid image file",
        "error"
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(
        t("settings.errors.imageTooLarge") ||
          `Image too large (max ${formatBytes(5 * 1024 * 1024)})`,
        "error"
      );
      return;
    }
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    const url = URL.createObjectURL(file);
    previewObjectUrlRef.current = url;
    setProfilePicturePreview(url);
    setProfilePictureFile(file);
  };

  const removeProfilePicturePreview = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setProfilePictureFile(null);
    setProfilePicturePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadProfilePicture = async () => {
    if (!profilePictureFile) return;
    setUploadingPicture(true);
    try {
      const fd = new FormData();
      fd.append("profilePicture", profilePictureFile);

      // Use shared `api` helper so refresh tokens and auth logic run automatically
      const data = await api("/api/settings/profile-picture", "PUT", fd, {
        isFormData: true,
      });

      let returnedUser = data.user || {};
      if (!returnedUser || typeof returnedUser !== "object") returnedUser = {};

      let stored = {};
      try {
        stored = JSON.parse(localStorage.getItem("user") || "{}") || {};
      } catch (e) {
        stored = {};
      }

      const merged = {
        ...stored,
        ...returnedUser,
        profilePicture:
          data.profilePicture ||
          returnedUser.profilePicture ||
          stored.profilePicture ||
          "",
      };

      if (Object.prototype.hasOwnProperty.call(merged, "darkMode"))
        delete merged.darkMode;

      updateUser(merged, data.token || undefined);

      setSettings((s) => ({ ...s, profilePicture: merged.profilePicture }));
      removeProfilePicturePreview();
      showToast(
        t("settings.toasts.pictureSuccess") || "Profile picture updated",
        "update"
      );
    } catch (err) {
      console.error("uploadProfilePicture error:", err);
      showToast(err.message || "Upload failed", "error");
    } finally {
      setUploadingPicture(false);
    }
  };

  const validatePassword = () => {
    let isValid = true;
    if (newPassword && !oldPassword) {
      setOldPasswordError(
        t("settings.errors.oldPasswordRequired") || "Old password required"
      );
      isValid = false;
    } else setOldPasswordError("");
    if (newPassword && newPassword.length < 8) {
      setPasswordError(
        t("settings.errors.passwordTooShort") || "Password too short"
      );
      isValid = false;
    } else setPasswordError("");
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validatePassword()) return;

    setSaving(true);
    try {
      const payload = {
        name: settings.name,
        language: settings.language,
        oldPassword: oldPassword || undefined,
        newPassword: newPassword || undefined,
      };

      const data = await api("/api/settings", "PUT", payload);

      if (data?.user) {
        const returnedUser = data.user || {};
        let stored = {};
        try {
          stored = JSON.parse(localStorage.getItem("user") || "{}") || {};
        } catch {
          stored = {};
        }

        const merged = { ...stored, ...returnedUser };
        if (Object.prototype.hasOwnProperty.call(merged, "darkMode"))
          delete merged.darkMode;

        updateUser(merged, data.token || undefined);
      }

      setSettings((s) => ({
        ...s,
        name: settings.name,
        language: settings.language,
      }));
      showToast(
        t("settings.toasts.updateSuccess") || "Settings updated",
        "update"
      );
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      console.error("update settings error:", err);
      showToast(err.message || "Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  // Button style helpers with MD3 styling
  const primaryBtn =
    "px-4 py-2.5 text-sm font-medium rounded-xl bg-green-700 hover:bg-[color-mix(in_srgb,var(--primary),white_10%)] text-white transition-all duration-200 shadow-md hover:shadow-lg";
  const ghostBtn =
    "px-4 py-2.5 text-sm font-medium rounded-xl border border-[var(--outline-variant)] dark:border-gray-600 bg-[var(--surface-container-low)] dark:bg-gray-800 text-[var(--on-surface)] dark:text-white hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 transition-all duration-200";
  const outlineBtn =
    "px-4 py-2.5 text-sm font-medium rounded-xl border border-[var(--outline-variant)] dark:border-gray-600 text-[var(--on-surface)] dark:text-white hover:bg-[color-mix(in_srgb,var(--surface),black_4%)] dark:hover:bg-gray-700 transition-all duration-200";
  const errorBtn =
    "px-4 py-2.5 text-sm font-medium rounded-xl bg-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error),white_10%)] text-[var(--on-error)] transition-all duration-200 shadow-md hover:shadow-lg";

  // Input style helpers
  const inputClass =
    "w-full md3-input text-[var(--on-surface)] dark:text-white placeholder-[var(--on-surface-variant)] dark:placeholder-gray-400";
  const labelClass =
    "block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1";

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-300 bg-gray-50 dark:bg-gray-900 ${
          mounted ? "opacity-100 animate-fade-in" : "opacity-0"
        }`}
        style={{
          "--background": m3Colors.background,
          "--on-background": m3Colors.onBackground,
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
          .animate-fade-in {
            animation: fade-in 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>
        <div className="flex flex-col items-center">
          <div className="mb-4">
            <LoadingSpinner size={40} color={'var(--primary)'} />
          </div>
          <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
            {t("settings.loading") || "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  const avatarUrl = profilePicturePreview || settings.profilePicture || null;
  const initials = initialsFromName(
    settings.name || "",
    settings.username || ""
  );
  const gradient = gradientFromString(
    settings.name || settings.username || "user"
  );

  return (
    <div
      className={`min-h-screen font-sans transition-colors duration-300 bg-gray-50 dark:bg-gray-900 ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
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
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fade-in-down {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-fade-in {
          animation: fade-in 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out;
        }
        .animate-fade-in-down {
          animation: fade-in-down 0.6s ease-out;
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
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
        .section-title {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .section-label {
          font-size: 20px;
          font-weight: 600;
          color: var(--on-surface);
        }
        .section-subtitle {
          color: var(--on-surface-variant);
          font-size: 14px;
        }
        .setting-item {
          transition: all 0.2s ease;
        }
        .setting-item:hover {
          transform: translateY(-2px);
        }
        .responsive-avatar {
          transition: all 0.3s ease;
        }
        .responsive-avatar:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
      `}</style>

      <div className="min-w-7xl mx-auto px-4 py-6 bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
        {/* Header container with MD3 container styling */}
        <div className="mb-6 animate-fade-in" style={{ animationDelay: "0ms" }}>
          <div className="md3-container surface-elevation-3 overflow-hidden">
            <div className=" dark:bg-gray-800 px-5 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex min-w-0 gap-4 items-center">
                  <div className="md3-icon-container bg-[var(--primary-container)] bg-green-200 dark:bg-indigo-900 surface-elevation-1">
                    <Settings className="h-6 w-6 text-green-800 dark:text-indigo-200 transition-transform duration-300 hover:scale-110" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold  dark:text-white truncate">
                      {t("settings.title") || "Settings"}
                    </h1>
                    <p className="mt-1 dark:text-gray-400 max-w-2xl">
                      {t("settings.subtitle")}
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
        <div className="md3-card bg-[var(--surface-container-low)] bg-gray-50 dark:bg-gray-800 surface-elevation-3">
          <div className="p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Profile Picture Section */}
              <section className="pb-6 border-b border-[var(--outline-variant)] dark:border-gray-700">
                <div className="section-title">
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary-container)] bg-green-300 dark:bg-green-900 flex items-center justify-center">
                    <User className="h-5 w-5 text-[var(--on-primary-container)] text-black dark:text-green-200" />
                  </div>
                  <div>
                    <h2 className="text-[var(--on-surface)] text-xl font-semibold text-black dark:text-white">
                      {t("settings.profilePicture") || "Profile picture"}
                    </h2>
                    <p className="text-[var(--on-surface-variant)] text-sm text-gray-700 dark:text-gray-400">
                      {t("settings.pictureHint") ||
                        "Square image works best (max 5 MB)"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6 mt-4">
                  <div className="relative responsive-avatar">
                    {profilePicturePreview ? (
                      <img
                        src={profilePicturePreview}
                        alt="Profile Preview"
                        className="w-24 h-24 rounded-full object-cover border-2 border-[var(--outline-variant)] border-gray-100 dark:border-gray-600"
                      />
                    ) : (
                      <AuthenticatedImage
                        src={settings.profilePicture}
                        alt={t("settings.profilePicture") || "Profile picture"}
                        fallbackName={settings.name}
                        fallbackUsername={settings.username}
                        fallbackSeed={settings.name || settings.username}
                        className="w-24 h-24 rounded-full object-cover border-2 border-[var(--outline-variant)] border-gray-100 dark:border-gray-600"
                        fallbackClassName="w-24 h-24 rounded-full flex items-center justify-center text-white text-xl font-semibold bg-[var(--primary-container)] dark:bg-green-600"
                      />
                    )}

                    {profilePicturePreview && (
                      <button
                        type="button"
                        onClick={removeProfilePicturePreview}
                        className="absolute -top-2 -right-2 bg-[var(--error-container)] dark:bg-red-900 text-[var(--on-error-container)] dark:text-red-200 rounded-full p-1 shadow-md hover:bg-[var(--error)] dark:hover:bg-red-700 transition-all"
                        aria-label="Remove preview"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex-1 w-full space-y-4">
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        id="profile-picture"
                        accept="image/*"
                        onChange={handleProfilePictureChange}
                        className="hidden"
                      />
                      <label
                        htmlFor="profile-picture"
                        className="inline-flex w-full sm:w-fit justify-center items-center px-4 py-2 border border-gray-400 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-black dark:text-white cursor-pointer hover:bg-[var(--surface-container)] hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                      >
                        <Upload className="w-4 h-4 mr-2 text-[var(--on-surface)] text-black dark:text-white" />
                        {t("settings.chooseImage") || "Choose image"}
                      </label>
                    </div>

                    {profilePictureFile && (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {profilePictureFile.name} •{" "}
                          {formatBytes(profilePictureFile.size)}
                        </div>
                        <button
                          type="button"
                          onClick={uploadProfilePicture}
                          disabled={uploadingPicture}
                          className={`inline-flex items-center gap-2 ${primaryBtn} w-full sm:w-auto justify-center`}
                        >
                          {uploadingPicture ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-transparent border-t-[var(--on-primary)]"></div>
                              <span>
                                {t("settings.uploading") || "Uploading..."}
                              </span>
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 text-white" />
                              <span>{t("settings.upload") || "Upload"}</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Personal Info Section */}
              <section className="pb-6 border-b border-[var(--outline-variant)] dark:border-gray-700">
                <div className="section-title">
                  <div className="w-10 h-10 rounded-xl bg-[var(--tertiary-container)] bg-purple-300 dark:bg-purple-900 flex items-center justify-center">
                    <UserCircle className="h-5 w-5 text-[var(--on-tertiary-container)] text-black dark:text-purple-200" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold dark:text-white">
                      {t("settings.personalInfo") || "Personal info"}
                    </h2>
                    <p className="text-sm dark:text-gray-400">
                      {t("settings.personalInfoDesc")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="setting-item">
                    <label className={labelClass}>
                      {t("settings.username") || "Username"}
                    </label>
                    <input
                      type="text"
                      value={settings.username}
                      readOnly
                      className="w-full rounded-2xl py-[10px] px-4 border border-gray-400 transition-all duration-200 ease-linear bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      {t("settings.usernameHelp")}
                    </p>
                  </div>

                  <div className="setting-item">
                    <label className={labelClass}>
                      {t("settings.name") || "Full name"}
                    </label>
                    <input
                      type="text"
                      value={settings.name}
                      onChange={(e) =>
                        setSettings({ ...settings, name: e.target.value })
                      }
                      className="w-full rounded-2xl py-[10px] px-4 border border-gray-400 transition-all duration-200 ease-linear bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      placeholder={
                        t("settings.namePlaceholder") || "Your display name"
                      }
                    />
                  </div>
                </div>
              </section>

              {/* Appearance Section */}
              {/* <section className="pb-6 border-b border-[var(--outline-variant)] dark:border-gray-700">
                <div className="section-title">
                  <div className="w-10 h-10 rounded-xl bg-[var(--secondary-container)] dark:bg-blue-900 flex items-center justify-center">
                    <Palette className="h-5 w-5 text-[var(--on-secondary-container)] dark:text-blue-200" />
                  </div>
                  <div>
                    <h2 className="section-label text-[var(--on-surface)] dark:text-white">{t("settings.appearance") || "Appearance"}</h2>
                    <p className="section-subtitle text-[var(--on-surface-variant)] dark:text-gray-400">{t("settings.appearanceDesc")}</p>
                  </div>
                </div>

                <div className="max-w-md mt-4 setting-item">
                  <label className={labelClass}>
                    {t("settings.language") || "Language"}
                  </label>
                  <div className="bg-[var(--surface-container-lowest)] dark:bg-gray-700 rounded-xl p-1 surface-elevation-1">
                    <LanguageSwitcher
                      value={settings.language}
                      onChange={(lang) =>
                        setSettings({ ...settings, language: lang })
                      }
                    />
                  </div>
                </div>
              </section> */}

              {/* Password Section */}
              <section className="pb-6 border-b border-[var(--outline-variant)] dark:border-gray-700">
                <div className="section-title">
                  <div className="w-10 h-10 rounded-xl bg-red-300 dark:bg-red-900 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-black dark:text-red-200" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold dark:text-white">
                      {t("settings.changePassword") || "Change password"}
                    </h2>
                    <p className="text-sm dark:text-gray-400">
                      {t("settings.passwordRequirements") ||
                        "Minimum 8 characters."}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="setting-item">
                    <label className={labelClass}>
                      {t("settings.oldPassword") || "Old password"}
                    </label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => {
                        setOldPassword(e.target.value);
                        if (e.target.value && oldPasswordError)
                          setOldPasswordError("");
                      }}
                      placeholder={
                        t("settings.passwordPlaceholder") || "••••••••"
                      }
                      className={`w-full rounded-2xl py-[10px] px-4 border border-gray-400 transition-all duration-200 ease-linear bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 ${
                        oldPasswordError
                          ? "border-[var(--error)] ring-2 ring-[var(--error-container)]"
                          : ""
                      }`}
                    />
                    {oldPasswordError && (
                      <p className="mt-1 text-sm text-[var(--error)] dark:text-red-400 animate-shake">
                        {oldPasswordError}
                      </p>
                    )}
                  </div>

                  <div className="setting-item">
                    <label className={labelClass}>
                      {t("settings.newPassword") || "New password"}
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (e.target.value && e.target.value.length < 8)
                          setPasswordError(
                            t("settings.errors.passwordTooShort") ||
                              "Password too short"
                          );
                        else setPasswordError("");
                      }}
                      placeholder={
                        t("settings.passwordPlaceholder") || "••••••••"
                      }
                      className={`w-full rounded-2xl py-[10px] px-4 border border-gray-400 transition-all duration-200 ease-linear bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 ${
                        passwordError
                          ? "border-[var(--error)] ring-2 ring-[var(--error-container)]"
                          : ""
                      }`}
                    />
                    {passwordError && (
                      <p className="mt-1 text-sm text-[var(--error)] dark:text-red-400 animate-shake">
                        {passwordError}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Submit Section */}
              <section className="pt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={
                    saving ||
                    (newPassword && newPassword.length < 8) ||
                    (newPassword && !oldPassword)
                  }
                  className={`inline-flex items-center gap-2 ${primaryBtn} dark:bg-indigo-800 w-full md:w-auto justify-center`}
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-transparent border-t-[var(--on-primary)]"></div>
                      <span>{t("settings.saving") || "Saving..."}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-white" />
                      <span>{t("settings.saveChanges") || "Save changes"}</span>
                    </>
                  )}
                </button>
              </section>
            </form>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed z-50 right-4 bottom-4 animate-fade-in">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={handleToastClose}
          />
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
