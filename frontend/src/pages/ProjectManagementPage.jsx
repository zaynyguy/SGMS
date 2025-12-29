import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import TopBar from "../components/layout/TopBar";
import useProjectApi from "../hooks/useProjectApi";
import GoalCard from "../components/project/GoalCard";
import PaginationFooter from "../components/project/PaginationFooter";
import GenericModal from "../components/project/GenericModal";
import SubmitReportModal from "../components/SubmitReportModal";
import { Target, ArrowUpDown, RefreshCcw, Plus, Search } from "lucide-react";
import SkeletonCard from "../components/ui/SkeletonCard";
import Toast from "../components/common/Toast";

/* Confirm modal component with MD3 styling */
function ConfirmModal({
  open,
  title,
  message,
  onCancel,
  onConfirm,
  loading,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  t,
}) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setIsMounted(true));
    } else {
      setIsMounted(false);
    }
  }, [open]);
  if (!open) return null;
  return (
    <div
      className={`fixed inset-0 bg-[var(--scrim)]/[.32] dark:bg-gray-900/[.8] flex items-center justify-center p-4 z-50 transition-opacity duration-300 ${
        isMounted ? "opacity-100" : "opacity-0"
      }`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
    >
      <div className="bg-[var(--surface-container-lowest)] dark:bg-gray-800 rounded-2xl p-5 w-full max-w-md surface-elevation-3">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-[var(--error-container)] dark:bg-red-900 flex items-center justify-center">
            <svg
              className="h-6 w-6 text-[var(--on-error-container)] dark:text-red-200"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M12 9v4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              ></path>
              <path
                d="M12 17h.01"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              ></path>
            </svg>
          </div>
        </div>
        <h3
          id="confirm-modal-title"
          className="text-xl font-bold text-[var(--on-surface)] dark:text-white text-center mb-2"
        >
          {title}
        </h3>
        <p
          id="confirm-modal-desc"
          className="text-base text-[var(--on-surface-variant)] dark:text-gray-400 text-center mb-6"
        >
          {message}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-3 text-base font-medium rounded-xl border border-[var(--outline-variant)] dark:border-gray-600 text-[var(--on-surface)] dark:text-white hover:bg-[var(--surface-container-low)] dark:hover:bg-gray-700 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-3 text-base font-medium rounded-xl bg-[var(--error)] dark:bg-red-700 text-[var(--on-error)] dark:text-white hover:bg-[color-mix(in_srgb,var(--error),white_10%)] dark:hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-transparent border-t-[var(--on-error)] dark:border-t-white rounded-full mr-2 animate-spin"></div>
                <span>
                  {(t && t("project.actions.deleting")) || "Deleting..."}
                </span>
              </>
            ) : (
              <span>{confirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectManagement() {
  const { t } = useTranslation();
  const { user } = useAuth();

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
    background: "#FCFDF7",
    onBackground: "#1A1C19",
    surface: "#FCFDF7",
    onSurface: "#1A1C19",
    surfaceVariant: "#DDE4D9",
    onSurfaceVariant: "#414941",
    outline: "#717970",
    outlineVariant: "#C1C9C0",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#2E312E",
    inverseOnSurface: "#F0F2EC",
    inversePrimary: "#77D8B8",
    surfaceContainerLowest: "#FFFFFF",
    surfaceContainerLow: "#F8F9F4",
    surfaceContainer: "#F2F4EF",
    surfaceContainerHigh: "#ECF0E8",
    surfaceContainerHighest: "#E6EAE2",
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

  // page-level UI state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedGoal, setExpandedGoal] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [currentQuarter, setCurrentQuarter] = useState(0);
  const [modal, setModal] = useState({ isOpen: false, type: null, data: null });
  const [submitModal, setSubmitModal] = useState({
    isOpen: false,
    data: null,
  });
  const [canManageGTA, setCanManageGTA] = useState(false);
  const [canViewGTA, setCanViewGTA] = useState(false);
  const [canSubmitReport, setCanSubmitReport] = useState(false);
  // Animation states
  const [isMounted, setIsMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Toast
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "create") => {
    setToast({ message, type });
  }, []);
  // Sorting
  const [sortKey, setSortKey] = useState(() => {
    try {
      return localStorage.getItem("projects.sortKey") || "rollNo";
    } catch {
      return "rollNo";
    }
  });
  const [sortOrder, setSortOrder] = useState(() => {
    try {
      return localStorage.getItem("projects.sortOrder") || "asc";
    } catch {
      return "asc";
    }
  });
  // --- Use the Project API Hook ---
  const api = useProjectApi({
    initialPage: currentPage,
    initialSize: pageSize,
  });
  const {
    groups,
    goals,
    tasks,
    activities,
    isLoadingGoals,
    tasksLoading,
    activitiesLoading,
    reportingActive,
    error: apiError,
    success: apiSuccess,
    isSubmitting,
    loadGoals,
    loadTasks,
    loadActivities,
    createGoalItem,
    updateGoalItem,
    deleteGoalItem,
    createTaskItem,
    updateTaskItem,
    deleteTaskItem,
    createActivityItem,
    updateActivityItem,
    deleteActivityItem,
    submitReportForActivity,
    setActivities,
    setTasks,
  } = api;
  // Mount animation
  useEffect(() => {
    requestAnimationFrame(() => setIsMounted(true));
  }, []);
  /* ----------------- Permissions ----------------- */
  useEffect(() => {
    if (!user) {
      setCanManageGTA(false);
      setCanViewGTA(false);
      setCanSubmitReport(false);
      return;
    }
    const perms = Array.isArray(user?.permissions)
      ? user.permissions
      : user?.user?.permissions || [];
    setCanManageGTA(perms.includes("manage_gta"));
    setCanViewGTA(perms.includes("view_gta") || perms.includes("manage_gta"));
    const submitPermNames = [
      "submit_report",
      "SubmitReport",
      "submitReport",
      "submit_reports",
    ];
    const hasSubmit = submitPermNames.some((p) => perms.includes(p));
    setCanSubmitReport(hasSubmit);
  }, [user]);
  /* ----------------- Load initial data ----------------- */
  useEffect(() => {
    loadGoals({ page: currentPage, pageSize }).catch((e) => {
      console.error("loadGoals error:", e);
      showToast(e?.message || t("project.errors.loadGoals"), "error");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, loadGoals]);
  /* ----------------- Show toasts on API success/error ----------------- */
  useEffect(() => {
    if (apiError) {
      showToast(apiError, "error");
    }
  }, [apiError, showToast]);
  useEffect(() => {
    if (apiSuccess) {
      showToast(apiSuccess, "create");
    }
  }, [apiSuccess, showToast]);
  /* ----------------- Persist sort preferences ----------------- */
  useEffect(() => {
    try {
      localStorage.setItem("projects.sortKey", sortKey);
      localStorage.setItem("projects.sortOrder", sortOrder);
    } catch {
      // ignore
    }
  }, [sortKey, sortOrder]);
  // When quarter changes, clear loaded data to force a refetch
  useEffect(() => {
    if (setActivities) setActivities({});
    if (setTasks) setTasks({}); // Also clear tasks
    // And collapse any open items
    setExpandedTask(null);
    setExpandedGoal(null); // Also collapse goals
  }, [currentQuarter, setActivities, setTasks]);
  /* ----------------- Toggle UI helpers ----------------- */
  const toggleGoal = useCallback(
    async (goal) => {
      if (expandedGoal === goal.id) {
        setExpandedGoal(null);
      } else {
        setExpandedGoal(goal.id);
        setSelectedGoal(goal);
        // Pass currentQuarter to loadTasks
        if (!tasks[goal.id]) {
          try {
            await loadTasks(goal.id, currentQuarter);
          } catch (err) {
            console.error(err);
          }
        }
      }
    },
    [expandedGoal, tasks, loadTasks, currentQuarter] // Add currentQuarter
  );
  const toggleTask = useCallback(
    async (goal, task) => {
      if (expandedTask === task.id) {
        setExpandedTask(null);
      } else {
        setExpandedTask(task.id);
        // Pass currentQuarter to loadActivities
        if (!activities[task.id]) {
          try {
            await loadActivities(task.id, currentQuarter);
          } catch (err) {
            console.error(err);
          }
        }
      }
    },
    [expandedTask, activities, loadActivities, currentQuarter] // Add currentQuarter
  );
  /* ----------------- Confirm modal state for deletes ----------------- */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null); 
  const [deleting, setDeleting] = useState(false);
  /* ----------------- CRUD wrappers that call api hook ----------------- */
  const handleCreateGoal = useCallback(
    async (payload) => {
      try {
        await createGoalItem(payload);
        setModal({ isOpen: false, type: null, data: null });
        await loadGoals({ page: 1 });
      } catch (err) {
        console.error("createGoal error:", err);
      }
    },
    [createGoalItem, loadGoals]
  );
  const handleUpdateGoal = useCallback(
    async (goalId, payload) => {
      try {
        await updateGoalItem(goalId, payload);
        setModal({ isOpen: false, type: null, data: null });
        await loadGoals();
      } catch (err) {
        console.error("updateGoal error:", err);
      }
    },
    [updateGoalItem, loadGoals]
  );
  const handleDeleteGoal = useCallback(
    (goalId) => {
      const goal = (goals || []).find((g) => String(g.id) === String(goalId)) || null;
      setToDelete({
        type: "goal",
        goalId,
        name: goal?.title || goal?.name || "",
      });
      setConfirmOpen(true);
    },
    [goals]
  );
  const handleCreateTask = useCallback(
    async (goalId, payload) => {
      try {
        await createTaskItem(goalId, payload);
        setModal({ isOpen: false, type: null, data: null });
        await loadTasks(goalId, currentQuarter);
        await loadGoals();
      } catch (err) {
        console.error("createTask error:", err);
      }
    },
    [createTaskItem, loadTasks, loadGoals, currentQuarter] // Add currentQuarter
  );
  const handleUpdateTask = useCallback(
    async (goalId, taskId, payload) => {
      try {
        await updateTaskItem(goalId, taskId, payload);
        setModal({ isOpen: false, type: null, data: null });
        await loadTasks(goalId, currentQuarter);
        await loadGoals();
      } catch (err) {
        console.error("updateTask error:", err);
      }
    },
    [updateTaskItem, loadTasks, loadGoals, currentQuarter] // Add currentQuarter
  );
  const handleDeleteTask = useCallback(
    (goalId, taskId) => {
      const tasksForGoal = tasks?.[goalId] || [];
      const task =
        tasksForGoal.find((t) => String(t.id) === String(taskId)) || null;
      setToDelete({
        type: "task",
        goalId,
        taskId,
        name: task?.title || task?.name || "",
      });
      setConfirmOpen(true);
    },
    [tasks]
  );
  const handleCreateActivity = useCallback(
    async (goalId, taskId, payload) => {
      try {
        await createActivityItem(taskId, payload);
        setModal({ isOpen: false, type: null, data: null });
        await loadActivities(taskId, currentQuarter);
        await loadTasks(goalId, currentQuarter);
        await loadGoals();
      } catch (err) {
        console.error("createActivity error:", err);
      }
    },
    [createActivityItem, loadActivities, loadTasks, loadGoals, currentQuarter] // Add currentQuarter
  );
  const handleUpdateActivity = useCallback(
    async (goalId, taskId, activityId, payload) => {
      try {
        await updateActivityItem(taskId, activityId, payload);
        setModal({ isOpen: false, type: null, data: null });
        await loadActivities(taskId, currentQuarter);
        await loadTasks(goalId, currentQuarter);
        await loadGoals();
      } catch (err) {
        console.error("updateActivity error:", err);
      }
    },
    [updateActivityItem, loadActivities, loadTasks, loadGoals, currentQuarter] // Add currentQuarter
  );
  const handleDeleteActivity = useCallback(
    (goalId, taskId, activityId) => {
      const activitiesForTask = activities?.[taskId] || [];
      const activity =
        activitiesForTask.find((a) => String(a.id) === String(activityId)) ||
        null;
      setToDelete({
        type: "activity",
        goalId,
        taskId,
        activityId,
        name: activity?.title || activity?.name || "",
      });
      setConfirmOpen(true);
    },
    [activities]
  );
  /* Perform the confirmed delete (goal/task/activity) */
  const performDelete = useCallback(async () => {
    if (!toDelete || !toDelete.type) {
      setConfirmOpen(false);
      setToDelete(null);
      return;
    }
    setDeleting(true);
    try {
      if (toDelete.type === "goal") {
        await deleteGoalItem(toDelete.goalId || toDelete.id);
        await loadGoals(); // Full refresh
      } else if (toDelete.type === "task") {
        await deleteTaskItem(toDelete.goalId, toDelete.taskId);
        await loadTasks(toDelete.goalId, currentQuarter);
        await loadGoals();
      } else if (toDelete.type === "activity") {
        await deleteActivityItem(toDelete.taskId, toDelete.activityId);
        await loadActivities(toDelete.taskId, currentQuarter);
        await loadTasks(toDelete.goalId, currentQuarter);
        await loadGoals();
      }
    } catch (err) {
      console.error("delete error:", err);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setToDelete(null);
    }
  }, [
    toDelete,
    deleteGoalItem,
    deleteTaskItem,
    deleteActivityItem,
    loadGoals,
    loadTasks,
    loadActivities,
    currentQuarter, // Add currentQuarter
  ]);
  /* ----------------- Submit report ----------------- */
const openSubmitModal = useCallback(
  async (goalId, taskId, activityId) => {
    try {
      const localSafeParse = (v) => {
        if (v === null || v === undefined) return null;
        if (typeof v === "object") return v;
        if (typeof v === "string") {
          try { return v.trim() === "" ? null : JSON.parse(v); } catch { return v; }
        }
        return v;
      };
      let taskActivities = activities[taskId] || [];
      let activity = taskActivities.find((a) => String(a.id) === String(activityId));
      if (!activity) {
        try {
          const list = await loadActivities(taskId, currentQuarter);
          taskActivities = list || activities[taskId] || [];
          activity = taskActivities.find((a) => String(a.id) === String(activityId));
        } catch (err) {
          console.error("Failed to load activities inside openSubmitModal:", err);
        }
      }
      if (!activity) {
        showToast(t("project.errors.activityNotLoaded", "Activity details not loaded. Please expand the task or refresh and try again."), "error");
        return;
      }
      activity = {
        ...activity,
        targetMetric: localSafeParse(activity.targetMetric) ?? {},
        currentMetric: localSafeParse(activity.currentMetric) ?? {},
        quarterlyGoals: localSafeParse(activity.quarterlyGoals) ?? {},
      };
      const data = { goalId, taskId, activityId, activity, currentQuarter };
      setSubmitModal({ isOpen: true, data });
    } catch (err) {
      console.error("openSubmitModal error:", err);
      showToast(t("project.errors.unableOpenSubmit", "Unable to open submit modal."), "error");
    }
  },
  [activities, loadActivities, currentQuarter, showToast, t]
);
  const closeSubmitModal = useCallback(() => {
    setSubmitModal({ isOpen: false, data: null });
  }, []);
  const handleSubmitReport = useCallback(
    async (formState) => {
      const {
        activityId,
        metricsArray,
        narrative,
        newStatus,
        files,
        goalId,
        taskId,
        activity,
      } = formState;
      const targetMetric = activity?.targetMetric || {};
      const targetKeys = Object.keys(targetMetric);
      let allMetricsFilled = true;
      if (targetKeys.length > 0) {
        for (const key of targetKeys) {
          const found = metricsArray.find((m) => m.key === key);
          if (
            !found ||
            found.value === null ||
            found.value === undefined ||
            String(found.value).trim() === ""
          ) {
            allMetricsFilled = false;
            break;
          }
        }
      } else {
        allMetricsFilled = false;
      }
      let effectiveStatus = newStatus;
      if (allMetricsFilled && newStatus !== "Done") {
        effectiveStatus = "Done";
      }
      let metricsObj = null;
      if (Array.isArray(metricsArray) && metricsArray.length > 0) {
        metricsObj = {};
        metricsArray.forEach((m) => {
          if (m && String(m.key).trim() !== "") {
            metricsObj[String(m.key).trim()] = String(m.value ?? "").trim();
          }
        });
        if (Object.keys(metricsObj).length === 0) metricsObj = null;
      }
      const fd = new FormData();
      if (narrative) fd.append("narrative", narrative);
      if (metricsObj) fd.append("metrics_data", JSON.stringify(metricsObj));
      if (effectiveStatus) fd.append("new_status", effectiveStatus);
      if (files && files.length) {
        for (let i = 0; i < files.length; i += 1)
          fd.append("attachments", files[i]);
      }
      try {
        await submitReportForActivity(activityId, fd);
        closeSubmitModal();
        if (taskId) await loadActivities(taskId, currentQuarter);
        if (goalId) await loadTasks(goalId, currentQuarter);
        await loadGoals();
      } catch (err) {
        console.error("submitReport error:", err);
      }
    },
    [
      t,
      closeSubmitModal,
      showToast,
      submitReportForActivity,
      loadActivities,
      loadTasks,
      loadGoals,
      currentQuarter, // Add currentQuarter
    ]
  );
  /* ----------------- Filtered goals ----------------- */
  const filteredGoals = useMemo(() => {
    const q = String(searchTerm || "").trim().toLowerCase();
    return (goals || []).filter((g) => {
      if (!q) return true;
      return (
        (g.title || "").toLowerCase().includes(q) ||
        (g.description || "").toLowerCase().includes(q)
      );
    });
  }, [goals, searchTerm]);
  /* ----------------- Sorting ----------------- */
  const sortedGoals = useMemo(() => {
    const arr = Array.isArray(filteredGoals) ? [...filteredGoals] : [];
    const order = sortOrder === "asc" ? 1 : -1;
    const getVal = (g) => {
      if (sortKey === "created_at" || sortKey === "createdAt") {
        const v = g.created_at ?? g.createdAt ?? g.created ?? null;
        if (!v) return 0;
        const d = Date.parse(v);
        return Number.isNaN(d) ? 0 : d;
      }
      if (sortKey === "rollNo") {
        const raw = g.rollNo ?? g.roll_no ?? g.roll ?? null;
        if (raw === null || raw === undefined || String(raw).trim() === "")
          return Number.MAX_SAFE_INTEGER;
        const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
        return Number.isNaN(n) ? String(raw).toLowerCase() : n;
      }
      return String(g.title || "").toLowerCase();
    };
    arr.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * order;
      }
      if (String(va) < String(vb)) return -1 * order;
      if (String(va) > String(vb)) return 1 * order;
      return 0;
    });
    return arr;
  }, [filteredGoals, sortKey, sortOrder]);
  /* ----------------- Refresh with animation ----------------- */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (setActivities) setActivities({});
      if (setTasks) setTasks({});
      setExpandedTask(null);
      setExpandedGoal(null);
      await loadGoals({ page: currentPage, pageSize });
    } catch (err) {
      console.error("loadGoals error:", err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  }, [loadGoals, currentPage, pageSize, setActivities, setTasks]);
  /* ----------------- Render ----------------- */
  return (
    <div 
      className={`min-h-screen bg-[var(--background)] dark:bg-gray-900 font-sans transition-colors duration-300 ${
        isMounted ? 'opacity-100' : 'opacity-0'
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
      <div className="min-w-7xl mx-auto px-4 py-6">
        <header className="mb-6">
          {/* Header container with MD3 container styling */}
          <div className="md3-container dark:border-gray-700 surface-elevation-1">
            <div className="bg-[var(--surface-container-low)] dark:bg-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 py-4">
                <div className="flex min-w-0 gap-4 items-center">
                  <div className="md3-icon-container bg-green-200 dark:bg-indigo-900">
                    <Target className="h-6 w-6 text-green-800 dark:text-indigo-200 transition-transform duration-300 hover:scale-110" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-[var(--on-surface)] dark:text-white truncate">
                      {t("project.title")}
                    </h1>
                    <p className="mt-1 text-[var(--on-surface-variant)] dark:text-gray-400 max-w-2xl">
                      {t("project.subtitle")}
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
          {/* Controls container with MD3 styling */}
          <div className="mt-4 md3-card bg-[var(--surface-container-low)] dark:bg-gray-800 dark:border-gray-700 surface-elevation-3 p-5">
            <div className="space-y-4">
              {/* Row 1: Search and Actions */}
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                {/* Search Bar */}
                <div className="flex-1 w-full">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-[var(--on-surface-variant)] dark:text-gray-400" />
                    </div>
                    <input
                      type="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setCurrentPage(1);
                          loadGoals({ page: 1, pageSize }).catch((err) => {
                            console.error("loadGoals error:", err);
                          });
                        }
                      }}
                      placeholder={t("project.searchPlaceholder") || "Search goals..."}
                      className="w-full pl-10 rounded-2xl text-[var(--on-surface)] dark:text-white bg-white dark:bg-gray-800 placeholder-[var(--on-surface-variant)] dark:placeholder-gray-400 border"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => {
                          setSearchTerm("");
                          setCurrentPage(1);
                          loadGoals({ page: 1, pageSize }).catch((err) => {
                            console.error("loadGoals error:", err);
                          });
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 transition-colors"
                      >
                      </button>
                    )}
                  </div>
                </div>
                {/* Actions container */}
                <div className="flex flex-wrap gap-2">
                  {/* Sort controls */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400">
                      {t("project.sort.label") || "Sort"}
                    </label>
                    <select
                      aria-label="Sort by"
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value)}
                      className="md3-input text-base min-w-[120px] md:min-w-[140px] bg-[var(--surface-container-lowest)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white"
                    >
                      <option value="rollNo" className="bg-white dark:bg-gray-700">
                        {t("project.sort.rollNo") || "Roll No"}
                      </option>
                      <option value="title" className="bg-white dark:bg-gray-700">
                        {t("project.sort.title") || "Title"}
                      </option>
                      <option value="created_at" className="bg-white dark:bg-gray-700">
                        {t("project.sort.created") || "Created"}
                      </option>
                    </select>
                    <button
                      onClick={() =>
                        setSortOrder((s) => (s === "asc" ? "desc" : "asc"))
                      }
                      className="p-2 rounded-full hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 transition-colors"
                      title={
                        sortOrder === "asc"
                          ? t("project.sort.ascending") || "Ascending"
                          : t("project.sort.descending") || "Descending"
                      }
                      aria-label="Toggle sort order"
                    >
                      <ArrowUpDown
                        className={`h-5 w-5 text-[var(--on-surface-variant)] dark:text-gray-400 ${
                          sortOrder === "desc" ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>
                  {/* Refresh button */}
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--outline-variant)] dark:border-gray-600 text-[var(--on-surface)] dark:text-white hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
                    title={t("project.refresh") || "Refresh"}
                    aria-label="Refresh goals"
                  >
                    <RefreshCcw
                      className={`h-4 w-4 ${
                        isRefreshing ? "animate-spin" : ""
                      }`}
                    />
                    <span className="inline text-sm">{t("project.refresh")}</span>
                  </button>
                  {/* Add Goal button (visible on larger screens) */}
                  {canManageGTA && (
                    <button
                      onClick={() =>
                        setModal({ isOpen: true, type: "createGoal", data: null })
                      }
                      className="md3-button bg-green-700 dark:bg-indigo-700 text-[var(--on-primary)] dark:text-white hover:bg-[color-mix(in_srgb,var(--primary),white_20%)] dark:hover:bg-indigo-600 flex items-center gap-1 min-w-[100px]"
                      aria-label="Add goal"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="inline text-sm">{t("project.addGoalLabel")}</span>
                    </button>
                  )}
                </div>
              </div>
              {/* Row 2: Quarter Filters */}
              <div className="bg-[var(--surface-container)] dark:bg-gray-700 rounded-xl p-4 dark:border-gray-800 surface-elevation-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-medium text-[var(--on-surface)] dark:text-white flex-shrink-0">
                    {t("project.quarterFilter", "Quarter")}:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[0, 1, 2, 3, 4].map((q) => (
                      <button
                        key={q}
                        onClick={() => setCurrentQuarter(q)}
                        className={`
                          px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 
                          ${
                            currentQuarter === q
                              ? "bg-green-800 dark:bg-indigo-700 text-[var(--on-primary)] dark:text-white shadow"
                              : "bg-[var(--surface-container-lowest)] dark:bg-gray-800 text-[var(--on-surface)] dark:text-white hover:bg-[var(--surface-container)] dark:hover:bg-gray-700"
                          }
                        `}
                      >
                        {q === 0 ? t("project.all", "All") : `${t("project.quarterFilter", "All")} ${q}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="space-y-4">
          {isLoadingGoals ? (
            <div className="space-y-4 animate-fade-in">
              <SkeletonCard rows={2} />
              <SkeletonCard rows={3} />
              <SkeletonCard rows={1} />
            </div>
          ) : sortedGoals.length === 0 ? (
            <div className="bg-[var(--surface-container-lowest)] dark:bg-gray-800 surface-elevation-3 rounded-xl p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--surface-container)] dark:bg-gray-700 mb-4">
                <Target className="h-6 w-6 text-[var(--on-surface-variant)] dark:text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-[var(--on-surface)] dark:text-white mb-1">
                {goals.length === 0
                  ? t("project.empty.noGoals")
                  : t("project.empty.noMatch")}
              </h3>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedGoals.map((goal, index) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  expandedGoal={expandedGoal}
                  toggleGoal={toggleGoal}
                  setSelectedGoal={setSelectedGoal}
                  canManageGTA={canManageGTA}
                  handleDeleteGoal={handleDeleteGoal}
                  onEditGoal={(g) =>
                    setModal({ isOpen: true, type: "editGoal", data: g })
                  }
                  onCreateTask={(goalId) =>
                    setModal({
                      isOpen: true,
                      type: "createTask",
                      data: { goalId },
                    })
                  }
                  onEditTask={(goalId, task) =>
                    setModal({
                      isOpen: true,
                      type: "editTask",
                      data: { goalId, ...task },
                    })
                  }
                  onDeleteTask={handleDeleteTask}
                  onCreateActivity={(goalId, taskId) =>
                    setModal({
                      isOpen: true,
                      type: "createActivity",
                      data: { goalId, taskId },
                    })
                  }
                  onEditActivity={(goalId, taskId, activity) =>
                    setModal({
                      isOpen: true,
                      type: "editActivity",
                      data: { goalId, taskId, ...activity },
                    })
                  }
                  onDeleteActivity={handleDeleteActivity}
                  tasks={tasks}
                  tasksLoading={tasksLoading}
                  toggleTask={toggleTask}
                  expandedTask={expandedTask}
                  activities={activities}
                  activitiesLoading={activitiesLoading}
                  openSubmitModal={openSubmitModal}
                  canSubmitReport={canSubmitReport}
                  reportingActive={reportingActive}
                />
              ))}
            </div>
          )}
          <PaginationFooter
            currentPage={currentPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            setCurrentPage={setCurrentPage}
            total={goals.length}
          />
        </main>
        {modal.isOpen && modal.type && modal.type !== "submitReport" && (
          <GenericModal
            modal={modal}
            setModal={setModal}
            groups={groups}
            tasks={tasks}
            goals={goals}
            activities={activities}
            onCreateGoal={handleCreateGoal}
            onUpdateGoal={handleUpdateGoal}
            onCreateTask={handleCreateTask}
            onUpdateTask={handleUpdateTask}
            onCreateActivity={handleCreateActivity}
            onUpdateActivity={handleUpdateActivity}
            isSubmitting={isSubmitting}
            t={t}
          />
        )}
        {submitModal.isOpen && submitModal.data && (
          <SubmitReportModal
            data={submitModal.data}
            onClose={closeSubmitModal}
            onSubmit={handleSubmitReport}
            loading={isSubmitting}
            t={t}
          />
        )}
        <ConfirmModal
          open={confirmOpen}
          title={
            toDelete
              ? toDelete.type === "goal"
                ? t("project.confirm.deleteGoalTitle") || "Delete goal"
                : toDelete.type === "task"
                ? t("project.confirm.deleteTaskTitle") || "Delete task"
                : t("project.confirm.deleteActivityTitle") || "Delete activity"
              : t("project.confirm.deleteTitle") || "Confirm delete"
          }
          message={
            toDelete
              ? toDelete.name
                ? toDelete.type === "goal"
                  ? t("project.confirm.deleteGoalMessage", {
                      title: toDelete.name,
                    }) || `Are you sure you want to delete goal "${toDelete.name}"?`
                  : toDelete.type === "task"
                  ? t("project.confirm.deleteTaskMessage", {
                      title: toDelete.name,
                    }) || `Are you sure you want to delete task "${toDelete.name}"?`
                  : t("project.confirm.deleteActivityMessage", {
                      title: toDelete.name,
                    }) ||
                    `Are you sure you want to delete activity "${toDelete.name}"?`
                : toDelete.type === "goal"
                ? t("project.confirm.deleteGoalMessageGeneric") ||
                  "Are you sure you want to delete this goal?"
                : toDelete.type === "task"
                ? t("project.confirm.deleteTaskMessageGeneric") ||
                  "Are you sure you want to delete this task?"
                : t("project.confirm.deleteActivityMessageGeneric") ||
                  "Are you sure you want to delete this activity?"
              : t("project.confirm.deleteMessage") ||
                "Are you sure you want to delete this item?"
          }
          onCancel={() => {
            setConfirmOpen(false);
            setToDelete(null);
          }}
          onConfirm={performDelete}
          loading={deleting}
          confirmLabel={t("project.actions.delete") || "Delete"}
          cancelLabel={t("project.actions.cancel") || "Cancel"}
          t={t}
        />
        {toast && (
          <div className="fixed z-50 right-4 bottom-4 animate-fade-in">
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}