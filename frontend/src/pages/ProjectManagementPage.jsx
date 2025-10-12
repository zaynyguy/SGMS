// src/pages/ProjectManagement.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../context/AuthContext";
import TopBar from "../components/layout/TopBar";

import useProjectApi from "../hooks/useProjectApi";

import HeaderActions from "../components/project/HeaderActions";
import GoalCard from "../components/project/GoalCard";
import PaginationFooter from "../components/project/PaginationFooter";
import GenericModal from "../components/project/GenericModal";
import SubmitReportInline from "../components/project/SubmitReportInline";

import SkeletonCard from "../components/ui/SkeletonCard";

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

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [canManageGTA, setCanManageGTA] = useState(false);
  const [canViewGTA, setCanViewGTA] = useState(false);
  const [canSubmitReport, setCanSubmitReport] = useState(false);
  const [reportingActive, setReportingActive] = useState(false);

  // unified data + CRUD hook
  const api = useProjectApi();

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
          // ask the unified hook to load reporting status (it updates internal state too)
          if (typeof api.loadReportingStatus === "function") {
            await api.loadReportingStatus();
          }
          // optimistic: treat reporting active true if hook set it; the hook also stores its own reportingActive
          setReportingActive(Boolean(api.reportingActive) || true);
        } catch (err) {
          console.error("loadReportingStatus error:", err);
          setReportingActive(false);
        }
      })();
    } else {
      setReportingActive(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, api]);

  /* ----------------- Load initial data ----------------- */
  useEffect(() => {
    api.loadGoals({ page: currentPage, pageSize }).catch((e) => {
      console.error("loadGoals error:", e);
      setError(e?.message || t("project.errors.loadGoals"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

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
            setError(err?.message || t("project.errors.loadTasks"));
          }
        }
      }
    },
    [expandedGoal, api, t]
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
            setError(err?.message || t("project.errors.loadActivities"));
          }
        }
      }
    },
    [expandedTask, api, t]
  );

  /* ----------------- CRUD wrappers that call unified api ----------------- */
  const handleCreateGoal = useCallback(
    async (payload) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await api.createGoalItem(payload);
        setModal({ isOpen: false, type: null, data: null });
        setSuccess(t("project.toasts.goalCreated"));
        await api.loadGoals({ page: 1 });
      } catch (err) {
        console.error("createGoal error:", err);
        setError(err?.message || t("project.errors.createGoal"));
      } finally {
        setIsSubmitting(false);
        setTimeout(() => setSuccess(null), 2000);
      }
    },
    [api, t]
  );

  const handleUpdateGoal = useCallback(
    async (goalId, payload) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await api.updateGoalItem(goalId, payload);
        setModal({ isOpen: false, type: null, data: null });
        setSuccess(t("project.toasts.goalUpdated"));
        await api.loadGoals();
      } catch (err) {
        console.error("updateGoal error:", err);
        setError(err?.message || t("project.errors.updateGoal"));
      } finally {
        setIsSubmitting(false);
        setTimeout(() => setSuccess(null), 2000);
      }
    },
    [api, t]
  );

  const handleDeleteGoal = useCallback(
    async (goalId) => {
      if (!window.confirm(t("project.confirm.deleteGoal"))) return;
      try {
        await api.deleteGoalItem(goalId);
        setSuccess(t("project.toasts.goalDeleted"));
        await api.loadGoals();
      } catch (err) {
        console.error("deleteGoal error:", err);
        setError(err?.message || t("project.errors.deleteGoal"));
      } finally {
        setTimeout(() => setSuccess(null), 2000);
      }
    },
    [api, t]
  );

  const handleCreateTask = useCallback(
    async (goalId, payload) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await api.createTaskItem(goalId, payload);
        setModal({ isOpen: false, type: null, data: null });
        setSuccess(t("project.toasts.taskCreated"));
        await api.loadTasks(goalId);
        await api.loadGoals();
      } catch (err) {
        console.error("createTask error:", err);
        setError(err?.message || t("project.errors.createTask"));
      } finally {
        setIsSubmitting(false);
        setTimeout(() => setSuccess(null), 2000);
      }
    },
    [api, t]
  );

  const handleUpdateTask = useCallback(
    async (goalId, taskId, payload) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await api.updateTaskItem(goalId, taskId, payload);
        setModal({ isOpen: false, type: null, data: null });
        setSuccess(t("project.toasts.taskUpdated"));
        await api.loadTasks(goalId);
        await api.loadGoals();
      } catch (err) {
        console.error("updateTask error:", err);
        setError(err?.message || t("project.errors.updateTask"));
      } finally {
        setIsSubmitting(false);
        setTimeout(() => setSuccess(null), 2000);
      }
    },
    [api, t]
  );

  const handleDeleteTask = useCallback(
    async (goalId, taskId) => {
      if (!window.confirm(t("project.confirm.deleteTask"))) return;
      try {
        await api.deleteTaskItem(goalId, taskId);
        setSuccess(t("project.toasts.taskDeleted"));
        await api.loadTasks(goalId);
        await api.loadGoals();
      } catch (err) {
        console.error("deleteTask error:", err);
        setError(err?.message || t("project.errors.deleteTask"));
      } finally {
        setTimeout(() => setSuccess(null), 2000);
      }
    },
    [api, t]
  );

  const handleCreateActivity = useCallback(
    async (goalId, taskId, payload) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await api.createActivityItem(taskId, payload);
        setModal({ isOpen: false, type: null, data: null });
        setSuccess(t("project.toasts.activityCreated"));
        await api.loadActivities(taskId);
        await api.loadTasks(goalId);
        await api.loadGoals();
      } catch (err) {
        console.error("createActivity error:", err);
        setError(err?.message || t("project.errors.createActivity"));
      } finally {
        setIsSubmitting(false);
        setTimeout(() => setSuccess(null), 2000);
      }
    },
    [api, t]
  );

  const handleUpdateActivity = useCallback(
    async (goalId, taskId, activityId, payload) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await api.updateActivityItem(taskId, activityId, payload);
        setModal({ isOpen: false, type: null, data: null });
        setSuccess(t("project.toasts.activityUpdated"));
        await api.loadActivities(taskId);
        await api.loadTasks(goalId);
        await api.loadGoals();
      } catch (err) {
        console.error("updateActivity error:", err);
        setError(err?.message || t("project.errors.updateActivity"));
      } finally {
        setIsSubmitting(false);
        setTimeout(() => setSuccess(null), 2000);
      }
    },
    [api, t]
  );

  const handleDeleteActivity = useCallback(
    async (goalId, taskId, activityId) => {
      if (!window.confirm(t("project.confirm.deleteActivity"))) return;
      setIsSubmitting(true);
      setError(null);
      try {
        await api.deleteActivityItem(taskId, activityId);
        setSuccess(t("project.toasts.activityDeleted"));
        // refresh parent task & goals
        await api.loadTasks(goalId);
        await api.loadGoals();
      } catch (err) {
        console.error("deleteActivity error:", err);
        setError(err?.message || t("project.errors.deleteActivity"));
      } finally {
        setIsSubmitting(false);
        setTimeout(() => setSuccess(null), 2000);
      }
    },
    [api, t]
  );

  /* ----------------- Submit report ----------------- */
  const openSubmitModal = useCallback((goalId, taskId, activityId) => {
    setSubmitModal({ isOpen: true, data: { goalId, taskId, activityId } });
  }, []);

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
      if (metricsObj) fd.append("metrics_data", JSON.stringify(metricsObj));
      if (newStatus) fd.append("new_status", newStatus);
      if (files && files.length) {
        for (let i = 0; i < files.length; i += 1) fd.append("attachments", files[i]);
      }

      setIsSubmitting(true);
      setError(null);
      try {
        // unified hook provides submitReportForActivity
        await api.submitReportForActivity(activityId, fd);
        setSuccess(t("project.toasts.reportSubmitted"));
        closeSubmitModal();
        if (taskId) await api.loadActivities(taskId);
        if (goalId) await api.loadTasks(goalId);
        await api.loadGoals();
        setTimeout(() => setSuccess(null), 2500);
      } catch (err) {
        console.error("submitReport error:", err);
        let message = err?.message || t("project.errors.submitReport");
        // attempt to parse server response, fall back to message
        try {
          if (err?.response && typeof err.response === "object") {
            const r = err.response;
            if (r.data && (r.data.error || r.data.message)) message = r.data.error || r.data.message;
            else if (typeof r === "string") message = r;
          } else if (err?.text) {
            message = err.text;
          }
        } catch (parseErr) {}
        setError(String(message));
      } finally {
        setIsSubmitting(false);
      }
    },
    [api, t, closeSubmitModal]
  );

  /* ----------------- Filtered goals ----------------- */
  const filteredGoals = (api.goals || []).filter((g) => {
    const q = String(searchTerm || "").trim().toLowerCase();
    if (!q) return true;
    return (g.title || "").toLowerCase().includes(q) || (g.description || "").toLowerCase().includes(q);
  });

  /* ----------------- Render ----------------- */
  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 p-4 md:p-6 transition-colors duration-200">
      <div className="max-w-8xl mx-auto">
        <header className="mb-4">
          <div className="flex items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-white dark:bg-gray-800">
                {/* icon placeholder */}
                <svg className="h-6 w-6 text-sky-600" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" /></svg>
              </div>

              <div>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight">{t("project.title")}</h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t("project.subtitle")}</p>
              </div>
            </div>

            <div className="ml-auto flex-shrink-0">
              <TopBar />
            </div>
          </div>

          <HeaderActions
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            isLoadingGoals={api.isLoadingGoals}
            loadGoals={(opts) => api.loadGoals(opts)}
            canManageGTA={canManageGTA}
            onAddGoal={() => setModal({ isOpen: true, type: "createGoal", data: null })}
          />
        </header>

        <main className="grid gap-6">
          <div className="lg:col-span-8">
            {error && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-3 py-2 rounded relative">
                <div className="flex items-center gap-2"><span className="text-sm">{error}</span></div>
                <button onClick={() => setError(null)} className="absolute top-1 right-1 p-2">×</button>
              </div>
            )}

            {success && (
              <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-200 px-3 py-2 rounded relative">
                <div className="text-sm">{success}</div>
                <button onClick={() => setSuccess(null)} className="absolute top-1 right-1 p-2">×</button>
              </div>
            )}

            {api.isLoadingGoals ? (
              <>
                <SkeletonCard rows={2} />
                <SkeletonCard rows={3} />
                <SkeletonCard rows={1} />
              </>
            ) : filteredGoals.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {api.goals.length === 0 ? t("project.empty.noGoals") : t("project.empty.noMatch")}
              </div>
            ) : (
              filteredGoals.map((goal) => (
                <GoalCard
  key={goal.id}
  goal={goal}
  expandedGoal={expandedGoal}
  toggleGoal={toggleGoal}
  setSelectedGoal={setSelectedGoal}
  canManageGTA={canManageGTA}
  handleDeleteGoal={handleDeleteGoal}

  // NEW: wire to parent handlers
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

              ))
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
          <SubmitReportInline
            data={submitModal.data}
            onClose={closeSubmitModal}
            onSubmit={handleSubmitReport}
            loading={isSubmitting}
            t={t}
          />
        )}
      </div>
    </div>
  );
}
