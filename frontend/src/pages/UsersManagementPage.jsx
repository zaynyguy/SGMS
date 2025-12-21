import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Edit, Trash2, UserPlus, Users, X, Image, Upload } from "lucide-react";
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  fetchRoles,
} from "../api/admin";
import { api as apiAuth } from "../api/auth";
import Toast from "../components/common/Toast";
import AuthenticatedImage from "../components/common/AuthenticatedImage";
import TopBar from "../components/layout/TopBar";

/* ---------- Helpers ---------- */
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

const dataURLToFile = (dataURL, filename = "upload.png") => {
  const arr = dataURL.split(",");
  const match = arr[0].match(/:(.*?);/);
  const mime = match ? match[1] : "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

/* ---------- Component ---------- */
const UsersManagementPage = () => {
  const { t } = useTranslation();

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

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [formData, setFormData] = useState({
    username: "",
    name: "",
    password: "",
    roleId: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const previewRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => setMounted(false);
  }, []);

  const showToast = (message, semanticType = "info") => {
    const map = {
      success: "create",
      info: "read",
      update: "update",
      delete: "delete",
      error: "error",
    };
    const tType = map[semanticType] || semanticType || "create";
    setToast({ id: Date.now(), text: message, type: tType });
  };
  const handleToastClose = () => setToast(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const usersData = await fetchUsers();
        setUsers(usersData || []);
        const rolesData = await fetchRoles();
        setRoles(rolesData || []);
      } catch (error) {
        console.error("load users error:", error);
        showToast(
          t("admin.users.errors.loadFailed", {
            error: error?.message || error,
          }),
          "error"
        );
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [t]);

  React.useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
      }
    };
  }, []);

  const validateForm = () => {
    const errors = {};
    if (!formData.username.trim())
      errors.username = t("admin.users.errors.usernameRequired");
    if (!formData.name.trim()) errors.name = t("admin.users.errors.nameRequired");
    if (!userToEdit && !formData.password)
      errors.password = t("admin.users.errors.passwordRequired");
    else if (formData.password && formData.password.length < 8)
      errors.password = t("admin.users.errors.passwordTooShort");
    if (!formData.roleId) errors.roleId = t("admin.users.errors.roleRequired");
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenUserModal = (user) => {
    if (user) {
      setFormData({
        username: user.username || "",
        name: user.name || "",
        password: "",
        roleId: user.role?.id || user.roleId || "",
      });
      setUserToEdit(user);
      setProfilePicturePreview(user.profilePicture || null);
      setProfilePictureFile(null);
    } else {
      setFormData({ username: "", name: "", password: "", roleId: "" });
      setUserToEdit(null);
      setProfilePicturePreview(null);
      setProfilePictureFile(null);
    }
    setFormErrors({});
    setShowUserModal(true);
  };

  const handleCloseUserModal = () => {
    setShowUserModal(false);
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setProfilePictureFile(null);
    setProfilePicturePreview(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast(
        t("admin.users.errors.invalidImage") || "Invalid image file",
        "error"
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(
        t("admin.users.errors.imageTooLarge") || "Image too large (max 5 MB)",
        "error"
      );
      return;
    }
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setProfilePicturePreview(url);
    setProfilePictureFile(file);
  };

  const removeProfilePreview = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setProfilePicturePreview(null);
    setProfilePictureFile(null);
    if (userToEdit) {
      setProfilePicturePreview(userToEdit.profilePicture || null);
    }
  };

  const uploadProfileFileForUser = async (userId, file) => {
    if (!userId || !file) return null;
    const fd = new FormData();
    fd.append("file", file);
    const result = await apiAuth(
      `/api/users/${userId}/profile-picture`,
      "PUT",
      fd,
      { isFormData: true }
    );
    return result;
  };

  // ---------- error helper ----------
function parseServerError(err) {
  if (!err) return "Unknown error";
  // plain string
  if (typeof err === "string") return err;

  // axios-style response?
  const payload = err?.response?.data ?? err?.data ?? err;

  // if payload is a string or has common fields
  if (typeof payload === "string") return payload;
  if (payload?.message) return payload.message;
  if (payload?.error) return payload.error;
  if (payload?.detail) return payload.detail;

  // field-level errors e.g. { errors: { username: ["..."] } }
  if (payload?.errors && typeof payload.errors === "object") {
    if (payload.errors.username) {
      const u = Array.isArray(payload.errors.username)
        ? payload.errors.username.join("; ")
        : String(payload.errors.username);
      return u;
    }
    // join other field errors
    const parts = [];
    for (const k of Object.keys(payload.errors)) {
      const v = payload.errors[k];
      parts.push(`${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
    }
    if (parts.length) return parts.join("; ");
  }

  // fallback to any message-ish properties
  if (payload && typeof payload === "object") {
    // try to find a username mention
    const stringified = JSON.stringify(payload);
    if (stringified) {
      // If server embedded the username in text, return that text.
      return stringified;
    }
  }

  return err?.message || String(err);
}


const handleSaveUser = async (e) => {
  e.preventDefault();
  if (!validateForm()) {
    showToast(t("admin.users.errors.formValidation"), "error");
    return;
  }
  try {
    setSubmitting(true);
    const payload = {
      username: formData.username.trim(),
      name: formData.name.trim(),
      roleId: Number(formData.roleId),
      ...(formData.password ? { password: formData.password } : {}),
    };

    // CLIENT-SIDE DUPLICATE CHECK (fast UX)
    if (!userToEdit) {
      const usernameLower = (payload.username || "").toLowerCase();
      const exists = users.some((u) => (u.username || "").toLowerCase() === usernameLower);
      if (exists) {
        // prefer an i18n string if available
        const msg =
          t("admin.users.errors.usernameExists", { username: payload.username }) ||
          `${payload.username} already exists`;
        showToast(msg, "error");
        setSubmitting(false);
        return;
      }
    }

    // Prepare payload defaults
    if (!profilePictureFile && !profilePicturePreview) {
      payload.profilePicture = null;
    }

    let savedUser = null;
    if (userToEdit) {
      savedUser = await updateUser(userToEdit.id, payload);
    } else {
      savedUser = await createUser(payload);
    }

    // upload profile pic if provided
    if (profilePictureFile) {
      try {
        const idForUpload = savedUser?.id;
        if (!idForUpload) throw new Error("User id not available for upload");
        await uploadProfileFileForUser(idForUpload, profilePictureFile);
      } catch (uploadErr) {
        console.error("Profile picture upload failed:", uploadErr);
        showToast(
          t("admin.users.errors.pictureUploadFailed") || "Profile picture upload failed",
          "error"
        );
      }
    } else if (
      profilePicturePreview &&
      profilePicturePreview.startsWith("data:") &&
      savedUser?.id
    ) {
      try {
        const f = dataURLToFile(
          profilePicturePreview,
          `${savedUser.username || savedUser.id}_pic.png`
        );
        await uploadProfileFileForUser(savedUser.id, f);
      } catch (err) {
        console.error("DataURL profile picture upload failed:", err);
        showToast(
          t("admin.users.errors.pictureUploadFailed") || "Profile picture upload failed",
          "error"
        );
      }
    }

    const updatedUsers = await fetchUsers();
    setUsers(updatedUsers || []);
    handleCloseUserModal();
    showToast(
      userToEdit
        ? t("admin.users.toasts.updateSuccess", { name: formData.name })
        : t("admin.users.toasts.createSuccess", { name: formData.name }),
      userToEdit ? "update" : "success"
    );
  } catch (error) {
    console.error("save user error:", error);
    // parse server error and surface field-level messages (username exists etc)
    const serverMsg = parseServerError(error);
    // If server mentions username conflict but doesn't include the username itself,
    // add the attempted username as extra context:
    const lowerMsg = (String(serverMsg || "")).toLowerCase();
    let finalMsg = serverMsg;
    if (!lowerMsg.includes((formData.username || "").toLowerCase()) && (
      lowerMsg.includes("username") ||
      lowerMsg.includes("already exists") ||
      error?.response?.status === 409
    )) {
      finalMsg = `${formData.username} — ${serverMsg}`;
    }
    showToast(
      t("admin.users.errors.saveFailed", { error: finalMsg }) || finalMsg || "Save failed",
      "error"
    );
  } finally {
    setSubmitting(false);
  }
};


  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeleteConfirmModal(true);
  };

  const confirmDelete = async () => {
    try {
      setSubmitting(true);
      await deleteUser(userToDelete.id);
      const updatedUsers = await fetchUsers();
      setUsers(updatedUsers || []);
      showToast(
        t("admin.users.toasts.deleteSuccess", { name: userToDelete.name }),
        "delete"
      );
    } catch (error) {
      console.error("delete user error:", error);
      showToast(
        t("admin.users.errors.deleteFailed", {
          error: error?.message || error,
        }),
        "error"
      );
    } finally {
      setSubmitting(false);
      setShowDeleteConfirmModal(false);
      setUserToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirmModal(false);
    setUserToDelete(null);
  };

  // Button style helpers with MD3 styling
  const primaryBtn = "px-4 py-2.5 text-sm font-medium rounded-xl bg-[var(--primary)] dark:text-indigo-200 dark:bg-indigo-900 hover:bg-[color-mix(in_srgb,var(--primary),white_10%)] text-[var(--on-primary)] transition-all duration-200 shadow-md hover:shadow-lg";
  const ghostBtn = "px-4 py-2.5 text-sm font-medium rounded-xl border border-[var(--outline-variant)] bg-transparent text-[var(--on-surface)] hover:bg-[var(--surface-container-low)] transition-all duration-200";
  const outlineBtn = "px-4 py-2.5 text-sm font-medium rounded-xl border border-[var(--outline-variant)] text-[var(--on-surface)] hover:bg-[color-mix(in_srgb,var(--surface),black_4%)] transition-all duration-200";
  const errorBtn = "px-4 py-2.5 text-sm font-medium rounded-xl bg-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error),white_10%)] text-[var(--on-error)] transition-all duration-200 shadow-md hover:shadow-lg";

  if (loading) {
    return (
      <section
        id="users"
        role="tabpanel"
        aria-labelledby="users-tab"
        className="p-3 sm:p-4 min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"
        style={{
          "--background": m3Colors.background,
        }}
      >
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary)]" />
      </section>
    );
  }

  // Filtering logic for search
  const q = (searchQuery || "").trim().toLowerCase();
  const filteredUsers = !q
    ? users
    : users.filter((u) => {
        const name = (u.name || "").toString().toLowerCase();
        const username = (u.username || "").toString().toLowerCase();
        const roleLabel = ((u.role && (u.role.name || u.role)) || u.roleId || "")
          .toString()
          .toLowerCase();
        return (
          name.includes(q) || username.includes(q) || roleLabel.includes(q)
        );
      });

  return (
    <div 
      className={`min-h-screen font-sans transition-colors duration-300 ${mounted ? 'opacity-100' : 'opacity-0'} bg-gray-50 dark:bg-gray-900`}
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
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn { 
          from { opacity: 0; } 
          to { opacity: 1; } 
        }
        @keyframes popIn { 
          from { opacity: 0; transform: scale(.98); } 
          to { opacity:1; transform: scale(1); } 
        }
        @keyframes slideUpToast { 
          from { opacity: 0; transform: translateY(12px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
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
        .user-row {
          opacity: 0;
          transform: translateY(6px);
          animation: fadeUp .28s cubic-bezier(.2,.9,.2,1) forwards;
          animation-delay: var(--delay, 0ms);
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .user-row:hover {
          transform: translateY(-2px);
          box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        }
        .user-card {
          opacity: 0;
          transform: translateY(6px);
          animation: fadeUp .28s cubic-bezier(.2,.9,.2,1) forwards;
          animation-delay: var(--delay, 0ms);
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .user-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .modal-overlay {
          opacity: 0;
          animation: fadeIn .18s ease forwards;
        }
        .modal-dialog {
          opacity: 0;
          transform: scale(.98);
          animation: popIn .18s cubic-bezier(.2,.9,.2,1) forwards;
        }
        .toast-anim {
          opacity: 0;
          transform: translateY(8px);
          animation: slideUpToast .22s cubic-bezier(.2,.9,.2,1) forwards;
        }
        .avatar-hover {
          transition: transform .18s ease;
          will-change: transform;
        }
        .avatar-hover:hover {
          transform: scale(1.05);
        }
        .btn-press {
          transition: transform .12s ease, box-shadow .12s ease;
          will-change: transform;
        }
        .btn-press:active {
          transform: scale(.98);
        }
        .file-label-anim {
          transition: transform .12s ease, box-shadow .12s ease;
        }
        .file-label-anim:hover {
          transform: translateY(-2px);
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
      `}</style>
      {toast && (
        <div className="fixed z-50 right-4 bottom-4">
          <div className="toast-anim">
            <Toast
              key={toast.id}
              message={toast.text}
              type={toast.type}
              onClose={handleToastClose}
            />
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
  <div className="md3-container surface-elevation-3">
    <div className="bg-[var(--surface-container-low)] dark:bg-gray-800">
      <div className="px-5 py-4">
        {/* First Row: Title and Subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
  <div className="flex min-w-0 items-center gap-4">
    <div className="md3-icon-container bg-[var(--primary-container)] dark:bg-indigo-900 surface-elevation-1">
      <Users className="h-6 w-6 text-green-800 dark:text-indigo-200 transition-transform duration-300 hover:scale-110" />
    </div>
    <div className="min-w-0">
      <h1 className="text-2xl font-bold text-[var(--on-surface)] dark:text-white truncate">
        {t("admin.users.title")}
      </h1>
      <p className="mt-1 text-[var(--on-surface-variant)] dark:text-gray-400 max-w-2xl">
        {t("admin.users.subtitle")}
      </p>
    </div>
  </div>
  <div className="flex items-center gap-3">
    <div className="flex-shrink-0">
      <TopBar /> 
    </div>
  </div>
</div>
        {/* Second Row: Search and Add Button */}
        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Bar */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="search"
                aria-label={t("admin.users.search")}
                placeholder={t("admin.users.placeholders.search") || "Search users..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="md3-input w-full pr-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[var(--surface-container)] dark:hover:bg-gray-600"
                  aria-label={t("admin.actions.clearSearch") || "Clear search"}
                >
                  <X size={14} className="text-gray-500 dark:text-gray-400" />
                </button>
              )}
            </div>
          </div>
          {/* Add Button */}
          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={() => handleOpenUserModal(null)}
              disabled={submitting}
              aria-label={t("admin.users.addUser")}
              className={`${primaryBtn} inline-flex items-center justify-center w-full sm:w-auto gap-2`}
            >
              <UserPlus size={18} aria-hidden="true" />
              <span>{t("admin.users.addUser")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
        <section
          id="users"
          role="tabpanel"
          aria-labelledby="users-tab"
          className="space-y-4"
        >
          {/* Desktop Table */}
          <div className="hidden md:block">
            {filteredUsers.length > 0 ? (
              <div className="md3-card bg-[var(--surface-container-low)] dark:bg-gray-800 surface-elevation-3 overflow-hidden">
                <table className="min-w-full divide-y divide-[var(--outline-variant)] text-sm">
                  <thead className="bg-[var(--surface-container)] dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider">
                        {t("admin.users.table.user")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider">
                        {t("admin.users.table.role")}
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider">
                        {t("admin.users.table.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--outline-variant)] dark:divide-gray-700">
                    {filteredUsers.map((u, idx) => {
                      const roleLabel =
                        (u.role && (u.role.name || u.role)) ||
                        u.roleId ||
                        t("admin.users.noRole");
                      return (
                        <tr
                          key={u.id}
                          className="hover:bg-[color-mix(in_srgb,var(--surface-container-low),black_2%)] dark:hover:bg-gray-700 transition-colors duration-150 user-row"
                          style={{ ["--delay"]: `${idx * 40}ms` }}
                        >
                          <td className="px-4 py-3 whitespace-nowrap align-middle">
                            <div className="flex items-center gap-3 min-w-0">
                              <AuthenticatedImage
                                src={u.profilePicture}
                                alt={u.name || u.username}
                                fallbackName={u.name}
                                fallbackUsername={u.username}
                                fallbackSeed={u.name || u.username}
                                className="w-10 h-10 rounded-full object-cover border border-[var(--outline-variant)] dark:border-gray-600 flex-shrink-0 avatar-hover"
                                fallbackClassName="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 text-sm bg-gradient-to-br from-green-400 to-green-600"
                              />
                              <div className="min-w-0">
                                <div
                                  className="font-medium text-[var(--on-surface)] dark:text-white truncate"
                                  title={u.name || u.username}
                                >
                                  {u.name || u.username}
                                </div>
                                <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400">
                                  @{u.username}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap align-middle">
                            <div className="inline-flex items-center px-2.5 py-1 font-medium rounded-full bg-[var(--secondary-container)] dark:bg-blue-900 text-[var(--on-secondary-container)] dark:text-blue-200">
                              {roleLabel}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right font-medium align-middle">
                            <div className="inline-flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenUserModal(u)}
                                className="p-2 rounded-full hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 transition-colors text-[var(--on-surface-variant)] dark:text-gray-300 btn-press"
                                title={t("admin.actions.edit")}
                                disabled={submitting}
                                aria-label={t("admin.actions.edit")}
                              >
                                <Edit size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(u)}
                                className="p-2 rounded-full hover:bg-[var(--error-container)] dark:hover:bg-red-900 transition-colors text-[var(--on-error-container)] dark:text-red-300 btn-press"
                                title={t("admin.actions.delete")}
                                disabled={submitting}
                                aria-label={t("admin.actions.delete")}
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="md3-card bg-[var(--surface-container-low)] dark:bg-gray-800 surface-elevation-1 text-center p-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--surface-container)] dark:bg-gray-700 mb-4 mx-auto">
                  <UserPlus className="h-6 w-6 text-[var(--on-surface-variant)] dark:text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--on-surface)] dark:text-white mb-1">
                  {filteredUsers.length === 0 && users.length > 0
                    ? t("admin.users.noSearchResults") || "No users found"
                    : t("admin.users.noUsers")}
                </h3>
                <p className="text-[var(--on-surface-variant)] dark:text-gray-400 mb-6 max-w-md mx-auto">
                  {filteredUsers.length === 0 && users.length > 0
                    ? t("admin.users.noSearchResultsDescription") || "Try another search term or clear the query."
                    : t("admin.users.noUsersDescription")}
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenUserModal(null)}
                  className={`${primaryBtn} inline-flex items-center gap-2`}
                  disabled={submitting}
                  aria-label={t("admin.users.addUser")}
                >
                  <UserPlus size={18} />
                  <span>{t("admin.users.addUser")}</span>
                </button>
              </div>
            )}
          </div>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((u, idx) => {
                const roleLabel =
                  (u.role && (u.role.name || u.role)) ||
                  u.roleId ||
                  t("admin.users.noRole");
                return (
                  <div
                    key={u.id}
                    className="bg-[var(--surface-container-lowest)] dark:bg-gray-800 rounded-2xl p-4 surface-elevation-1 user-card"
                    style={{ ["--delay"]: `${idx * 40}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <AuthenticatedImage
                          src={u.profilePicture}
                          alt={u.name || u.username}
                          fallbackName={u.name}
                          fallbackUsername={u.username}
                          fallbackSeed={u.name || u.username}
                          className="w-12 h-12 rounded-full object-cover border border-[var(--outline-variant)] dark:border-gray-600 flex-shrink-0 avatar-hover"
                          fallbackClassName="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 text-base bg-gradient-to-br from-green-400 to-green-600"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--on-surface)] dark:text-white truncate text-base">
                            {u.name || u.username}
                          </div>
                          <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400">
                            @{u.username}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--secondary-container)] dark:bg-blue-900 text-[var(--on-secondary-container)] dark:text-blue-200">
                              {roleLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenUserModal(u)}
                          className="p-2 rounded-full hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 transition-colors text-[var(--on-surface-variant)] dark:text-gray-300 btn-press"
                          disabled={submitting}
                          aria-label={t("admin.actions.edit")}
                          title={t("admin.actions.edit")}
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(u)}
                          className="p-2 rounded-full hover:bg-[var(--error-container)] dark:hover:bg-red-900 transition-colors text-[var(--on-error-container)] dark:text-red-300 btn-press"
                          disabled={submitting}
                          aria-label={t("admin.actions.delete")}
                          title={t("admin.actions.delete")}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-[var(--surface-container-lowest)] dark:bg-gray-800 rounded-2xl p-6 surface-elevation-1 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--surface-container)] dark:bg-gray-700 mb-4 mx-auto">
                  <UserPlus className="h-7 w-7 text-[var(--on-surface-variant)] dark:text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--on-surface)] dark:text-white mb-1">
                  {filteredUsers.length === 0 && users.length > 0
                    ? t("admin.users.noSearchResults") || "No users match your search"
                    : t("admin.users.noUsers")}
                </h3>
                <p className="text-[var(--on-surface-variant)] dark:text-gray-400 mb-6 px-2 mx-auto max-w-md">
                  {filteredUsers.length === 0 && users.length > 0
                    ? t("admin.users.noSearchResultsDescription") || "Try a different search term or clear the search."
                    : t("admin.users.noUsersDescription")}
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenUserModal(null)}
                  className={`${primaryBtn} inline-flex items-center gap-2 w-full`}
                  disabled={submitting}
                  aria-label={t("admin.users.addUser")}
                >
                  <UserPlus size={18} />
                  <span>{t("admin.users.addUser")}</span>
                </button>
              </div>
            )}
          </div>
          {/* User Form Modal */}
          {showUserModal && (
            <div
              className="fixed inset-0 bg-[var(--scrim)]/[.32] dark:bg-gray-900/[.8] flex items-center justify-center p-4 z-50 modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-modal-title"
            >
              <div className="bg-[var(--surface-container-lowest)] dark:bg-gray-800 rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto modal-dialog surface-elevation-3">
                <div className="flex items-start justify-between mb-5">
                  <h3
                    id="user-modal-title"
                    className="text-xl font-bold text-[var(--on-surface)] dark:text-white"
                  >
                    {userToEdit
                      ? t("admin.users.editUserTitle")
                      : t("admin.users.createUserTitle")}
                  </h3>
                  <button
                    type="button"
                    onClick={handleCloseUserModal}
                    className="p-2 rounded-full hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 transition-colors text-[var(--on-surface-variant)] dark:text-gray-300 btn-press"
                    disabled={submitting}
                    aria-label={t("admin.actions.close")}
                  >
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleSaveUser} className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-start items-center gap-4 w-full">
  {/* Profile picture preview */}
  <div className="flex-shrink-0">
    {profilePicturePreview ? (
      <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[var(--outline-variant)] dark:border-gray-600">
        <AuthenticatedImage
          src={profilePicturePreview}
          alt={t("admin.users.form.picture")}
          fallbackName={formData.name}
          fallbackUsername={formData.username}
          fallbackSeed={formData.name || formData.username}
          className="w-full h-full object-cover avatar-hover"
          fallbackClassName="w-full h-full flex items-center justify-center text-white font-semibold text-base bg-gradient-to-br from-green-400 to-green-600"
        />
        <button
          type="button"
          onClick={removeProfilePreview}
          className="absolute -bottom-1 -right-1 bg-[var(--error-container)] dark:bg-red-900 rounded-full p-1 text-[var(--on-error-container)] dark:text-red-300 shadow"
          title={t("admin.users.form.remove")}
        >
          <X size={14} />
        </button>
      </div>
    ) : (
      <div className="relative w-20 h-20 rounded-full bg-[var(--surface-container)] dark:bg-gray-700 flex items-center justify-center border-2 border-dashed border-[var(--outline-variant)] dark:border-gray-600">
        <Image className="h-8 w-8 text-[var(--on-surface-variant)] dark:text-gray-400" />
      </div>
    )}
  </div>
  {/* Upload controls */}
  <div className="flex-1 w-full sm:w-auto flex flex-col sm:items-start items-center">
    <label className="block text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 mb-1 text-center sm:text-left">
      {t("admin.users.form.picture")}
    </label>
    <div className="flex items-center gap-3 justify-center sm:justify-start">
      <input
        id="user-picture"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <label
        htmlFor="user-picture"
        className="flex items-center gap-2 px-3 py-2 border border-[var(--outline-variant)] dark:border-gray-600 rounded-xl bg-[var(--surface-container-lowest)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white hover:bg-[var(--surface-container-low)] dark:hover:bg-gray-600 cursor-pointer transition-colors file-label-anim"
      >
        <Upload size={16} />
        <span>{t("admin.users.form.upload")}</span>
      </label>
    </div>
    <p className="mt-1 text-xs text-[var(--on-surface-variant)] dark:text-gray-400 text-center sm:text-left">
      {t("admin.users.form.pictureHint")}
    </p>
  </div>
</div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="username"
                        className="block text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 mb-1"
                      >
                        {t("admin.users.form.username")} *
                      </label>
                      <input
                        id="username"
                        name="username"
                        type="text"
                        className={`w-full md3-input bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                          formErrors.username ? "border-[var(--error)] ring-2 ring-[var(--error-container)]" : ""
                        }`}
                        placeholder={t("admin.users.form.usernamePlaceholder")}
                        value={formData.username}
                        onChange={handleFormChange}
                        disabled={submitting}
                        aria-invalid={!!formErrors.username}
                      />
                      {formErrors.username && (
                        <p className="mt-1 text-sm text-[var(--error)] dark:text-red-400">
                          {formErrors.username}
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="name"
                        className="block text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 mb-1"
                      >
                        {t("admin.users.form.name")} *
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        className={`w-full md3-input bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                          formErrors.name ? "border-[var(--error)] ring-2 ring-[var(--error-container)]" : ""
                        }`}
                        placeholder={t("admin.users.form.namePlaceholder")}
                        value={formData.name}
                        onChange={handleFormChange}
                        disabled={submitting}
                        aria-invalid={!!formErrors.name}
                      />
                      {formErrors.name && (
                        <p className="mt-1 text-sm text-[var(--error)] dark:text-red-400">
                          {formErrors.name}
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="password"
                        className="block text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 mb-1"
                      >
                        {userToEdit
                          ? t("admin.users.form.newPassword")
                          : t("admin.users.form.password")}
                        {!userToEdit && " *"}
                      </label>
                      <input
                        id="password"
                        name="password"
                        type="password"
                        className={`w-full md3-input bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                          formErrors.password ? "border-[var(--error)] ring-2 ring-[var(--error-container)]" : ""
                        }`}
                        placeholder={t("admin.users.form.passwordPlaceholder")}
                        value={formData.password}
                        onChange={handleFormChange}
                        disabled={submitting}
                        aria-invalid={!!formErrors.password}
                      />
                      {formErrors.password && (
                        <p className="mt-1 text-sm text-[var(--error)] dark:text-red-400">
                          {formErrors.password}
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="roleId"
                        className="block text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 mb-1"
                      >
                        {t("admin.users.form.role")} *
                      </label>
                      <select
                        id="roleId"
                        name="roleId"
                        className={`w-full md3-input bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                          formErrors.roleId ? "border-[var(--error)] ring-2 ring-[var(--error-container)]" : ""
                        }`}
                        value={formData.roleId}
                        onChange={handleFormChange}
                        disabled={submitting}
                        aria-invalid={!!formErrors.roleId}
                      >
                        <option value="" className="bg-white dark:bg-gray-700">{t("admin.users.form.selectRole")}</option>
                        {roles.map((r) => (
                          <option 
                            key={r.id} 
                            value={r.id}
                            className="bg-white dark:bg-gray-700"
                          >
                            {r.name}
                          </option>
                        ))}
                      </select>
                      {formErrors.roleId && (
                        <p className="mt-1 text-sm text-[var(--error)] dark:text-red-400">
                          {formErrors.roleId}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleCloseUserModal}
                      className={`${ghostBtn} w-full bg-white dark:bg-gray-700 text-[var(--on-surface)] dark:text-white border-[var(--outline-variant)] dark:border-gray-600`}
                      disabled={submitting}
                    >
                      {t("admin.actions.cancel")}
                    </button>
                    <button
                      type="submit"
                      className={`${primaryBtn} w-full flex items-center justify-center gap-2`}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-transparent border-t-[var(--on-primary)]" />
                          <span>{t("admin.actions.processing")}</span>
                        </div>
                      ) : userToEdit ? (
                        t("admin.actions.saveChanges")
                      ) : (
                        t("admin.actions2.create")
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {/* Delete Confirmation Modal */}
          {showDeleteConfirmModal && userToDelete && (
            <div
              className="fixed inset-0 bg-[var(--scrim)]/[.32] dark:bg-gray-900/[.8] flex items-center justify-center p-4 z-50 modal-overlay"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-title"
              aria-describedby="delete-desc"
            >
              <div className="bg-[var(--surface-container-lowest)] dark:bg-gray-800 rounded-2xl p-5 w-full max-w-md modal-dialog surface-elevation-3">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-[var(--error-container)] dark:bg-red-900 flex items-center justify-center">
                    <Trash2 className="h-6 w-6 text-[var(--on-error-container)] dark:text-red-300" />
                  </div>
                </div>
                <h3
                  id="delete-title"
                  className="text-xl font-bold text-[var(--on-surface)] dark:text-white text-center mb-2"
                >
                  {t("admin.users.deleteConfirm.title")}
                </h3>
                <p
                  id="delete-desc"
                  className="text-base text-[var(--on-surface-variant)] dark:text-gray-400 text-center mb-6"
                >
                  {t("admin.users.deleteConfirm.message", {
                    name: userToDelete.name,
                  })}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={cancelDelete}
                    className={`${ghostBtn} flex-1 bg-white dark:bg-gray-700 text-[var(--on-surface)] dark:text-white border-[var(--outline-variant)] dark:border-gray-600`}
                    disabled={submitting}
                  >
                    {t("admin.actions.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className={`${errorBtn} flex-1 flex items-center justify-center gap-2`}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-transparent border-t-[var(--on-error)]" />
                        <span>{t("admin.actions.deleting")}</span>
                      </div>
                    ) : (
                      t("admin.actions2.delete")
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default UsersManagementPage;