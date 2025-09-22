import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import {
  Moon,
  Sun,
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

/* -------------------------
   Helpers
------------------------- */
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
  for (let i = 0; i < (s || "").length; i += 1) hash = (hash << 5) - hash + s.charCodeAt(i);
  const a = Math.abs(hash);
  const h1 = a % 360;
  const h2 = (180 + h1) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 60%), hsl(${h2} 70% 40%))`;
};

/* -------------------------
   Main component
------------------------- */
const SettingsPage = () => {
  const { t } = useTranslation();
  const { updateUser } = useAuth();

  const [settings, setSettings] = useState({
    username: "",
    name: "",
    language: "en",
    darkMode: false,
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
  const [profilePicturePreview, setProfilePicturePreview] = useState(null); // local blob url
  const [uploadingPicture, setUploadingPicture] = useState(false);

  const previewObjectUrlRef = useRef(null);

  const showToast = (message, type = "create") => {
    setToast({ message, type });
  };
  const handleToastClose = () => setToast(null);

  const applyDarkClass = (isDark) => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };



  /* Load settings */
  const fetchSettings = async () => {
    try {
      const data = await api("/api/settings", "GET");
      if (data) {
        setSettings((prev) => ({ ...prev, ...data }));
        const local = localStorage.getItem("theme");
        const wantDark = local !== null ? local === "dark" : Boolean(data.darkMode);
        applyDarkClass(wantDark);
        setSettings((prev) => ({ ...prev, darkMode: wantDark }));
      }
    } catch (err) {
      console.error("Failed to load settings", err);
      showToast(t("settings.errors.loadError") || "Failed to load settings", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Profile picture selection */
  const handleProfilePictureChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast(t("settings.errors.invalidImage") || "Invalid image file", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(t("settings.errors.imageTooLarge") || `Image too large (max ${formatBytes(5 * 1024 * 1024)})`, "error");
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
  };

  const uploadProfilePicture = async () => {
    if (!profilePictureFile) return;
    setUploadingPicture(true);
    try {
      const fd = new FormData();
      fd.append("profilePicture", profilePictureFile);

      // send with credentials; include Authorization header if available
      const token = (typeof window !== "undefined" && window.__ACCESS_TOKEN) ? window.__ACCESS_TOKEN : localStorage.getItem("authToken");
      const resp = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/settings/profile-picture`, {
        method: "PUT",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
        body: fd,
      });

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => null);
        let parsed;
        try { parsed = errBody ? JSON.parse(errBody) : null; } catch { parsed = errBody; }
        throw new Error(parsed?.message || t("settings.errors.uploadError") || "Upload failed");
      }

      const data = await resp.json();

      // robust merge: prefer a full user from server if present, otherwise merge into existing stored user
      let returnedUser = data.user || null;
      if (!returnedUser || !Array.isArray(returnedUser.permissions)) {
        try {
          const stored = JSON.parse(localStorage.getItem("user") || "{}");
          returnedUser = { ...stored };
        } catch (e) {
          returnedUser = {};
        }
      }

      const mergedUser = {
        ...returnedUser,
        profilePicture: data.profilePicture || returnedUser.profilePicture || settings.profilePicture || ""
      };

      // update context + storage (updateUser handles theme/lang etc)
      updateUser(mergedUser, data.token || undefined);
      setSettings((s) => ({ ...s, profilePicture: mergedUser.profilePicture }));
      removeProfilePicturePreview();
      showToast(t("settings.toasts.pictureSuccess") || "Profile picture updated", "update");
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
      setOldPasswordError(t("settings.errors.oldPasswordRequired") || "Old password required");
      isValid = false;
    } else {
      setOldPasswordError("");
    }

    if (newPassword && newPassword.length < 8) {
      setPasswordError(t("settings.errors.passwordTooShort") || "Password too short");
      isValid = false;
    } else {
      setPasswordError("");
    }

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
        darkMode: settings.darkMode,
        oldPassword: oldPassword || undefined,
        newPassword: newPassword || undefined,
      };

      const data = await api("/api/settings", "PUT", payload);

      if (data?.user) {
        // If backend returns a partial user, merge instead of replacing
        let returnedUser = data.user;
        if (!returnedUser || !Array.isArray(returnedUser.permissions)) {
          try {
            const stored = JSON.parse(localStorage.getItem("user") || "{}");
            returnedUser = { ...stored, ...returnedUser };
          } catch (e) {
            returnedUser = { ...returnedUser };
          }
        }
        updateUser(returnedUser, data.token);
      }
      showToast(t("settings.toasts.updateSuccess") || "Settings updated", "update");
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
      <div className="min-h-screen bg-gray-200 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-500 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">{t("settings.loading") || "Loading..."}</p>
        </div>
      </div>
    );
  }

  const avatarUrl = profilePicturePreview || settings.profilePicture || null;
  const initials = initialsFromName(settings.name || "", settings.username || "");
  const gradient = gradientFromString(settings.name || settings.username || "user");

  return (
    <div className="min-h-screen dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200 settings-wrap">
      <header className="static top-0 z-20 bg-gray-200 dark:bg-gray-900/60 backdrop-blur-sm">
        <div className="max-w-8xl justify-between mx-auto px-4 py-4 flex sm:flex-row sm:items-center gap-3 sm:gap-6 header-inner">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center min-w-0 header-actions">
              <div className="p-3 rounded-lg bg-white dark:bg-gray-800">
                        <Settings className="h-6 w-6 text-sky-600 dark:text-sky-300" />
                      </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-medium sm:font-extrabold truncate">{t("settings.title") || "Settings"}</h1>
              <p className="mt-1 text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-2xl">
                {t("settings.subtitle")}
              </p>
              </div>
            </div>
          </div>

              <TopBar className="flex"/>
        </div>
      </header>

      <main className="max-w-8xl mx-auto px-4 py-6 container">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
          <form onSubmit={handleSubmit} className="space-y-0">
            {/* Profile Picture */}
            <section className="p-6 section">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300">
                  <User size={18} />
                </div>
                <h2 className="text-lg font-semibold">{t("settings.profilePicture") || "Profile picture"}</h2>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="relative responsive-avatar">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="w-28 h-28 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 shadow-sm"
                    />
                  ) : (
                    <div
                      className="w-28 h-28 rounded-full flex items-center justify-center text-white text-2xl font-semibold shadow-sm"
                      style={{ background: gradient }}
                      aria-hidden
                    >
                      {initials}
                    </div>
                  )}

                  {profilePicturePreview && (
                    <button
                      type="button"
                      onClick={removeProfilePicturePreview}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md"
                      aria-label="Remove preview"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div>
                    <input
                      type="file"
                      id="profile-picture"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="profile-picture"
                      className="inline-flex items-center px-4 py-2 border rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {t("settings.chooseImage") || "Choose image"}
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    {profilePictureFile ? (
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {profilePictureFile.name} • {formatBytes(profilePictureFile.size)}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {t("settings.pictureHint") || "Square image works best (max 5 MB)"}
                      </div>
                    )}

                    {profilePictureFile && (
                      <button
                        type="button"
                        onClick={uploadProfilePicture}
                        disabled={uploadingPicture}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors btn-sm-full"
                      >
                        {uploadingPicture ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                            <span>{t("settings.uploading") || "Uploading..."}</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>{t("settings.upload") || "Upload"}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Personal Info */}
            <section className="p-6 section">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300">
                  <UserCircle size={18} />
                </div>
                <h2 className="text-lg font-semibold">{t("settings.personalInfo") || "Personal info"}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 responsive-grid">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t("settings.username") || "Username"}
                  </label>
                  <input
                    type="text"
                    value={settings.username}
                    readOnly
                    className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("settings.usernameHelp")}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t("settings.name") || "Full name"}
                  </label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t("settings.namePlaceholder") || "Your display name"}
                  />
                </div>
              </div>
            </section>

            {/* Appearance */}
            <section className="p-6 section">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300">
                  <Palette size={18} />
                </div>
                <h2 className="text-lg font-semibold">{t("settings.appearance") || "Appearance"}</h2>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t("settings.language") || "Language"}
                  </label>
                  <LanguageSwitcher
                    compact
                    value={settings.language}
                    onChange={(lang) => setSettings({ ...settings, language: lang })}
                  />
                </div>
              </div>
            </section>

            {/* Password */}
            <section className="p-6 section">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300">
                  <Shield size={18} />
                </div>
                <h2 className="text-lg font-semibold">{t("settings.changePassword") || "Change password"}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 responsive-grid">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t("settings.oldPassword") || "Old password"}</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => {
                      setOldPassword(e.target.value);
                      if (e.target.value && oldPasswordError) setOldPasswordError("");
                    }}
                    placeholder={t("settings.passwordPlaceholder") || "••••••••"}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${oldPasswordError ? "border-red-500" : "border-gray-300"} bg-white dark:bg-gray-700`}
                  />
                  {oldPasswordError && <p className="mt-1 text-xs text-red-500">{oldPasswordError}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t("settings.newPassword") || "New password"}</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (e.target.value && e.target.value.length < 8) setPasswordError(t("settings.errors.passwordTooShort") || "Password too short");
                      else setPasswordError("");
                    }}
                    placeholder={t("settings.passwordPlaceholder") || "••••••••"}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${passwordError ? "border-red-500" : "border-gray-300"} bg-white dark:bg-gray-700`}
                  />
                  {passwordError && <p className="mt-1 text-xs text-red-500">{passwordError}</p>}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("settings.passwordRequirements") || "Minimum 8 characters."}</p>
                </div>
              </div>
            </section>

            {/* Submit */}
            <section className="p-6 bg-gray-50 dark:bg-gray-700/50 flex justify-end section">
              <button
                type="submit"
                disabled={saving || (newPassword && newPassword.length < 8) || (newPassword && !oldPassword)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm disabled:opacity-50 transition-colors btn-sm-full"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    <span>{t("settings.saving") || "Saving..."}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{t("settings.saveChanges") || "Save changes"}</span>
                  </>
                )}
              </button>
            </section>
          </form>
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={handleToastClose} />}
    </div>
  );
};

export default SettingsPage;
