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
} from "lucide-react";
import { fetchGroups, createGroup, updateGroup, deleteGroup } from "../api/groups";
import { addUserToGroup, removeUserFromGroup, fetchGroupUsers } from "../api/userGroups";
import { fetchUsers } from "../api/admin";
import Toast from "../components/common/Toast";
import { rawFetch } from "../api/auth"; // used for FormData upload
import AuthenticatedImage from "../components/common/AuthenticatedImage"; 

/* Helpers for avatar fallback (Unchanged) */
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
### 1. Modal Transition Wrapper (Unchanged)
Handles the fade and scale transition for any modal content.
--------------------------*/
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
      className={`fixed inset-0 bg-black/50 dark:bg-black/60 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
        isAnimating ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose} 
    >
      <div 
        className={`w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-auto max-h-[92vh] transition-all duration-300 ${
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


/* -------------------------
### 2. Group Form Modal (Refactored)
Component logic remains inside, but is now clearly separated.
--------------------------*/
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
    <>
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
          {group ? t("groups.form.title.edit") : t("groups.form.title.create")}
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-transform duration-300 hover:rotate-90"
          aria-label={t("groups.form.close")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-start">
          <div className="col-span-1 flex flex-col items-center">
            
            {profilePicturePreview ? (
              <img
                src={profilePicturePreview}
                alt="preview"
                className="w-28 h-28 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700 mb-3"
              />
            ) : (
              <AuthenticatedImage
                src={originalPictureUrl}
                alt={name || group?.name || ""}
                fallbackName={name || group?.name}
                fallbackSeed={name || group?.name || "group"}
                className="w-28 h-28 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700 mb-3"
                fallbackClassName="w-28 h-28 rounded-full flex items-center justify-center text-white font-semibold text-xl mb-3"
              />
            )}

            <div className="mt-3 flex items-center gap-3">
              <input id="group-picture-input" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <label
                htmlFor="group-picture-input"
                className="inline-flex items-center px-3 py-2 border rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 text-sm transition-transform duration-200 hover:scale-[1.02]"
              >
                {t("groups.form.buttons.uploadPicture") || "Upload picture"}
              </label>
              {(profilePicturePreview || originalPictureUrl) && (
                <button 
                  type="button" 
                  onClick={removePreview} 
                  className="text-sm text-red-600 dark:text-red-400 transition-colors hover:text-red-700 dark:hover:text-red-300"
                >
                  {t("groups.form.buttons.remove")}
                </button>
              )}
            </div>

            {errors.file && <p className="text-xs text-red-500 mt-2">{errors.file}</p>}
          </div>

          <div className="col-span-2 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("groups.form.labels.name")}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 transition-shadow ${
                  errors.name ? "border-red-500" : "border-gray-300"
                }`}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
              />
              {errors.name && <p id="name-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("groups.form.labels.description")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows="4"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 transition-shadow ${
                  errors.description ? "border-red-500" : "border-gray-300"
                }`}
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? "description-error" : undefined}
              />
              {errors.description && <p id="description-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description}</p>}
            </div>
          </div>
        </div>

        {errors.submit && <p className="text-sm text-red-600">{errors.submit}</p>}

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors hover:shadow-sm"
          >
            {t("groups.form.buttons.cancel")}
          </button>
          <button 
            type="submit" 
            disabled={isLoading} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm disabled:opacity-60 transition-transform duration-200 hover:scale-[1.02] focus:ring-4 focus:ring-blue-500/50"
          >
            {isLoading ? t("groups.form.buttons.saving") : group ? t("groups.form.buttons.save") : t("groups.form.buttons.create")}
          </button>
        </div>
      </form>
    </>
  );
};


/* -------------------------
### 3. Group Members Modal (Refactored)
Component logic remains inside, but is now clearly separated.
--------------------------*/
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
    <>
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
          {t("groups.members.title.manage")} — <span className="font-medium text-gray-700 dark:text-gray-300 ml-2">{group.name}</span>
        </h2>
        <button 
          onClick={onClose} 
          className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-transform duration-300 hover:rotate-90" 
          aria-label={t("groups.form.close")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3">{t("groups.members.add.title")}</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg bg-white dark:bg-gray-600 dark:text-white border-gray-300 dark:border-gray-600 transition-shadow focus:shadow-md"
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-60 transition-transform duration-200 hover:scale-[1.02] focus:ring-4 focus:ring-blue-500/50"
              aria-label={t("groups.members.add.button")}
            >
              <Users className="h-4 w-4" />
              <span className="text-sm">{isAdding ? t("groups.members.add.adding") : t("groups.members.add.button")}</span>
            </button>
          </div>
          {availableUsers.length === 0 && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("groups.members.add.noAvailable")}</p>}
        </div>

        <div>
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3">{t("groups.members.current.title", { count: members.length })}</h3>

          {isLoading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">{t("groups.members.current.empty")}</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
              {members.map((member) => (
                <li 
                  key={member.id} 
                  className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-sm hover:translate-x-0.5"
                >
                  <div className="flex items-center gap-3">
                    <AuthenticatedImage
                      src={member.profilePicture}
                      alt={member.name}
                      fallbackName={member.name}
                      fallbackUsername={member.username}
                      fallbackSeed={member.name || member.username}
                      className="w-8 h-8 rounded-full object-cover"
                      fallbackClassName="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs"
                    />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{member.username}</p>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={isRemoving === member.id}
                      className="p-2 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 transition-transform duration-200 hover:scale-110"
                      title={t("groups.members.remove.title")}
                      aria-label={t("groups.members.remove.title")}
                    >
                      {isRemoving === member.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" /> : <Users className="h-5 w-5" />}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};


/* -------------------------
### 4. Delete Confirmation Modal (Refactored)
A simple component to pass to the ModalTransitionWrapper.
--------------------------*/
const DeleteConfirmModal = ({ group, onConfirm, onClose, submitting, t }) => (
    <div className="p-6 space-y-4 ">
<div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30">
                <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>        <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">{t("groups.confirmDeleteTitle")}</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 text-center">
          {t("groups.confirmDeleteMessage", { groupName: group?.name })}
        </p>
        <div className="flex justify-center gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full"
          >
            {t("admin.actions.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm disabled:opacity-60 flex items-center gap-2 transition-transform duration-200 hover:scale-[1.02] w-full justify-center"
          >
            {submitting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Trash2 className="h-4 w-4" />}
            <span>{t("admin.actions2.delete")}</span>
          </button>
        </div>
    </div>
);


/* -------------------------
### 5. Main GroupsManager (Refactored)
All modal rendering logic is replaced with the extracted components and wrapper.
--------------------------*/
function GroupsManager() {
  const { t, i18n } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState(null); // Unchanged
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Unchanged Toast logic
  const showToast = useCallback((text, semanticType = "success") => {
    const map = {
      success: "create",
      info: "read",
      update: "update",
      delete: "delete",
      error: "error",
    };
    const tType = map[semanticType] || semanticType || "create";
    setToast({ text, type: tType });
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

  // --- Modal Handlers ---

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

  // --- Filtering/Sorting Logic (Unchanged) ---
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

  // --- Main Render ---

  return (
    <>
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="pt-6 pb-4">
          <div className="">
            <div className="flex items-center justify-between">
              <div className="flex items-center min-w-0 gap-4">
                <div className="p-3 rounded-lg bg-gray-200 dark:bg-gray-900">
                  <Layers className="h-6 w-6 text-sky-600 dark:text-sky-300" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight truncate">
                    {t("groups.title")}
                  </h1>
                  <p className="mt-1 text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-2xl">
                    {t("groups.subtitle")}
                  </p>
                </div>
              </div>
              <div>
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base shadow-sm transition-transform duration-200 hover:scale-[1.02] focus:ring-4 focus:ring-blue-500/50"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t("groups.newGroup")}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="relative w-full sm:max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder={t("groups.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-shadow focus:shadow-md"
                  aria-label={t("groups.searchAria")}
                />
              </div>
            </div>
          </div>
        </header>

        <main>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 sm:p-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">{t("groups.loading")}</p>
              </div>
            ) : (
              <>
                {/* Desktop wide table (lg+) */}
                <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th onClick={() => requestSort("name")} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer">{t("groups.table.name")}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t("groups.table.description")}</th>
                        <th onClick={() => requestSort("memberCount")} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer">{t("groups.table.members")}</th>
                        <th onClick={() => requestSort("createdAt")} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer">{t("groups.table.created")}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t("groups.table.updated")}</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t("groups.table.actions")}</th>
                      </tr>
                    </thead>

                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredGroups.length > 0 ? (
                        filteredGroups.map((g) => (
                          <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 group"> 
                            <td className="px-4 py-4 font-medium text-gray-900 dark:text-white flex items-center gap-3">
                              <AuthenticatedImage
                                src={g.profilePicture}
                                alt={g.name}
                                fallbackName={g.name}
                                fallbackSeed={g.name || "group"}
                                className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-700"
                                fallbackClassName="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                              />
                              <span className="truncate max-w-xs">{g.name}</span>
                            </td>

                            <td className="px-4 py-4 text-gray-500 dark:text-gray-400 max-w-sm truncate">{g.description || t("groups.noDescription")}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{g.memberCount || 0}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(g.createdAt)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(g.updatedAt)}</td>

                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => openMembersModal(g)}
                                  className="p-2 rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-transform duration-200 hover:scale-110"
                                  title={t("groups.actions.members")}
                                >
                                  <Users className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() => openEditModal(g)}
                                  className="p-2 rounded-full text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-transform duration-200 hover:scale-110"
                                  title={t("groups.actions.edit")}
                                >
                                  <Edit className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(g)}
                                  className="p-2 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-transform duration-200 hover:scale-110"
                                  title={t("groups.actions.delete")}
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                            {t("groups.noResults")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile/Tablet Card View (lg-) */}
                <div className="lg:hidden space-y-4">
                  {filteredGroups.length > 0 ? (
                    filteredGroups.map((g) => (
                      <div 
                        key={g.id} 
                        className="bg-white dark:bg-gray-800 rounded-lg shadow transition-all duration-200 hover:shadow-lg hover:translate-y-[-2px] overflow-hidden" 
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
                              className="w-12 h-12 rounded-full object-cover"
                              fallbackClassName="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 dark:text-white truncate">{g.name}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {g.memberCount || 0} {t("groups.membersCount")}
                              </p>
                            </div>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {expandedGroup === g.id ? t("groups.actions.collapse") : t("groups.actions.expand")}
                          </div>
                        </div>

                        <div 
                            className={`px-4 pb-4 pt-0 transition-[max-height] ease-in-out duration-300 overflow-hidden ${
                                expandedGroup === g.id ? "max-h-[1000px]" : "max-h-0"
                            }`}
                        >
                            <p className="text-sm text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
                              <span className="font-medium">{t("groups.table.description")}:</span> {g.description || t("groups.noDescription")}
                            </p>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-3">
                              <button
                                onClick={(e) => { e.stopPropagation(); openMembersModal(g); }}
                                className="p-2 rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-transform duration-200 hover:scale-110"
                                title={t("groups.actions.members")}
                              >
                                <Users className="h-5 w-5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); openEditModal(g); }}
                                className="p-2 rounded-full text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-transform duration-200 hover:scale-110"
                                title={t("groups.actions.edit")}
                              >
                                <Edit className="h-5 w-5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteClick(g); }}
                                className="p-2 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-transform duration-200 hover:scale-110"
                                title={t("groups.actions.delete")}
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-10 text-center text-gray-500 dark:text-gray-400">
                      {t("groups.noResults")}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
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

      {/* --- Toast (Unchanged) --- */}
      {toast && <Toast text={toast.text} type={toast.type} onClose={handleToastClose} />}
    </>
  );
}

export default GroupsManager;