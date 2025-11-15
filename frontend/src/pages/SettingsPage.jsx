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

      const token =
        typeof window !== "undefined" && window.__ACCESS_TOKEN
          ? window.__ACCESS_TOKEN
          : localStorage.getItem("authToken");

      const resp = await fetch(
        `${import.meta.env.VITE_API_URL || ""}/api/settings/profile-picture`,
        {
          method: "PUT",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
          body: fd,
        }
      );

      if (!resp.ok) {
        const errText = await resp.text().catch(() => null);
        let parsed;
        try {
          parsed = errText ? JSON.parse(errText) : null;
        } catch {
          parsed = errText;
        }
        throw new Error(
          parsed?.message || t("settings.errors.uploadError") || "Upload failed"
        );
      }

      const data = await resp.json();

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-200 dark:bg-gray-900 flex items-center justify-center p-6 transition-all duration-500">
        <div className="flex flex-col items-center animate-fade-in-up">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 dark:border-blue-500 mb-4 transition-all duration-700" />
          <p className="text-gray-500 dark:text-gray-400 transition-colors duration-300 text-xs">
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
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-all duration-500 ease-in-out text-xs">
      {/* Full-width header */}
      <header className="w-full transition-all duration-500">
        <div className="w-full px-4 sm:px-6 py-3">
          <div className="bg-white dark:bg-gray-800 backdrop-blur-xs rounded-2xl shadow-sm px-4 py-3 flex justify-between items-center animate-fade-in-down transition-all duration-500 w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex items-center gap-3 header-actions">
                <div className="p-2 rounded-xl bg-gray-200 dark:bg-gray-900 shadow hover:shadow-md hover:scale-105 transition-all duration-300">
                  <Settings className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-semibold truncate">
                    {t("settings.title") || "Settings"}
                  </h1>
                  <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                    {t("settings.subtitle")}
                  </p>
                </div>
              </div>
            </div>
            <TopBar className="flex transition-transform duration-300 hover:scale-105" />
          </div>
        </div>
      </header>

      {/* Full-width main content */}
      <main className="w-full px-4 sm:px-6 py-5 animate-fade-in-up">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xs overflow-hidden divide-y divide-gray-100 dark:divide-gray-700 transition-all duration-500 ease-in-out transform hover:shadow-lg w-full">
          <form onSubmit={handleSubmit} className="w-full">
            {/* Profile Picture - Full width */}
            <section className="p-4 sm:p-6 section transition-all duration-300 ease-in-out w-full">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 transition-all duration-300 hover:scale-110">
                  <User size={16} />
                </div>
                <h2 className="text-base font-medium transition-colors duration-300">
                  {t("settings.profilePicture") || "Profile picture"}
                </h2>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full">
                <div className="relative responsive-avatar transition-all duration-500 flex-shrink-0">
                  {profilePicturePreview ? (
                    <img
                      src={profilePicturePreview}
                      alt="Profile Preview"
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 shadow-xs transition-all duration-500 ease-in-out transform hover:scale-105 hover:shadow-md"
                    />
                  ) : (
                    <AuthenticatedImage
                      src={settings.profilePicture}
                      alt={t("settings.profilePicture") || "Profile picture"}
                      fallbackName={settings.name}
                      fallbackUsername={settings.username}
                      fallbackSeed={settings.name || settings.username}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 shadow-xs transition-all duration-500 ease-in-out transform hover:scale-105 hover:shadow-md"
                      fallbackClassName="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-white text-xl font-semibold shadow-xs transition-all duration-500 ease-in-out transform hover:scale-105"
                    />
                  )}

                  {profilePicturePreview && (
                    <button
                      type="button"
                      onClick={removeProfilePicturePreview}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-md transition-all duration-300 ease-in-out transform hover:scale-110 hover:bg-red-600 active:scale-95"
                      aria-label="Remove preview"
                    >
                      <X className="w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-300" />
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-3 flex-1 min-w-0 w-full">
                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <div className="flex-shrink-0">
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
                        className="inline-flex items-center px-3 py-1.5 border rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer transition-all duration-300 ease-in-out transform hover:scale-105 hover:bg-gray-200 dark:hover:bg-gray-600 hover:shadow-md active:scale-95 text-xs w-full sm:w-auto justify-center"
                      >
                        <Upload className="w-4 h-4 mr-2 transition-transform duration-300" />
                        {t("settings.chooseImage") || "Choose image"}
                      </label>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1 min-w-0">
                      {profilePictureFile ? (
                        <div className="text-xs text-gray-600 dark:text-gray-300 transition-colors duration-300 truncate flex-1 min-w-0">
                          {profilePictureFile.name} •{" "}
                          {formatBytes(profilePictureFile.size)}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">
                          {t("settings.pictureHint") ||
                            "Square image works best (max 5 MB)"}
                        </div>
                      )}

                      {profilePictureFile && (
                        <button
                          type="button"
                          onClick={uploadProfilePicture}
                          disabled={uploadingPicture}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg transition-all duration-500 ease-in-out transform hover:scale-105 hover:bg-blue-700 hover:shadow-lg disabled:opacity-60 disabled:transform-none active:scale-95 text-xs w-full sm:w-auto justify-center"
                        >
                          {uploadingPicture ? (
                            <>
                              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white transition-transform duration-700" />
                              <span className="transition-colors duration-300 text-xs">
                                {t("settings.uploading") || "Uploading..."}
                              </span>
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
                              <span className="transition-colors duration-300 text-xs">
                                {t("settings.upload") || "Upload"}
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Personal Info - Full width */}
            <section className="p-4 sm:p-6 section transition-all duration-300 ease-in-out w-full">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 transition-all duration-300 hover:scale-110">
                  <UserCircle size={16} />
                </div>
                <h2 className="text-base font-medium transition-colors duration-300">
                  {t("settings.personalInfo") || "Personal info"}
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
                <div className="transition-all duration-300 transform hover:scale-[1.02]">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-300">
                    {t("settings.username") || "Username"}
                  </label>
                  <input
                    type="text"
                    value={settings.username}
                    readOnly
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 transition-all duration-300 ease-in-out transform hover:border-gray-400 text-xs"
                  />
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 transition-colors duration-300">
                    {t("settings.usernameHelp")}
                  </p>
                </div>

                <div className="transition-all duration-300 transform hover:scale-[1.02]">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-300">
                    {t("settings.name") || "Full name"}
                  </label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={(e) =>
                      setSettings({ ...settings, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 ease-in-out transform hover:border-blue-400 dark:hover:border-blue-400 focus:scale-[1.02] text-xs"
                    placeholder={
                      t("settings.namePlaceholder") || "Your display name"
                    }
                  />
                </div>
              </div>
            </section>

            {/* Appearance - Full width */}
            <section className="p-4 sm:p-6 section transition-all duration-300 ease-in-out w-full">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 transition-all duration-300 hover:scale-110">
                  <Palette size={16} />
                </div>
                <h2 className="text-base font-medium transition-colors duration-300">
                  {t("settings.appearance") || "Appearance"}
                </h2>
              </div>

              <div className="w-full max-w-md">
                <div className="transition-all duration-300 transform hover:scale-[1.02]">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-300">
                    {t("settings.language") || "Language"}
                  </label>
                  <LanguageSwitcher
                    compact
                    value={settings.language}
                    onChange={(lang) =>
                      setSettings({ ...settings, language: lang })
                    }
                  />
                </div>
              </div>
            </section>

            {/* Password - Full width */}
            <section className="p-4 sm:p-6 section transition-all duration-300 ease-in-out w-full">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 transition-all duration-300 hover:scale-110">
                  <Shield size={16} />
                </div>
                <h2 className="text-base font-medium transition-colors duration-300">
                  {t("settings.changePassword") || "Change password"}
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
                <div className="transition-all duration-300 transform hover:scale-[1.02]">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-300">
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
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-all duration-300 ease-in-out transform hover:border-blue-400 dark:hover:border-blue-400 focus:scale-[1.02] ${
                      oldPasswordError
                        ? "border-red-500 animate-shake"
                        : "border-gray-300"
                    } bg-white dark:bg-gray-700 text-xs`}
                  />
                  {oldPasswordError && (
                    <p className="mt-1 text-[11px] text-red-500 transition-all duration-300 animate-fade-in">
                      {oldPasswordError}
                    </p>
                  )}
                </div>

                <div className="transition-all duration-300 transform hover:scale-[1.02]">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-300">
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
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-all duration-300 ease-in-out transform hover:border-blue-400 dark:hover:border-blue-400 focus:scale-[1.02] ${
                      passwordError
                        ? "border-red-500 animate-shake"
                        : "border-gray-300"
                    } bg-white dark:bg-gray-700 text-xs`}
                  />
                  {passwordError && (
                    <p className="mt-1 text-[11px] text-red-500 transition-all duration-300 animate-fade-in">
                      {passwordError}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 transition-colors duration-300">
                    {t("settings.passwordRequirements") ||
                      "Minimum 8 characters."}
                  </p>
                </div>
              </div>
            </section>

            {/* Submit - Full width */}
            <section className="p-4 sm:p-6 bg-gray-50 dark:bg-gray-700/50 flex justify-end section transition-all duration-300 w-full">
              <button
                type="submit"
                disabled={
                  saving ||
                  (newPassword && newPassword.length < 8) ||
                  (newPassword && !oldPassword)
                }
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-xs disabled:opacity-50 transition-all duration-500 ease-in-out transform hover:scale-105 hover:shadow-lg active:scale-95 text-xs w-full sm:w-auto justify-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white transition-transform duration-700" />
                    <span className="transition-colors duration-300 text-xs">
                      {t("settings.saving") || "Saving..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
                    <span className="transition-colors duration-300 text-xs">
                      {t("settings.saveChanges") || "Save changes"}
                    </span>
                  </>
                )}
              </button>
            </section>
          </form>
        </div>
      </main>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={handleToastClose}
        />
      )}

      <style jsx>{`
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
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-5px);
          }
          75% {
            transform: translateX(5px);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out;
        }
        .animate-fade-in-down {
          animation: fade-in-down 0.6s ease-out;
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out;
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default SettingsPage;