import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../context/AuthContext";
import TopBar from "../components/layout/TopBar";

import useProjectApi from "../hooks/useProjectApi";

import HeaderActions from "../components/project/HeaderActions";
import GoalCard from "../components/project/GoalCard";
import PaginationFooter from "../components/project/PaginationFooter";
import GenericModal from "../components/project/GenericModal";
// MODIFIED: Assuming 'SubmitReportInline' was a typo and you meant 'SubmitReportModal.jsx'
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
      className={`fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center p-4 z-50 project-overlay ${isMounted ? 'opacity-100' : 'opacity-0'}`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
    >
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md project-modal">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-3 project-pulse">
            <svg className="h-6 w-6 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 9v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
          </div>

          <h3 id="confirm-modal-title" className="mt-2 text-lg font-semibold text-gray-900 dark:text-white project-slide-in">
            {title}
          </h3>

          <p id="confirm-modal-desc" className="mt-2 text-sm text-gray-600 dark:text-gray-400 project-fade-in">
            {message}
          </p>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 project-stagger-buttons">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 project-btn project-slide-in-left"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm project-btn project-slide-in-right disabled:opacity-60 flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="project-spinner-small mr-2"></div>
                <span>{(t && t("project.actions.deleting")) || "Deleting..."}</span>
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

  const [modal, setModal] = useState({ isOpen: false, type: null, data: null });
  const [submitModal, setSubmitModal] = useState({ isOpen: false, data: null });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [canManageGTA, setCanManageGTA] = useState(false);
  const [canViewGTA, setCanViewGTA] = useState(false);
  const [canSubmitReport, setCanSubmitReport] = useState(false);
  const [reportingActive, setReportingActive] = useState(false);

  // Animation states
  const [isMounted, setIsMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Toast: { message: string, type: 'create'|'read'|'update'|'delete'|'error' }
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "create") => {
    setToast({ message, type });
  }, []);

  // Sorting preferences (persisted)
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

  // unified data + CRUD hook
  const api = useProjectApi();

  // Mount animation
  useEffect(() => {
    requestAnimationFrame(() => setIsMounted(true));
  }, []);

  /* ----------------- Permissions & reporting ----------------- */
  useEffect(() => {
    if (!user) {
      setCanManageGTA(false);
      setCanViewGTA(false);
      setCanSubmitReport(false);
      setReportingActive(false);
      return;
    }
    const perms = Array.isArray(user?.permissions)
      ? user.permissions
      : user?.user?.permissions || [];

    setCanManageGTA(perms.includes("manage_gta"));
    setCanViewGTA(perms.includes("view_gta") || perms.includes("manage_gta"));

    const submitPermNames = ["submit_report", "SubmitReport", "submitReport", "submit_reports"];
    const hasSubmit = submitPermNames.some((p) => perms.includes(p));
    setCanSubmitReport(hasSubmit);

    if (hasSubmit) {
      (async () => {
        try {
          if (typeof api.loadReportingStatus === "function") {
            await api.loadReportingStatus();
            setReportingActive(Boolean(api.reportingActive));
          } else {
            setReportingActive(Boolean(api.reportingActive));
          }
        } catch (err) {
          console.error("loadReportingStatus error:", err);
          setReportingActive(false);
          showToast(t("project.errors.loadReportingStatus") || "Error loading reporting status", "error");
        }
      })();
    } else {
      setReportingActive(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, api, showToast, t]);

  /* ----------------- Load initial data ----------------- */
  useEffect(() => {
    api.loadGoals({ page: currentPage, pageSize }).catch((e) => {
      console.error("loadGoals error:", e);
      showToast(e?.message || t("project.errors.loadGoals"), "error");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  /* ----------------- Persist sort preferences ----------------- */
  useEffect(() => {
    try {
      localStorage.setItem("projects.sortKey", sortKey);
      localStorage.setItem("projects.sortOrder", sortOrder);
    } catch {
      // ignore storage errors (e.g., privacy mode)
    }
  }, [sortKey, sortOrder]);

  /* ----------------- Toggle UI helpers ----------------- */
  const toggleGoal = useCallback(
    async (goal) => {
      if (expandedGoal === goal.id) {
        setExpandedGoal(null);
      } else {
        setExpandedGoal(goal.id);
        setSelectedGoal(goal);
        if (!api.tasks[goal.id]) {
          try {
            await api.loadTasks(goal.id);
          } catch (err) {
            showToast(err?.message || t("project.errors.loadTasks"), "error");
          }
        }
      }
    },
    [expandedGoal, api, t, showToast]
  );

  const toggleTask = useCallback(
    async (goal, task) => {
      if (expandedTask === task.id) {
        setExpandedTask(null);
      } else {
        setExpandedTask(task.id);
        if (!api.activities[task.id]) {
          try {
            await api.loadActivities(task.id);
          } catch (err) {
            showToast(err?.message || t("project.errors.loadActivities"), "error");
          }
        }
      }
    },
    [expandedTask, api, t, showToast]
  );

  /* ----------------- Confirm modal state for deletes ----------------- */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null); // { type: 'goal'|'task'|'activity', goalId, taskId, activityId, name }
  const [deleting, setDeleting] = useState(false);

  /* ----------------- CRUD wrappers that call unified api ----------------- */
  const handleCreateGoal = useCallback(
    async (payload) => {
      setIsSubmitting(true);
      try {
        await api.createGoalItem(payload);
        setModal({ isOpen: false, type: null, data: null });
        showToast(t("project.toasts.goalCreated"), "create");
        await api.loadGoals({ page: 1 });
      } catch (err) {
        console.error("createGoal error:", err);
        showToast(err?.message || t("project.errors.createGoal"), "error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [api, t, showToast]
  );

  const handleUpdateGoal = useCallback(
    async (goalId, payload) => {
      setIsSubmitting(true);
      try {
        await api.updateGoalItem(goalId, payload);
        setModal({ isOpen: false, type: null, data: null });
        showToast(t("project.toasts.goalUpdated"), "update");
        await api.loadGoals();
      } catch (err) {
        console.error("updateGoal error:", err);
        showToast(err?.message || t("project.errors.updateGoal"), "error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [api, t, showToast]
  );

  /* Request deletion (open confirm modal) for goal */
  const handleDeleteGoal = useCallback(
    (goalId) => {
      const goal = (api.goals || []).find((g) => String(g.id) === String(goalId)) || null;
      setToDelete({ type: "goal", goalId, name: goal?.title || goal?.name || "" });
      setConfirmOpen(true);
    },
    [api.goals]
  );

  const handleCreateTask = useCallback(
    async (goalId, payload) => {
      setIsSubmitting(true);
      try {
        await api.createTaskItem(goalId, payload);
        setModal({ isOpen: false, type: null, data: null });
        showToast(t("project.toasts.taskCreated"), "create");
        await api.loadTasks(goalId);
        await api.loadGoals();
      } catch (err) {
        console.error("createTask error:", err);
        showToast(err?.message || t("project.errors.createTask"), "error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [api, t, showToast]
  );

  const handleUpdateTask = useCallback(
    async (goalId, taskId, payload) => {
      setIsSubmitting(true);
      try {
        await api.updateTaskItem(goalId, taskId, payload);
        setModal({ isOpen: false, type: null, data: null });
        showToast(t("project.toasts.taskUpdated"), "update");
        await api.loadTasks(goalId);
        await api.loadGoals();
      } catch (err) {
        console.error("updateTask error:", err);
        showToast(err?.message || t("project.errors.updateTask"), "error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [api, t, showToast]
  );

  /* Request deletion (open confirm modal) for task */
  const handleDeleteTask = useCallback(
    (goalId, taskId) => {
      // find task name if available
      const tasksForGoal = api.tasks?.[goalId] || [];
      const task = tasksForGoal.find((t) => String(t.id) === String(taskId)) || null;
      setToDelete({ type: "task", goalId, taskId, name: task?.title || task?.name || "" });
      setConfirmOpen(true);
    },
    [api.tasks]
  );

  const handleCreateActivity = useCallback(
    async (goalId, taskId, payload) => {
      setIsSubmitting(true);
      try {
        await api.createActivityItem(taskId, payload);
        setModal({ isOpen: false, type: null, data: null });
        showToast(t("project.toasts.activityCreated"), "create");
        await api.loadActivities(taskId);
        await api.loadTasks(goalId);
        await api.loadGoals();
      } catch (err) {
        console.error("createActivity error:", err);
        showToast(err?.message || t("project.errors.createActivity"), "error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [api, t, showToast]
  );

  const handleUpdateActivity = useCallback(
    async (goalId, taskId, activityId, payload) => {
      setIsSubmitting(true);
      try {
        await api.updateActivityItem(taskId, activityId, payload);
        setModal({ isOpen: false, type: null, data: null });
        showToast(t("project.toasts.activityUpdated"), "update");
        await api.loadActivities(taskId);
        await api.loadTasks(goalId);
        await api.loadGoals();
      } catch (err) {
        console.error("updateActivity error:", err);
        showToast(err?.message || t("project.errors.updateActivity"), "error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [api, t, showToast]
  );

  /* Request deletion (open confirm modal) for activity */
  const handleDeleteActivity = useCallback(
    (goalId, taskId, activityId) => {
      // find activity name if available
      const activitiesForTask = api.activities?.[taskId] || [];
      const activity = activitiesForTask.find((a) => String(a.id) === String(activityId)) || null;
      setToDelete({ type: "activity", goalId, taskId, activityId, name: activity?.title || activity?.name || "" });
      setConfirmOpen(true);
    },
    [api.activities]
  );

  /* Perform the confirmed delete (goal/task/activity) */
  const performDelete = useCallback(
    async () => {
      if (!toDelete || !toDelete.type) {
        setConfirmOpen(false);
        setToDelete(null);
        return;
      }

      setDeleting(true);
      try {
        if (toDelete.type === "goal") {
          await api.deleteGoalItem(toDelete.goalId || toDelete.id);
          showToast(t("project.toasts.goalDeleted"), "delete");
          await api.loadGoals();
        } else if (toDelete.type === "task") {
          await api.deleteTaskItem(toDelete.goalId, toDelete.taskId);
          showToast(t("project.toasts.taskDeleted"), "delete");
          await api.loadTasks(toDelete.goalId);
          await api.loadGoals();
        } else if (toDelete.type === "activity") {
          await api.deleteActivityItem(toDelete.taskId, toDelete.activityId);
          showToast(t("project.toasts.activityDeleted"), "delete");
          await api.loadActivities(toDelete.taskId);
          await api.loadTasks(toDelete.goalId);
          await api.loadGoals();
        }
      } catch (err) {
        console.error("delete error:", err);
        const key =
          toDelete.type === "goal"
            ? "project.errors.deleteGoal"
            : toDelete.type === "task"
            ? "project.errors.deleteTask"
            : "project.errors.deleteActivity";
        showToast(err?.message || t(key), "error");
      } finally {
        setDeleting(false);
        setConfirmOpen(false);
        setToDelete(null);
      }
    },
    [toDelete, api, showToast, t]
  );

  /* ----------------- Submit report ----------------- */
  // MODIFIED: Pass full metric data to the modal
  const openSubmitModal = useCallback((goalId, taskId, activityId) => {
    // Find the activity from the API state to pre-populate metrics
    const taskActivities = api.activities[taskId] || [];
    const activity = taskActivities.find(a => String(a.id) === String(activityId));

    const data = {
      goalId,
      taskId,
      activityId,
      targetMetric: activity?.targetMetric || {},
      currentMetric: activity?.currentMetric || {}
    };
    setSubmitModal({ isOpen: true, data: data });
  }, [api.activities]);

  const closeSubmitModal = useCallback(() => {
    setSubmitModal({ isOpen: false, data: null });
  }, []);

  const handleSubmitReport = useCallback(
    async (formState) => {
      const { activityId, metricsArray, narrative, newStatus, files, goalId, taskId } = formState;
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
      if (metricsObj) fd.append("metrics_data", JSON.stringify(metricsObj)); // Stringify is correct for FormData
      if (newStatus) fd.append("new_status", newStatus);
      if (files && files.length) {
        for (let i = 0; i < files.length; i += 1) fd.append("attachments", files[i]);
      }

      setIsSubmitting(true);
      try {
        await api.submitReportForActivity(activityId, fd);
        showToast(t("project.toasts.reportSubmitted"), "create");
        closeSubmitModal();
        // Refresh data up the chain
        if (taskId) await api.loadActivities(taskId);
        if (goalId) await api.loadTasks(goalId);
        await api.loadGoals();
      } catch (err) {
        console.error("submitReport error:", err);
        let message = err?.message || t("project.errors.submitReport");
        try {
          if (err?.response && typeof err.response === "object") {
            const r = err.response;
            if (r.data && (r.data.error || r.data.message)) message = r.data.error || r.data.message;
            else if (typeof r === "string") message = r;
          } else if (err?.text) {
            message = err.text;
          }
        } catch (parseErr) {}
        showToast(String(message), "error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [api, t, closeSubmitModal, showToast]
  );

  /* ----------------- Filtered goals ----------------- */
  const filteredGoals = useMemo(() => {
    const q = String(searchTerm || "").trim().toLowerCase();
    return (api.goals || []).filter((g) => {
      if (!q) return true;
      return (g.title || "").toLowerCase().includes(q) || (g.description || "").toLowerCase().includes(q);
    });
  }, [api.goals, searchTerm]);

  /* ----------------- Sorting ----------------- */
  const sortedGoals = useMemo(() => {
    const arr = Array.isArray(filteredGoals) ? [...filteredGoals] : [];
    const order = sortOrder === "asc" ? 1 : -1;

    const getVal = (g) => {
      if (sortKey === "created_at" || sortKey === "createdAt") {
        // attempt to coerce to Date for comparison; fallback to 0
        const v = g.created_at ?? g.createdAt ?? g.created ?? null;
        if (!v) return 0;
        const d = Date.parse(v);
        return Number.isNaN(d) ? 0 : d;
      }

      if (sortKey === "rollNo") {
        // Database uses "rollNo" on Goals (see schema). Accept numbers or numeric strings.
        const raw = g.rollNo ?? g.roll_no ?? g.roll ?? null;
        if (raw === null || raw === undefined || String(raw).trim() === "") return Number.MAX_SAFE_INTEGER;
        // coerce to number if possible
        const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
        return Number.isNaN(n) ? String(raw).toLowerCase() : n;
      }

      // default: title (string)
      return String(g.title || "").toLowerCase();
    };

    arr.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);

      // numeric/date comparison
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * order;
      }

      // string comparison
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
      await api.loadGoals({ page: currentPage, pageSize });
    } catch (err) {
      console.error("loadGoals error:", err);
      showToast(err?.message || t("project.errors.loadGoals"), "error");
    } finally {
      // Smooth animation completion
      setTimeout(() => setIsRefreshing(false), 600);
    }
  }, [api, currentPage, pageSize, showToast, t]);

  /* ----------------- Render ----------------- */
  return (
    <>
      <style>{`
        @keyframes projectFadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes projectSlideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes projectScaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes projectPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        @keyframes projectSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes projectBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes projectShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        .project-main-container {
          animation: projectFadeIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        .project-overlay {
          transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .project-modal {
          animation: projectScaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .project-slide-in {
          animation: projectSlideIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        .project-slide-in-left {
          animation: projectSlideIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          animation-delay: 0.1s;
        }
        .project-slide-in-right {
          animation: projectSlideIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          animation-delay: 0.2s;
        }
        .project-fade-in {
          animation: projectFadeIn 0.5s ease-out both;
        }
        .project-pulse {
          animation: projectPulse 2s ease-in-out infinite;
        }
        .project-btn {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .project-btn:hover {
          transform: translateY(-2px);
        }
        .project-btn:active {
          transform: translateY(0);
        }
        .project-icon-rotate {
          transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        .project-refresh-spin {
          animation: projectSpin 1s linear infinite;
        }
        .project-bounce-on-hover:hover {
          animation: projectBounce 0.6s ease;
        }
        .project-shake {
          animation: projectShake 0.5s ease-in-out;
        }
        .project-stagger-buttons > *:nth-child(1) { animation-delay: 0.1s; }
        .project-stagger-buttons > *:nth-child(2) { animation-delay: 0.2s; }
        .project-header-icon {
          animation: projectFadeIn 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        .project-title {
          animation: projectSlideIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        .project-controls {
          animation: projectFadeIn 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        .project-spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: projectSpin 1s linear infinite;
        }
        .project-content-transition {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .project-search-focus:focus {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .project-sort-active {
          transition: all 0.3s ease;
        }
        .project-sort-active:hover {
          transform: scale(1.05);
        }
      `}</style>

      <div className={`min-h-screen bg-gray-200 dark:bg-gray-900 p-4 md:p-6 transition-colors duration-200 ${isMounted ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-8xl mx-auto">
          <header className="mb-4">
            <div className="flex items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-white dark:bg-gray-800 project-header-icon project-bounce-on-hover">
                  <Target className="h-6 w-6 text-sky-600 dark:text-sky-300" />
                </div>

                <div className="project-title">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight">
                    {t("project.title")}
                  </h1>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 project-fade-in">
                    {t("project.subtitle")}
                  </p>
                </div>
              </div>

              <div className="ml-auto flex-shrink-0 project-slide-in">
                <TopBar />
              </div>
            </div>

            {/* Controls row: search (full width) | sort | refresh | add */}
            <div className="mt-4 w-full project-controls">
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                {/* Search - expands to fill available space */}
                <div className="flex-1">
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
                          // reload from page 1 when searching
                          setCurrentPage(1);
                          api.loadGoals({ page: 1, pageSize }).catch((err) => {
                            console.error("loadGoals error:", err);
                            showToast(err?.message || t("project.errors.loadGoals"), "error");
                          });
                        }
                      }}
                      placeholder={t("project.searchPlaceholder") || "Search goals..."}
                      className="w-full rounded-md border bg-white dark:bg-gray-800 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 project-search-focus transition-all duration-200"
                    />

                    {/* clear button when there's text */}
                    {searchTerm && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => {
                          setSearchTerm("");
                          setCurrentPage(1);
                          api.loadGoals({ page: 1, pageSize }).catch((err) => {
                            console.error("loadGoals error:", err);
                            showToast(err?.message || t("project.errors.loadGoals"), "error");
                          });
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 project-btn hover:scale-110"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Right-side controls */}
                <div className="flex justify-end items-center gap-2">
                  {/* Sort: select + toggle (improved styling) */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-300">{t("project.sort.label") || "Sort"}</label>

                    <select
                      aria-label="Sort by"
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value)}
                      className="ml-1 rounded-md border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300 px-2 py-1 text-sm shadow-sm focus:outline-none project-btn project-sort-active"
                      title="Choose sort key"
                    >
                      <option value="rollNo">{t("project.sort.rollNo") || "Roll No"}</option>
                      <option value="title">{t("project.sort.title") || "Title"}</option>
                      <option value="created_at">{t("project.sort.created") || "Created"}</option>
                    </select>

                    <button
                      onClick={() => setSortOrder((s) => (s === "asc" ? "desc" : "asc"))}
                      className="ml-2 px-2 py-1 rounded border text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300 flex items-center gap-2 hover:shadow-sm project-btn project-sort-active"
                      title={sortOrder === "asc" ? (t("project.sort.ascending") || "Ascending") : (t("project.sort.descending") || "Descending")}
                      aria-label="Toggle sort order"
                    >
                      <span className="text-xs">{sortOrder === "asc" ? "Asc" : "Desc"}</span>
                      <ArrowUpDown className={`h-4 w-4 project-icon-rotate ${sortOrder === "desc" ? "rotate-180" : ""}`} />
                    </button>
                  </div>

                  {/* Refresh */}
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="px-3 py-1 rounded border text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300 flex items-center project-btn hover:scale-105 disabled:opacity-60"
                    title={t("project.refresh") || "Refresh"}
                    aria-label="Refresh goals"
                  >
                    <RefreshCcw className={`h-4 w-4 mr-2 ${isRefreshing ? 'project-refresh-spin' : ''}`} />
                    <span className="text-sm">{t("project.refresh") || "Refresh"}</span>
                  </button>

                  {/* Add Goal */}
                  {canManageGTA && (
                    <button
                      onClick={() => setModal({ isOpen: true, type: "createGoal", data: null })}
                      className="ml-1 px-3 py-1 rounded bg-sky-600 text-white hover:bg-sky-700 flex items-center project-btn project-bounce-on-hover"
                      aria-label="Add goal"
                      title={t("project.addGoal") || "Add goal"}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="text-sm">{t("project.addGoalLabel") || "Add Goal"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="grid gap-6 project-content-transition">
            <div className="lg:col-span-8">
              {api.isLoadingGoals ? (
                <div className="space-y-4 project-fade-in">
                  <SkeletonCard rows={2} />
                  <SkeletonCard rows={3} />
                  <SkeletonCard rows={1} />
                </div>
              ) : sortedGoals.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 text-center text-sm text-gray-500 dark:text-gray-400 project-fade-in project-shake">
                  {api.goals.length === 0 ? t("project.empty.noGoals") : t("project.empty.noMatch")}
                </div>
              ) : (
                <div className="space-y-6">
                  {sortedGoals.map((goal, index) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      expandedGoal={expandedGoal}
                      toggleGoal={toggleGoal}
                      setSelectedGoal={setSelectedGoal}
                      canManageGTA={canManageGTA}
                      handleDeleteGoal={handleDeleteGoal}
                      onEditGoal={(g) => setModal({ isOpen: true, type: "editGoal", data: g })}
                      onCreateTask={(goalId) => setModal({ isOpen: true, type: "createTask", data: { goalId } })}
                      onEditTask={(goalId, task) => setModal({ isOpen: true, type: "editTask", data: { goalId, ...task } })}
                      onDeleteTask={handleDeleteTask}
                      onCreateActivity={(goalId, taskId) => setModal({ isOpen: true, type: "createActivity", data: { goalId, taskId } })}
                      onEditActivity={(goalId, taskId, activity) => setModal({ isOpen: true, type: "editActivity", data: { goalId, taskId, ...activity } })}
                      onDeleteActivity={handleDeleteActivity}
                      tasks={api.tasks}
                      tasksLoading={api.tasksLoading}
                      toggleTask={toggleTask}
                      expandedTask={expandedTask}
                      activities={api.activities}
                      activitiesLoading={api.activitiesLoading}
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
                total={api.goals.length}
              />
            </div>
          </main>

          {modal.isOpen && modal.type && modal.type !== "submitReport" && (
            <GenericModal
              modal={modal}
              setModal={setModal}
              groups={api.groups}
              tasks={api.tasks}
              goals={api.goals}
              activities={api.activities}
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

          {/* Confirm delete modal */}
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
                  ? (toDelete.type === "goal"
                      ? t("project.confirm.deleteGoalMessage", { title: toDelete.name }) || `Are you sure you want to delete goal "${toDelete.name}"?`
                      : toDelete.type === "task"
                      ? t("project.confirm.deleteTaskMessage", { title: toDelete.name }) || `Are you sure you want to delete task "${toDelete.name}"?`
                      : t("project.confirm.deleteActivityMessage", { title: toDelete.name }) || `Are you sure you want to delete activity "${toDelete.name}"?`)
                  : (toDelete.type === "goal"
                      ? t("project.confirm.deleteGoalMessageGeneric") || "Are you sure you want to delete this goal?"
                      : toDelete.type === "task"
                      ? t("project.confirm.deleteTaskMessageGeneric") || "Are you sure you want to delete this task?"
                      : t("project.confirm.deleteActivityMessageGeneric") || "Are you sure you want to delete this activity?")
                : t("project.confirm.deleteMessage") || "Are you sure you want to delete this item?"
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

          {/* Toast UI (global-ish single toast) */}
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