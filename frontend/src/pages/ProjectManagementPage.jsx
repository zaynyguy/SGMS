import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../context/AuthContext";
import TopBar from "../components/layout/TopBar";

import useProjectApi from "../hooks/useProjectApi";

import GoalCard from "../components/project/GoalCard";
import PaginationFooter from "../components/project/PaginationFooter";
import GenericModal from "../components/project/GenericModal";
import SubmitReportModal from "../components/SubmitReportModal";
import { Target } from "lucide-react";

import SkeletonCard from "../components/ui/SkeletonCard";
import Toast from "../components/common/Toast";

import { ArrowUpDown, RefreshCcw, Plus } from "lucide-react";

/* Confirm modal component (in-file) */
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
      className={`fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center p-3 z-50 project-overlay ${
        isMounted ? "opacity-100" : "opacity-0"
      }`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
    >
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-2xl w-full max-w-sm project-modal text-sm">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 mb-2 project-pulse">
            <svg
              className="h-5 w-5 text-red-600 dark:text-red-400"
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

          <h3
            id="confirm-modal-title"
            className="mt-2 text-sm font-semibold text-gray-900 dark:text-white project-slide-in"
          >
            {title}
          </h3>

          <p
            id="confirm-modal-desc"
            className="mt-2 text-xs text-gray-600 dark:text-gray-400 project-fade-in"
          >
            {message}
          </p>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2 project-stagger-buttons">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 project-btn project-slide-in-left"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm project-btn project-slide-in-right disabled:opacity-60 flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="project-spinner-small mr-1.5"></div>
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

      // ... (validation logic remains the same) ...
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
    <>
      <style>{`
        /* ... (all the keyframes and styles) ... */
        @keyframes projectFadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes projectSlideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes projectScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes projectPulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        @keyframes projectSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes projectShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .project-main-container { animation: projectFadeIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }
        .project-overlay { transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .project-modal { animation: projectScaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .project-slide-in { animation: projectSlideIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }
        .project-fade-in { animation: projectFadeIn 0.5s ease-out both; }
        .project-pulse { animation: projectPulse 2s ease-in-out infinite; }
        .project-btn { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .project-btn:hover { transform: translateY(-2px); }
        .project-btn:active { transform: translateY(0); }
        .project-icon-rotate { transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55); }
        .project-refresh-spin { animation: projectSpin 1s linear infinite; }
        .project-shake { animation: projectShake 0.5s ease-in-out; }
        .project-header-icon { animation: projectFadeIn 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }
        .project-title { animation: projectSlideIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }
        .project-controls { animation: projectFadeIn 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }
        .project-spinner-small { width: 14px; height: 14px; border: 2px solid transparent; border-top: 2px solid currentColor; border-radius: 50%; animation: projectSpin 1s linear infinite; }
        .project-content-transition { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .project-search-focus:focus { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
        .project-sort-active { transition: all 0.3s ease; }
        .project-sort-active:hover { transform: scale(1.05); }
      `}</style>

      <div
        className={`min-h-screen bg-gray-200 dark:bg-gray-900 p-3 md:p-4 transition-colors duration-200 ${
          isMounted ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="max-w-8xl mx-auto">
          <header className="mb-3 ">
            <div className="flex items-center md:items-center justify-between gap-3 rounded-2xl bg-white dark:bg-gray-800 backdrop-blur-xs border border-gray-200/60 dark:border-gray-700/40 shadow-sm px-4 py-3 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-gray-200 dark:bg-gray-800 project-header-icon">
                  <Target className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                </div>

                <div className="project-title">
                  <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white leading-tight">
                    {t("project.title")}
                  </h1>
                  <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300 project-fade-in">
                    {t("project.subtitle")}
                  </p>
                </div>
              </div>

              <div className="ml-auto flex-shrink-0 project-slide-in">
                <TopBar />
              </div>
            </div>

            {/* ---------------------------------------------------------------- */}
            {/* MODIFICATION START: Responsive Header Layout
            /* ---------------------------------------------------------------- */}
            <div className="mt-3 w-full project-controls space-y-3">
              
              {/* Row 1: Search and Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-2">
                {/* Search Bar */}
                <div className="flex-1 w-full">
                  <label htmlFor="project-search" className="sr-only">
                    {t("project.search") || "Search goals"}
                  </label>
                  <div className="relative w-full">
                    <input
                      id="project-search"
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
                      placeholder={
                        t("project.searchPlaceholder") || "Search goals..."
                      }
                      className="w-full rounded-md border bg-white dark:bg-gray-800 px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 project-search-focus transition-all duration-200"
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
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 project-btn hover:scale-110"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Sort/Refresh/Add Buttons */}
                <div className="flex-shrink-0 w-full sm:w-auto flex justify-end items-center gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-gray-600 dark:text-gray-300">
                      {t("project.sort.label") || "Sort"}
                    </label>
                    <select
                      aria-label="Sort by"
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value)}
                      className="ml-1 rounded-md border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300 px-1.5 py-1 text-xs shadow-sm focus:outline-none project-btn project-sort-active"
                      title="Choose sort key"
                    >
                      <option value="rollNo">
                        {t("project.sort.rollNo") || "Roll No"}
                      </option>
                      <option value="title">
                        {t("project.sort.title") || "Title"}
                      </option>
                      <option value="created_at">
                        {t("project.sort.created") || "Created"}
                      </option>
                    </select>
                    <button
                      onClick={() =>
                        setSortOrder((s) => (s === "asc" ? "desc" : "asc"))
                      }
                      className="ml-1.5 px-1.5 py-1 rounded border text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300 flex items-center gap-1 hover:shadow-sm project-btn project-sort-active"
                      title={
                        sortOrder === "asc"
                          ? t("project.sort.ascending") || "Ascending"
                          : t("project.sort.descending") || "Descending"
                      }
                      aria-label="Toggle sort order"
                    >
                      <span className="text-xs">
                        {sortOrder === "asc" ? "Asc" : "Desc"}
                      </span>
                      <ArrowUpDown
                        className={`h-3.5 w-3.5 project-icon-rotate ${
                          sortOrder === "desc" ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>

                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="px-2 py-1 rounded border text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300 flex items-center project-btn hover:scale-105 disabled:opacity-60"
                    title={t("project.refresh") || "Refresh"}
                    aria-label="Refresh goals"
                  >
                    <RefreshCcw
                      className={`h-3.5 w-3.5 mr-1.5 ${
                        isRefreshing ? "project-refresh-spin" : ""
                      }`}
                    />
                    <span className="text-xs">
                      {t("project.refresh") || "Refresh"}
                    </span>
                  </button>

                  {canManageGTA && (
                    <button
                      onClick={() =>
                        setModal({ isOpen: true, type: "createGoal", data: null })
                      }
                      className="ml-1 px-2 py-1 rounded bg-sky-600 text-white hover:bg-sky-700 flex items-center project-btn"
                      aria-label="Add goal"
                      title={t("project.addGoal") || "Add goal"}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      <span className="text-xs">
                        {t("project.addGoalLabel") || "Add Goal"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
              
              {/* Row 2: Quarter Filters (Responsive) */}
              <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 pl-1 flex-shrink-0">
                    {t("project.quarterFilter", "Quarter")}:
                  </span>
                  <div className="flex flex-wrap flex-1 gap-1.5 min-w-[180px]">
                    {[0, 1, 2, 3, 4].map((q) => (
                      <button
                        key={q}
                        onClick={() => setCurrentQuarter(q)}
                        className={`
                          px-2 py-1 rounded-md text-xs font-semibold transition-all duration-200 
                          flex-1 sm:flex-auto
                          ${
                            currentQuarter === q
                              ? "bg-sky-600 text-white shadow"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                          }
                        `}
                      >
                        {q === 0 ? t("project.all", "All") : `Q${q}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
            {/* ---------------------------------------------------------------- */}
            {/* MODIFICATION END */}
            {/* ---------------------------------------------------------------- */}
          </header>

          <main className="grid gap-4 project-content-transition">
            <div className="lg:col-span-8">
              {isLoadingGoals ? (
                <div className="space-y-3 project-fade-in">
                  <SkeletonCard rows={2} />
                  <SkeletonCard rows={3} />
                  <SkeletonCard rows={1} />
                </div>
              ) : sortedGoals.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 text-center text-xs text-gray-500 dark:text-gray-400 project-fade-in project-shake">
                  {goals.length === 0
                    ? t("project.empty.noGoals")
                    : t("project.empty.noMatch")}
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
            </div>
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
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}
        </div>
      </div>
    </>
  );
}