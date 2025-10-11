// src/hooks/useProjectApi.js
import { useCallback, useEffect, useState } from "react";
import { fetchGroups } from "../api/groups";
import { fetchGoals, createGoal, updateGoal, deleteGoal } from "../api/goals";
import { fetchTasksByGoal, createTask, updateTask, deleteTask } from "../api/tasks";
import { fetchActivitiesByTask, createActivity, updateActivity, deleteActivity } from "../api/activities";
import { submitReport, fetchReportingStatus } from "../api/reports";

/**
 * Combined hook that manages Goals, Tasks and Activities in one place.
 * - Keeps goals list, tasks keyed by goalId, activities keyed by taskId
 * - Exposes loaders and CRUD handlers for each entity
 *
 * Usage:
 * const project = useProjectApi({ initialPage:1, initialSize:20 });
 * project.loadGoals();
 * project.createTask(goalId, payload);
 */
export default function useProjectApi({ initialPage = 1, initialSize = 20 } = {}) {
  // groups (optional)
  const [groups, setGroups] = useState([]);

  // goals
  const [goals, setGoals] = useState([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(false);

  // tasks: { [goalId]: [...] }
  const [tasks, setTasks] = useState({});
  const [tasksLoading, setTasksLoading] = useState({});

  // activities: { [taskId]: [...] }
  const [activities, setActivities] = useState({});
  const [activitiesLoading, setActivitiesLoading] = useState({});

  // paging
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialSize);

  // reporting
  const [reportingActive, setReportingActive] = useState(null);

  // generic state
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  /* ---------- INIT / groups / reporting ---------- */
  useEffect(() => {
    (async () => {
      try {
        const g = await fetchGroups();
        setGroups(Array.isArray(g) ? g : g?.rows ?? []);
      } catch (err) {
        console.error("load groups error", err);
        setGroups([]);
      }
    })();
  }, []);

  const loadReportingStatus = useCallback(async () => {
    try {
      const resp = await fetchReportingStatus();
      setReportingActive(Boolean(resp && resp.reporting_active === true));
    } catch (err) {
      console.error("fetchReportingStatus error:", err);
      setReportingActive(false);
    }
  }, []);

  useEffect(() => {
    // attempt to fetch reporting status once (component mount)
    loadReportingStatus();
  }, [loadReportingStatus]);

  /* -------------------------
     HELPERS
  ------------------------- */
  const parseNum = (v, fallback = 0) => {
    const n = parseFloat(String(v));
    return Number.isNaN(n) ? fallback : n;
  };

  const computeGoalWeightAvailable = (goalId, excludeTaskId = null) => {
    const g = goals.find((x) => String(x.id) === String(goalId) || x.id === goalId);
    const goalWeight = Number(g?.weight ?? 100);
    const list = tasks[goalId] || [];
    const sumOther = list.reduce((s, t) => {
      if (excludeTaskId && String(t.id) === String(excludeTaskId)) return s;
      return s + Number(t.weight || 0);
    }, 0);
    return { goalWeight, used: sumOther, available: Math.max(0, goalWeight - sumOther) };
  };

  const computeTaskWeightAvailable = (taskId, excludeActivityId = null) => {
    const allTasksLists = Object.values(tasks).flat();
    const taskObj = allTasksLists.find((t) => String(t.id) === String(taskId) || t.id === taskId);
    const taskWeight = Number(taskObj?.weight ?? 0);
    const list = activities[taskId] || [];
    const sumOther = list.reduce((s, a) => {
      if (excludeActivityId && String(a.id) === String(excludeActivityId)) return s;
      return s + Number(a.weight || 0);
    }, 0);
    return { taskWeight, used: sumOther, available: Math.max(0, taskWeight - sumOther) };
  };

  /* ---------- LOADERS ---------- */
  const loadGoals = useCallback(
    async (opts = {}) => {
      setIsLoadingGoals(true);
      setError(null);
      try {
        const page = opts.page ?? currentPage;
        const size = opts.pageSize ?? pageSize;
        const resp = await fetchGoals(page, size);
        const rows = resp?.rows ?? resp ?? [];
        setGoals(rows);

        // optional: prefetch tasks for first N goals (keep it small)
        const firstFew = rows.slice(0, 2).map((g) => g.id).filter(Boolean);
        await Promise.all(firstFew.map((gId) => loadTasks(gId, { silent: true })));
        return rows;
      } catch (err) {
        console.error("loadGoals error:", err);
        setError(err?.message || "Failed to load goals");
        setGoals([]);
        throw err;
      } finally {
        setIsLoadingGoals(false);
      }
    },
    [currentPage, pageSize] // eslint-disable-line
  );

  const loadTasks = useCallback(
    async (goalId, opts = {}) => {
      if (!goalId) return;
      if (!opts.silent) setTasksLoading((prev) => ({ ...prev, [goalId]: true }));
      try {
        const resp = await fetchTasksByGoal(goalId);
        const list = Array.isArray(resp) ? resp : resp?.rows ?? [];
        setTasks((prev) => ({ ...prev, [goalId]: list }));
        return list;
      } catch (err) {
        console.error("loadTasks error:", err);
        setTasks((prev) => ({ ...prev, [goalId]: [] }));
        setError(err?.message || "Failed to load tasks");
        throw err;
      } finally {
        if (!opts.silent) setTasksLoading((prev) => ({ ...prev, [goalId]: false }));
      }
    },
    []
  );

  const loadActivities = useCallback(
    async (taskId, opts = {}) => {
      if (!taskId) return;
      if (!opts.silent) setActivitiesLoading((prev) => ({ ...prev, [taskId]: true }));
      try {
        const resp = await fetchActivitiesByTask(taskId);
        const list = Array.isArray(resp) ? resp : resp?.rows ?? [];
        setActivities((prev) => ({ ...prev, [taskId]: list }));
        return list;
      } catch (err) {
        console.error("loadActivities error:", err);
        setActivities((prev) => ({ ...prev, [taskId]: [] }));
        setError(err?.message || "Failed to load activities");
        throw err;
      } finally {
        if (!opts.silent) setActivitiesLoading((prev) => ({ ...prev, [taskId]: false }));
      }
    },
    []
  );

  /* ---------- CRUD handlers ---------- */

  // Goals
  const createGoalItem = useCallback(async (payload) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await createGoal(payload);
      setSuccess("Goal created");
      await loadGoals({ page: 1 });
    } catch (err) {
      console.error("createGoal error:", err);
      setError(err?.message || "Failed to create goal");
      throw err;
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  }, [loadGoals]);

  const updateGoalItem = useCallback(async (goalId, payload) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await updateGoal(goalId, payload);
      setSuccess("Goal updated");
      await loadGoals();
    } catch (err) {
      console.error("updateGoal error:", err);
      setError(err?.message || "Failed to update goal");
      throw err;
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  }, [loadGoals]);

  const deleteGoalItem = useCallback(async (goalId) => {
    setError(null);
    try {
      await deleteGoal(goalId);
      setSuccess("Goal deleted");
      await loadGoals();
    } catch (err) {
      console.error("deleteGoal error:", err);
      setError(err?.message || "Failed to delete goal");
      throw err;
    } finally {
      setTimeout(() => setSuccess(null), 2000);
    }
  }, [loadGoals]);

  // Tasks
  const createTaskItem = useCallback(async (goalId, payload) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await createTask(goalId, payload);
      setSuccess("Task created");
      await loadTasks(goalId);
      await loadGoals();
    } catch (err) {
      console.error("createTask error:", err);
      setError(err?.message || "Failed to create task");
      throw err;
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  }, [loadTasks, loadGoals]);

  const updateTaskItem = useCallback(async (goalId, taskId, payload) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await updateTask(goalId, taskId, payload);
      setSuccess("Task updated");
      await loadTasks(goalId);
      await loadGoals();
    } catch (err) {
      console.error("updateTask error:", err);
      setError(err?.message || "Failed to update task");
      throw err;
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  }, [loadTasks, loadGoals]);

  const deleteTaskItem = useCallback(async (goalId, taskId) => {
    setError(null);
    try {
      await deleteTask(goalId, taskId);
      setSuccess("Task deleted");
      await loadTasks(goalId);
      await loadGoals();
    } catch (err) {
      console.error("deleteTask error:", err);
      setError(err?.message || "Failed to delete task");
      throw err;
    } finally {
      setTimeout(() => setSuccess(null), 2000);
    }
  }, [loadTasks, loadGoals]);

  // Activities
  const createActivityItem = useCallback(async (taskId, payload) => {
    setIsSubmitting(true);
    setError(null);
    try {
      // API: createActivity(taskId, payload)
      await createActivity(taskId, payload);
      setSuccess("Activity created");
      await loadActivities(taskId);
      // optionally refresh parent task/goals if you need
    } catch (err) {
      console.error("createActivity error:", err);
      setError(err?.message || "Failed to create activity");
      throw err;
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  }, [loadActivities]);

  const updateActivityItem = useCallback(async (taskId, activityId, payload) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await updateActivity(taskId, activityId, payload);
      setSuccess("Activity updated");
      await loadActivities(taskId);
    } catch (err) {
      console.error("updateActivity error:", err);
      setError(err?.message || "Failed to update activity");
      throw err;
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  }, [loadActivities]);

  const deleteActivityItem = useCallback(async (taskId, activityId) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await deleteActivity(taskId, activityId);
      // optimistic removal from local state:
      setActivities((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] || []).filter((a) => a.id !== activityId),
      }));
      setSuccess("Activity deleted");
      // refresh list
      await loadActivities(taskId);
    } catch (err) {
      console.error("deleteActivity error:", err);
      setError(err?.message || "Failed to delete activity");
      throw err;
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  }, [loadActivities]);

  /* ---------- Reporting (submit report wrapper) ---------- */
  const submitReportForActivity = useCallback(
    async (activityId, formData) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await submitReport(activityId, formData);
        setSuccess("Report submitted");
        return true;
      } catch (err) {
        console.error("submitReport error:", err);
        setError(err?.message || "Failed to submit report");
        throw err;
      } finally {
        setIsSubmitting(false);
        setTimeout(() => setSuccess(null), 2000);
      }
    },
    []
  );

  /* ---------- Exports ---------- */
  return {
    // state
    groups,
    goals,
    tasks,
    activities,
    isLoadingGoals,
    tasksLoading,
    activitiesLoading,
    currentPage,
    pageSize,
    reportingActive,
    error,
    success,
    isSubmitting,

    // paging mutators
    setCurrentPage,
    setPageSize,

    // loaders
    loadGoals,
    loadTasks,
    loadActivities,
    loadReportingStatus,

    // CRUD - Goals
    createGoalItem,
    updateGoalItem,
    deleteGoalItem,

    // CRUD - Tasks
    createTaskItem,
    updateTaskItem,
    deleteTaskItem,

    // CRUD - Activities
    createActivityItem,
    updateActivityItem,
    deleteActivityItem,

    // Reporting
    submitReportForActivity,

    // helpers
    computeGoalWeightAvailable,
    computeTaskWeightAvailable,
  };
}
