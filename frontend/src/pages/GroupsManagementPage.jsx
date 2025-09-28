// src/pages/GroupsManager.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Search,
  Users,
  ChevronDown,
  ChevronUp,
  UserPlus,
  UserMinus,
  Layers,
} from "lucide-react";
import { fetchGroups, createGroup, updateGroup, deleteGroup } from "../api/groups";
import { addUserToGroup, removeUserFromGroup, fetchGroupUsers } from "../api/userGroups";
import { fetchUsers } from "../api/admin";
import Toast from "../components/common/Toast";
import { rawFetch } from "../api/auth"; // used for FormData upload similar to settings

/* Helpers for avatar fallback */
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
   Group form modal
   - improved spacing & typography
--------------------------*/
const GroupFormModal = ({ group, onSave, onClose, t }) => {
  const [name, setName] = useState(group?.name || "");
  const [description, setDescription] = useState(group?.description || "");
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => {
    setName(group?.name || "");
    setDescription(group?.description || "");
    setProfilePictureFile(null);
    setProfilePicturePreview(null);
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // If a file is provided, build FormData and pass it to parent
      if (profilePictureFile) {
        const fd = new FormData();
        fd.append("profilePicture", profilePictureFile);
        fd.append("name", name.trim());
        fd.append("description", description.trim() || "");
        // Parent will detect FormData and call correct endpoint (POST/PUT) with multipart
        await onSave(fd);
      } else {
        // No file: use plain JSON payload (backwards-compatible)
        const payload = {
          name: name.trim(),
          description: description.trim() || null,
        };
        await onSave(payload);
      }
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

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-auto max-h-[92vh]">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
            {group ? t("groups.form.title.edit") : t("groups.form.title.create")}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
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
              ) : group?.profilePicture ? (
                <img
                  src={group.profilePicture}
                  alt={group.name}
                  className="w-28 h-28 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700 mb-3"
                />
              ) : (
                <div
                  className="w-28 h-28 rounded-full flex items-center justify-center text-white font-semibold text-xl"
                  style={{ background: gradientFromString(name || group?.name || "group") }}
                >
                  {initialsFromName(name || group?.name || "", "")}
                </div>
              )}

              <div className="mt-3 flex items-center gap-3">
                <input id="group-picture-input" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                <label
                  htmlFor="group-picture-input"
                  className="inline-flex items-center px-3 py-2 border rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
                >
                  {t("groups.form.buttons.uploadPicture") || "Upload picture"}
                </label>
                {profilePicturePreview && (
                  <button type="button" onClick={removePreview} className="text-sm text-red-600 dark:text-red-400">
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
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 ${
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
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 ${
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
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              {t("groups.form.buttons.cancel")}
            </button>
            <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm disabled:opacity-60">
              {isLoading ? t("groups.form.buttons.saving") : group ? t("groups.form.buttons.save") : t("groups.form.buttons.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* -------------------------
   Group members modal
   - clearer layout + responsive lists
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
    <div className="fixed inset-0 bg-black/50 dark:bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-auto max-h-[92vh]">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
            {t("groups.members.title.manage")} — <span className="font-medium text-gray-700 dark:text-gray-300 ml-2">{group.name}</span>
          </h2>
          <button onClick={onClose} className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label={t("groups.form.close")}>
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
                className="flex-1 px-3 py-2 border rounded-lg bg-white dark:bg-gray-600 dark:text-white border-gray-300 dark:border-gray-600"
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-60"
                aria-label={t("groups.members.add.button")}
              >
                <UserPlus className="h-4 w-4" />
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
                  <li key={member.id} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{member.username}</p>
                    </div>
                    <div>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={isRemoving === member.id}
                        className="p-2 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60"
                        title={t("groups.members.remove.title")}
                        aria-label={t("groups.members.remove.title")}
                      >
                        {isRemoving === member.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" /> : <UserMinus className="h-5 w-5" />}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------
   Main GroupsManager
   - improved header, responsive grid, typography
--------------------------*/
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

  const showToast = useCallback((text, type = "success") => {
    setToast({ text, type });
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

  const handleSaveGroup = useCallback(
    async (groupData) => {
      try {
        // If caller passed FormData (file upload), use rawFetch directly and send multipart
        if (groupData instanceof FormData) {
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

          // parse response if needed
          await resp.json().catch(() => null);
          showToast(currentGroup ? t("groups.messages.updated") : t("groups.messages.created"), "success");
        } else {
          // plain JSON path
          if (currentGroup) {
            await updateGroup(currentGroup.id, groupData);
            showToast(t("groups.messages.updated"), "success");
          } else {
            await createGroup(groupData);
            showToast(t("groups.messages.created"), "success");
          }
        }

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

  const handleUpdateMemberCount = useCallback((groupId, newCount) => {
    setGroups((prevGroups) => prevGroups.map((g) => (g.id === groupId ? { ...g, memberCount: newCount } : g)));
  }, []);

  const handleDeleteGroup = useCallback(
    async (id) => {
      if (!window.confirm(t("groups.confirmDelete"))) return;
      try {
        await deleteGroup(id);
        await loadData();
        showToast(t("groups.messages.deleted"), "success");
      } catch (err) {
        console.error("Error deleting group:", err);
        showToast(t("groups.messages.deleteFailed"), "error");
      }
    },
    [loadData, showToast, t]
  );

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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base shadow-sm transition"
              >
                <Plus className="h-4 w-4" />
                <span>{t("groups.newGroup")}</span>
              </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-3">
                <div className="text-sm text-gray-500 dark:text-gray-400"> {/* placeholder for possible switch / filters */}</div>
              </div>

            </div>
          </div>

          {/* search row - placed separately so on very small screens it wraps under title */}
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
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  aria-label={t("groups.searchAria")}
                />
              </div>

              <div className="flex items-center gap-3">
                {/* Small quick actions could be added here */}
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
                        <th
                          onClick={() => requestSort("name")}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                        >
                          {t("groups.table.name")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t("groups.table.description")}
                        </th>
                        <th
                          onClick={() => requestSort("memberCount")}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                        >
                          {t("groups.table.members")}
                        </th>
                        <th
                          onClick={() => requestSort("createdAt")}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                        >
                          {t("groups.table.created")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t("groups.table.updated")}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t("groups.table.actions")}
                        </th>
                      </tr>
                    </thead>

                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredGroups.length > 0 ? (
                        filteredGroups.map((g) => (
                          <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <td className="px-4 py-4 font-medium text-gray-900 dark:text-white flex items-center gap-3">
                              {g.profilePicture ? (
                                <img src={g.profilePicture} alt={g.name} className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-700" />
                              ) : (
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: gradientFromString(g.name || "group") }}>
                                  {initialsFromName(g.name || "", "")}
                                </div>
                              )}
                              <span className="truncate max-w-xs">{g.name}</span>
                            </td>

                            <td className="px-4 py-4 text-gray-500 dark:text-gray-400 max-w-sm truncate">{g.description || t("groups.noDescription")}</td>

                            <td className="px-4 py-4 text-gray-500 dark:text-gray-400">
                              <button onClick={() => openMembersModal(g)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-sm">
                                {t("groups.members.linkText", { count: g.memberCount || 0 })}
                              </button>
                            </td>

                            <td className="px-4 py-4 text-gray-500 dark:text-gray-400">{formatDate(g.createdAt)}</td>
                            <td className="px-4 py-4 text-gray-500 dark:text-gray-400">{formatDate(g.updatedAt)}</td>

                            <td className="px-4 py-4 text-right space-x-2">
                              <button onClick={() => openEditModal(g)} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-2 rounded-md" aria-label={t("groups.actions.edit")}>
                                <Edit className="h-5 w-5" />
                              </button>
                              <button onClick={() => handleDeleteGroup(g.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-2 rounded-md" aria-label={t("groups.actions.delete")}>
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                            {t("groups.noResults")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Tablet / small-desktop list (md..lg) */}
                <div className="hidden md:block lg:hidden space-y-4">
                  {filteredGroups.length > 0 ? (
                    filteredGroups.map((g) => (
                      <div key={g.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            {g.profilePicture ? (
                              <img src={g.profilePicture} alt={g.name} className="w-12 h-12 rounded-full object-cover border border-gray-100 dark:border-gray-700" />
                            ) : (
                              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: gradientFromString(g.name || "group") }}>
                                {initialsFromName(g.name || "", "")}
                              </div>
                            )}

                            <div className="min-w-0">
                              <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">{g.name}</h3>
                              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{g.description || t("groups.noDescription")}</p>

                              <div className="mt-3 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                <Users className="h-4 w-4" />
                                <button onClick={() => openMembersModal(g)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline">
                                  {t("groups.members.linkText", { count: g.memberCount || 0 })}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-start gap-2">
                            <button onClick={() => openEditModal(g)} className="p-2 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30" aria-label={t("groups.actions.edit")}>
                              <Edit className="h-5 w-5" />
                            </button>
                            <button onClick={() => handleDeleteGroup(g.id)} className="p-2 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30" aria-label={t("groups.actions.delete")}>
                              <Trash2 className="h-5 w-5" />
                            </button>
                            <button onClick={() => toggleGroupExpand(g.id)} className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label={t("groups.actions.toggle")}>
                              
                            </button>
                          </div>
                        </div>

                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">{t("groups.createdPrefix")}</span> <span className="ml-1">{formatDate(g.createdAt)}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">{t("groups.updatedPrefix")}</span> <span className="ml-1">{formatDate(g.updatedAt)}</span>
                              </div>
                            </div>
                          </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
                      <p className="text-gray-500 dark:text-gray-400 mb-4">{t("groups.noResults")}</p>
                      <button onClick={openCreateModal} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg">
                        <Plus className="h-4 w-4" />
                        <span>{t("groups.newGroup")}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-4">
                  {filteredGroups.length > 0 ? (
                    filteredGroups.map((g) => (
                      <div key={g.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {g.profilePicture ? (
                              <img src={g.profilePicture} alt={g.name} className="w-12 h-12 rounded-full object-cover border border-gray-100 dark:border-gray-700" />
                            ) : (
                              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: gradientFromString(g.name || "group") }}>
                                {initialsFromName(g.name || "", "")}
                              </div>
                            )}

                            <div className="min-w-0">
                              <h3 className="font-medium text-gray-900 dark:text-white truncate">{g.name}</h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{g.description || t("groups.noDescription")}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button onClick={() => openEditModal(g)} className="p-2 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30" aria-label={t("groups.actions.edit")}>
                              <Edit className="h-5 w-5" />
                            </button>
                            <button onClick={() => handleDeleteGroup(g.id)} className="p-2 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30" aria-label={t("groups.actions.delete")}>
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                          <span>
                            <span className="font-medium">{g.memberCount || 0}</span> {t("groups.members.label")}
                          </span>
                          <button onClick={() => openMembersModal(g)} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                            {t("groups.members.manage")}
                          </button>
                        </div>

                        <div className="flex gap-11">
                          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("groups.createdPrefix")} {formatDate(g.createdAt)}</div>
                        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("groups.updatedPrefix")} {formatDate(g.updatedAt)}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
                      <p className="text-gray-500 dark:text-gray-400 mb-4">{t("groups.noResults")}</p>
                      <button onClick={openCreateModal} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg">
                        <Plus className="h-4 w-4" />
                        <span>{t("groups.newGroup")}</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {isModalOpen && <GroupFormModal group={currentGroup} onSave={handleSaveGroup} onClose={closeModal} t={t} />}

          {isMembersModalOpen && currentGroup && (
            <GroupMembers group={currentGroup} onClose={closeMembersModal} allUsers={allUsers} onUpdateMemberCount={handleUpdateMemberCount} t={t} />
          )}

          {toast && <Toast message={toast.text} type={toast.type} onClose={handleToastClose} />}
        </main>
      </div>
    </>
  );
}

export default GroupsManager;
