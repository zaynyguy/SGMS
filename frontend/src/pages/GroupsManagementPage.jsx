import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Search,
  Users,
  Layers,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Upload
} from "lucide-react";
import { fetchGroups, createGroup, updateGroup, deleteGroup } from "../api/groups";
import { addUserToGroup, removeUserFromGroup, fetchGroupUsers } from "../api/userGroups";
import { fetchUsers } from "../api/admin";
import Toast from "../components/common/Toast";
import { rawFetch } from "../api/auth";
import AuthenticatedImage from "../components/common/AuthenticatedImage";
import TopBar from "../components/layout/TopBar";
import LoadingSpinner from "../components/ui/LoadingSpinner";

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

/* Modal Transition Wrapper */
const ModalTransitionWrapper = ({ children, onClose }) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationDurationMs = 300; 
  useEffect(() => {
    setShouldRender(true);
    const timer = setTimeout(() => setIsAnimating(true), 10); 
    return () => clearTimeout(timer);
  }, []);
  const handleClose = useCallback(() => {
    setIsAnimating(false);
    setTimeout(onClose, animationDurationMs); 
  }, [onClose]);
  if (!shouldRender) return null;
  const childWithClose = React.cloneElement(children, {
    onClose: handleClose,
  });
  return (
    <div 
      className={`fixed inset-0 bg-black/50 dark:bg-gray-900/70 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ${
        isAnimating ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose} 
    >
      <div 
        className={`w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-auto max-h-[90vh] transition-all duration-300 ${
          isAnimating 
            ? "opacity-100 scale-100 translate-y-0" 
            : "opacity-0 scale-95 translate-y-4"
        }`}
        onClick={e => e.stopPropagation()} 
      >
        {childWithClose}
      </div>
    </div>
  );
};

/* Group Form Modal */
const GroupFormModal = ({ group, onSave, onClose, t }) => {
  const [name, setName] = useState(group?.name || "");
  const [description, setDescription] = useState(group?.description || "");
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const previewRef = useRef(null);
  const originalPictureUrl = group?.profilePicture || null;
  useEffect(() => {
    setName(group?.name || "");
    setDescription(group?.description || "");
    setProfilePictureFile(null);
    setProfilePicturePreview(null); 
    setErrors({});
  }, [group?.id]);
  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErrors({ file: t("groups.form.errors.invalidImage") || "Invalid image" });
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setErrors({ file: t("groups.form.errors.imageTooLarge") || "Image too large" });
      return;
    }
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    const url = URL.createObjectURL(f);
    previewRef.current = url;
    setProfilePicturePreview(url); 
    setProfilePictureFile(f);
    setErrors({});
  };
  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
      }
    };
  }, []);
  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!name.trim()) newErrors.name = t("groups.form.errors.nameRequired");
    if (name.length > 50) newErrors.name = t("groups.form.errors.nameTooLong");
    if (description.length > 300) newErrors.description = t("groups.form.errors.descriptionTooLong");
    if (Object.keys(newErrors).length) return setErrors(newErrors);
    try {
      setIsLoading(true);
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("description", description.trim() || "");
      if (profilePictureFile) {
        fd.append("profilePicture", profilePictureFile);
      } 
      else if (!profilePicturePreview && !originalPictureUrl) {
          fd.append("profilePicture", ""); 
      }
      await onSave(fd);
    } catch (err) {
      console.error("Failed to save group:", err);
      setErrors({ submit: err.message || t("groups.form.errors.saveFailed") || "Save failed" });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  const removePreview = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setProfilePictureFile(null);
    setProfilePicturePreview(null);
  };
  const displayUrl = profilePicturePreview || originalPictureUrl;
  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {group ? t("groups.form.title.edit") : t("groups.form.title.create")}
        </h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 dark:text-gray-400"
          aria-label={t("groups.form.close")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar Section */}
          <div className="flex-shrink-0">
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600">
              {profilePicturePreview ? (
                <img 
                  src={profilePicturePreview} 
                  alt="Profile preview" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <AuthenticatedImage
                  src={originalPictureUrl}
                  alt={name || group?.name || ""}
                  fallbackName={name || group?.name}
                  fallbackSeed={name || group?.name || "group"}
                  className="w-full h-full object-cover"
                  fallbackClassName="w-full h-full flex items-center justify-center text-white font-semibold text-base bg-gradient-to-br from-indigo-500 to-indigo-600"
                />
              )}
              {(profilePicturePreview || originalPictureUrl) && (
                <button
                  type="button"
                  onClick={removePreview}
                  className="absolute -bottom-1 -right-1 bg-red-100 dark:bg-red-900 rounded-full p-1 text-red-600 dark:text-red-300 shadow"
                  title={t("groups.form.buttons.remove")}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          {/* Upload Controls */}
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("groups.form.picture")}
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input id="group-picture-input" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <label
                htmlFor="group-picture-input"
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors"
              >
                <Upload size={16} />
                <span>{t("groups.form.buttons.uploadPicture") || "Upload picture"}</span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 sm:mt-0">
                {t("groups.form.pictureHint") || "PNG, JPG up to 5MB"}
              </p>
            </div>
            {errors.file && <p className="mt-1 text-sm text-red-500">{errors.file}</p>}
          </div>
        </div>
        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("groups.form.labels.name")} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border ${
                errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              } focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white`}
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("groups.form.labels.description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
              className={`w-full px-4 py-2.5 rounded-xl border ${
                errors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              } focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white`}
              aria-invalid={!!errors.description}
            />
            {errors.description && <p className="mt-1 text-sm text-red-500">{errors.description}</p>}
          </div>
        </div>
        {errors.submit && <p className="text-sm text-red-500">{errors.submit}</p>}
        {/* Modal Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200"
          >
            {t("groups.form.buttons.cancel")}
          </button>
          <button 
            type="submit" 
            disabled={isLoading} 
            className="px-4 py-2.5 text-sm font-medium rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t("groups.form.buttons.saving")}
              </span>
            ) : group ? t("groups.form.buttons.save") : t("groups.form.buttons.create")}
          </button>
        </div>
      </form>
    </div>
  );
};

/* Group Members Modal */
const GroupMembers = ({ group, onClose, allUsers, onUpdateMemberCount, t }) => {
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState(null);
  const loadMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      const membersData = await fetchGroupUsers(group.id);
      setMembers(membersData || []);
    } catch (err) {
      console.error("Failed to load group members:", err);
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, [group.id]);
  useEffect(() => {
    if (group?.id) loadMembers();
  }, [loadMembers, group]);
  const availableUsers = useMemo(() => {
    return (allUsers || []).filter((user) => !members.some((member) => member.id === user.id));
  }, [allUsers, members]);
  const handleAddMember = async () => {
    if (!selectedUser) return;
    try {
      setIsAdding(true);
      const uid = typeof selectedUser === "string" ? Number(selectedUser) : selectedUser;
      await addUserToGroup(group.id, uid);
      const membersData = await fetchGroupUsers(group.id);
      setMembers(membersData || []);
      onUpdateMemberCount(group.id, (membersData || []).length);
      setSelectedUser("");
    } catch (err) {
      console.error("Failed to add member:", err);
    } finally {
      setIsAdding(false);
    }
  };
  const handleRemoveMember = async (userId) => {
    try {
      setIsRemoving(userId);
      await removeUserFromGroup(group.id, userId);
      const membersData = await fetchGroupUsers(group.id);
      setMembers(membersData || []);
      onUpdateMemberCount(group.id, (membersData || []).length);
    } catch (err) {
      console.error("Failed to remove member:", err);
    } finally {
      setIsRemoving(null);
    }
  };
  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {t("groups.members.title.manage")} — <span className="font-medium text-gray-600 dark:text-gray-400 ml-1">{group.name}</span>
        </h2>
        <button 
          onClick={onClose} 
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 dark:text-gray-400" 
          aria-label={t("groups.form.close")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="space-y-5">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">{t("groups.members.add.title")}</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full flex-1 px-4 py-2.5 border rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={availableUsers.length === 0}
            >
              <option value="">{t("groups.members.add.selectUser")}</option>
              {availableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.username})
                </option>
              ))}
            </select>
            <button
              onClick={handleAddMember}
              disabled={!selectedUser || isAdding}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
              aria-label={t("groups.members.add.button")}
            >
              <Users className="h-4 w-4" />
              <span>{isAdding ? t("groups.members.add.adding") : t("groups.members.add.button")}</span>
            </button>
          </div>
          {availableUsers.length === 0 && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("groups.members.add.noAvailable")}</p>}
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">{t("groups.members.current.title", { count: members.length })}</h3>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900">
                <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
              </div>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t("groups.members.current.empty")}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
              {members.map((member) => (
                <div 
                  key={member.id} 
                  className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <AuthenticatedImage
                      src={member.profilePicture}
                      alt={member.name}
                      fallbackName={member.name}
                      fallbackUsername={member.username}
                      fallbackSeed={member.name || member.username}
                      className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-600"
                      fallbackClassName="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-gradient-to-br from-indigo-500 to-indigo-600"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{member.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">@{member.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={isRemoving === member.id}
                    className="p-2 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 disabled:opacity-60 transition-colors"
                    title={t("groups.members.remove.title")}
                  >
                    {isRemoving === member.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500 dark:border-red-400" />
                    ) : (
                      <Users className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* Delete Confirmation Modal */
const DeleteConfirmModal = ({ group, onConfirm, onClose, submitting, t }) => (
  <div className="p-6 text-center">
    <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-100 dark:bg-red-900">
      <Trash2 className="h-7 w-7 text-red-600 dark:text-red-300" />
    </div>
    <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">{t("groups.confirmDeleteTitle")}</h3>
    <p className="mt-2 text-gray-600 dark:text-gray-400">
      {t("groups.confirmDeleteMessage", { groupName: group?.name })}
    </p>
    <div className="mt-6 flex gap-3">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
      >
        {t("admin.actions.cancel")}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={submitting}
        className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-red-500 hover:bg-red-600 text-white transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
      >
        {submitting ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {t("admin.actions.deleting")}
          </span>
        ) : (
          <>
            <Trash2 size={18} />
            <span>{t("admin.actions2.delete")}</span>
          </>
        )}
      </button>
    </div>
  </div>
);

/* Main GroupsManager Component */
function GroupsManager() {
  const { t, i18n } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);

  // Select colors based on dark mode
  const m3Colors = darkMode ? darkColors : lightColors;

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => setMounted(false);
  }, []);

    const showToast = useCallback((text, semanticType = "success") => {
    const map = {
      success: "create",
      info: "read",
      update: "update",
      delete: "delete",
      error: "error",
    };
    const tType = map[semanticType] || semanticType || "create";
    // store the message under `message` and also keep raw `text` for safety
    setToast({ message: text, text, type: tType });
  }, []);


  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [groupsData, usersData] = await Promise.all([fetchGroups(), fetchUsers()]);
      setAllUsers(usersData || []);
      setGroups(groupsData || []);
    } catch (err) {
      console.error("Failed to load data:", err);
      showToast(t("groups.messages.loadFailed"), "error");
    } finally {
      setIsLoading(false);
    }
  }, [t, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToastClose = useCallback(() => {
    setToast(null);
  }, []);

  const openCreateModal = useCallback(() => {
    setCurrentGroup(null);
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((group) => {
    setCurrentGroup(group);
    setIsModalOpen(true);
  }, []);

  const openMembersModal = useCallback((group) => {
    setCurrentGroup(group);
    setIsMembersModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setCurrentGroup(null);
  }, []);

  const closeMembersModal = useCallback(() => {
    setIsMembersModalOpen(false);
    setCurrentGroup(null);
  }, []);

  const handleDeleteClick = useCallback((group) => {
    setGroupToDelete(group);
    setShowDeleteConfirmModal(true);
  }, []);

  const cancelDelete = useCallback(() => {
    setShowDeleteConfirmModal(false);
    setGroupToDelete(null);
  }, []);

  const handleSaveGroup = useCallback(
    async (groupData) => {
      if (!(groupData instanceof FormData)) {
          console.error("handleSaveGroup expected FormData");
          showToast(t("groups.messages.saveFailed"), "error");
          return;
      }
      try {
        let resp;
        if (currentGroup) {
          resp = await rawFetch(`/api/groups/${currentGroup.id}`, "PUT", groupData, { isFormData: true });
        } else {
          resp = await rawFetch("/api/groups/", "POST", groupData, { isFormData: true });
        }
        if (!resp.ok) {
          const txt = await resp.text().catch(() => null);
          let parsed;
          try {
            parsed = txt ? JSON.parse(txt) : null;
          } catch {
            parsed = txt;
          }
          throw new Error(parsed?.message || t("groups.messages.saveFailed"));
        }
        await resp.json().catch(() => null);
        showToast(currentGroup ? t("groups.messages.updated") : t("groups.messages.created"), currentGroup ? "update" : "success");
        await loadData();
        closeModal();
      } catch (err) {
        console.error("Error saving group:", err);
        showToast(t("groups.messages.saveFailed"), "error");
        throw err;
      }
    },
    [currentGroup, closeModal, loadData, showToast, t]
  );

  const confirmDelete = useCallback(async () => {
    if (!groupToDelete) return;
    try {
      setSubmitting(true);
      await deleteGroup(groupToDelete.id);
      await loadData();
      showToast(t("groups.messages.deleted"), "delete");
    } catch (err) {
      console.error("Error deleting group:", err);
      showToast(t("groups.messages.deleteFailed"), "error");
    } finally {
      setSubmitting(false);
      cancelDelete();
    }
  }, [groupToDelete, loadData, showToast, t, cancelDelete]);

  const handleUpdateMemberCount = useCallback((groupId, newCount) => {
    setGroups((prevGroups) => prevGroups.map((g) => (g.id === groupId ? { ...g, memberCount: newCount } : g)));
  }, []);

  const requestSort = useCallback(
    (key) => {
      let direction = "asc";
      if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
      setSortConfig({ key, direction });
    },
    [sortConfig]
  );

  const formatDate = useCallback(
    (dateString) => {
      if (!dateString) return t("groups.na");
      try {
        return new Date(dateString).toLocaleDateString(i18n.language);
      } catch {
        return dateString;
      }
    },
    [i18n.language, t]
  );

  const toggleGroupExpand = useCallback(
    (groupId) => {
      setExpandedGroup(expandedGroup === groupId ? null : groupId);
    },
    [expandedGroup]
  );

  const filteredGroups = useMemo(() => {
    let result = groups || [];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (g) =>
          (g.name || "").toLowerCase().includes(q) ||
          (g.description && g.description.toLowerCase().includes(q))
      );
    }
    result = [...result].sort((a, b) => {
      if (sortConfig.key === "memberCount") {
        if ((a.memberCount || 0) < (b.memberCount || 0)) return sortConfig.direction === "asc" ? -1 : 1;
        if ((a.memberCount || 0) > (b.memberCount || 0)) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      }
      const av = a[sortConfig.key];
      const bv = b[sortConfig.key];
      if (av < bv) return sortConfig.direction === "asc" ? -1 : 1;
      if (av > bv) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [groups, searchTerm, sortConfig]);

  return (
    <div 
      className={`min-h-screen bg-gray-50 dark:bg-gray-900 font-sans transition-colors duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
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
        @keyframes popIn { 
          from { opacity: 0; transform: scale(.98); } 
          to { opacity:1; transform: scale(1); } 
        }
        .group-row {
          opacity: 0;
          transform: translateY(6px);
          animation: fadeUp .28s cubic-bezier(.2,.9,.2,1) forwards;
          animation-delay: var(--delay, 0ms);
        }
        .group-row:hover {
          transform: translateY(-2px);
          box-shadow: 0 2px 6px rgba(0,0,0,0.05);
        }
        .group-card {
          opacity: 0;
          transform: translateY(6px);
          animation: fadeUp .28s cubic-bezier(.2,.9,.2,1) forwards;
          animation-delay: var(--delay, 0ms);
        }
        .group-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .modal-overlay {
          opacity: 0;
          animation: fade-in .18s ease forwards;
        }
        .modal-dialog {
          opacity: 0;
          transform: scale(.98);
          animation: popIn .18s cubic-bezier(.2,.9,.2,1) forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .expandable-content {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease-in-out;
        }
        .expandable-content.expanded {
          max-height: 1000px;
        }
      `}</style>
      <div className="min-w-7xl min-h-screen mx-auto px-4 py-6 bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
        <header className="mb-6">
  <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl">
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
      <div className="px-5 py-4">
        {/* First Row: Title, Subtitle, and TopBar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-indigo-900">
              <Layers className="h-6 w-6 text-green-800 dark:text-indigo-200" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-gray-900 dark:text-white">
                {t("groups.title")}
              </h1>
              <p className="mt-1 max-w-2xl text-gray-500 dark:text-gray-400">
                {t("groups.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <TopBar />
          </div>
        </div>
        {/* Second Row: Search and Create Button */}
        <div className="flex flex-col-reverse items-stretch gap-4 sm:flex-row sm:items-center">
          {/* Search Bar */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 dark:text-gray-400">
              <Search className="h-5 w-5" aria-hidden="true" />
            </div>
            <input
              type="text"
              placeholder={t("groups.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2.5 pl-10 pr-4 text-base transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              aria-label={t("groups.searchAria")}
            />
          </div>
          {/* Action Button */}
          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center w-full sm:w-auto rounded-xl bg-green-900 dark:bg-indigo-900 px-4 py-2.5 text-sm font-medium text-white dark:text-indigo-200 shadow-md transition-all duration-200 hover:bg-green-700 hover:dark:bg-indigo-700 hover:shadow-lg gap-2"
            >
              <Plus size={18} aria-hidden="true" />
              <span>{t("groups.newGroup")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</header>
        <div className="mt-4">
        </div>
        <main className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div>
                <LoadingSpinner size={40} color={'#4f46e5'} />
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                {filteredGroups.length > 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th onClick={() => requestSort("name")} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                            <th onClick={() => requestSort("memberCount")} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Members</th>
                            <th onClick={() => requestSort("createdAt")} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Created</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Updated</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {filteredGroups.map((g, idx) => (
                            <tr
                              key={g.id}
                              className="group-row hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              style={{ "--delay": `${idx * 40}ms` }}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-3 min-w-0">
                                  <AuthenticatedImage
                                    src={g.profilePicture}
                                    alt={g.name}
                                    fallbackName={g.name}
                                    fallbackSeed={g.name || "group"}
                                    className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-600"
                                    fallbackClassName="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-gradient-to-br from-indigo-500 to-indigo-600"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-medium text-gray-900 dark:text-white truncate max-w-xs">{g.name}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400 max-w-md truncate">{g.description || t("groups.noDescription")}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 inline-flex text-xs leading-5 font-medium rounded-full bg-green-200 dark:bg-indigo-900 text-green-800 dark:text-indigo-300">
                                  {g.memberCount || 0} members
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{formatDate(g.createdAt)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{formatDate(g.updatedAt)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => openMembersModal(g)}
                                    className="p-1.5 rounded-lg text-gray-400 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
                                    title={t("groups.actions.members")}
                                  >
                                    <Users size={16} />
                                  </button>
                                  <button
                                    onClick={() => openEditModal(g)}
                                    className="p-1.5 rounded-lg text-gray-400 dark:text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900 transition-colors"
                                    title={t("groups.actions.edit")}
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(g)}
                                    className="p-1.5 rounded-lg text-gray-400 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 transition-colors"
                                    title={t("groups.actions.delete")}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center p-12">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900">
                      <Layers className="h-8 w-8 text-indigo-600 dark:text-indigo-300" />
                    </div>
                    <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">{t("groups.noResults")}</h3>
                    <p className="mt-1 text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                      No groups found. Create your first group to get started.
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={openCreateModal}
                        className="px-4 py-2.5 text-sm font-medium rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
                      >
                        <Plus size={18} />
                        <span>{t("groups.newGroup")}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {filteredGroups.length > 0 ? (
                  filteredGroups.map((g, idx) => (
                    <div 
                      key={g.id} 
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden group-card"
                      style={{ "--delay": `${idx * 40}ms` }}
                    >
                      <div 
                        className="p-4 flex justify-between items-start cursor-pointer"
                        onClick={() => toggleGroupExpand(g.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <AuthenticatedImage
                            src={g.profilePicture}
                            alt={g.name}
                            fallbackName={g.name}
                            fallbackSeed={g.name || "group"}
                            className="w-12 h-12 rounded-full object-cover border border-gray-100 dark:border-gray-600"
                            fallbackClassName="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-base bg-gradient-to-br from-indigo-500 to-indigo-600"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white truncate">{g.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{g.memberCount || 0} members</p>
                          </div>
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 transition-transform duration-300">
                          <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${
                            expandedGroup === g.id 
                              ? "transform rotate-180 text-indigo-600 dark:text-indigo-400" 
                              : ""
                          }`} />
                        </div>
                      </div>
                      <div 
                        className={`px-4 pb-4 pt-0 overflow-hidden transition-[max-height] duration-300 ${
                          expandedGroup === g.id ? "max-h-[1000px]" : "max-h-0"
                        }`}
                      >
                        <p className="text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3">
                          <span className="font-medium">Description:</span> {g.description || t("groups.noDescription")}
                        </p>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-3">
                          <div className="flex flex-col gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-700 dark:text-gray-300">Created:</span>
                              <span className="text-gray-500 dark:text-gray-400">{formatDate(g.createdAt)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-700 dark:text-gray-300">Updated:</span>
                              <span className="text-gray-500 dark:text-gray-400">{formatDate(g.updatedAt)}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3 sm:mt-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); openMembersModal(g); }}
                              className="p-2 rounded-lg text-gray-400 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
                              title={t("groups.actions.members")}
                            >
                              <Users size={18} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditModal(g); }}
                              className="p-2 rounded-lg text-gray-400 dark:text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900 transition-colors"
                              title={t("groups.actions.edit")}
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteClick(g); }}
                              className="p-2 rounded-lg text-gray-400 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 transition-colors"
                              title={t("groups.actions.delete")}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
                    <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-xl bg-indigo-100 dark:bg-indigo-900">
                      <Layers className="h-7 w-7 text-indigo-600 dark:text-indigo-300" />
                    </div>
                    <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">{t("groups.noResults")}</h3>
                    <p className="mt-1 text-gray-500 dark:text-gray-400 px-2 max-w-md mx-auto">
                      No groups found. Create your first group to get started.
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={openCreateModal}
                        className="w-full px-4 py-2.5 text-sm font-medium rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                      >
                        <Plus size={18} />
                        <span>{t("groups.newGroup")}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
      {/* --- Modals --- */}
      {isModalOpen && (
        <ModalTransitionWrapper onClose={closeModal}>
          <GroupFormModal group={currentGroup} onSave={handleSaveGroup} onClose={closeModal} t={t} />
        </ModalTransitionWrapper>
      )}
      {isMembersModalOpen && currentGroup && (
        <ModalTransitionWrapper onClose={closeMembersModal}>
          <GroupMembers group={currentGroup} onClose={closeMembersModal} allUsers={allUsers} onUpdateMemberCount={handleUpdateMemberCount} t={t} />
        </ModalTransitionWrapper>
      )}
      {showDeleteConfirmModal && groupToDelete && (
        <ModalTransitionWrapper onClose={cancelDelete}>
          <DeleteConfirmModal 
            group={groupToDelete} 
            onConfirm={confirmDelete} 
            onClose={cancelDelete} 
            submitting={submitting} 
            t={t} 
          />
        </ModalTransitionWrapper>
      )}
            {/* --- Toast --- */}
      {toast && (
        <div className="fixed z-50 right-4 bottom-4">
          <div className="animate-fade-in">
            {/* pass message prop and children as fallback */}
            <Toast
              message={toast.message || toast.text}
              text={toast.text}
              type={toast.type}
              onClose={handleToastClose}
            >
              {toast.message || toast.text}
            </Toast>
          </div>
        </div>
      )}

    </div>
  );
}

export default GroupsManager;