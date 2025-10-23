import { useCallback, useEffect, useRef, useState, useMemo } from "react";
// We need to assume these API files exist and are correct.
// I've created stubs for them based on your document.
// Make sure the paths are correct for your project.
import { fetchGroups } from "../api/groups"; // Assuming 'api/groups.js'
import { fetchReportingStatus, submitReport } from "../api/reports"; // Assuming 'api/reports.js'
import { fetchGoals, createGoal, updateGoal, deleteGoal } from "../api/goals";
import { fetchTasksByGoal, createTask, updateTask, deleteTask } from "../api/tasks";
import { fetchActivitiesByTask, createActivity, updateActivity, deleteActivity } from "../api/activities";

/**
 * useProjectApi
 *
 * REFACTORED: This is the single, consolidated hook for managing
 * all project data (Groups, Goals, Tasks, Activities).
 * The redundant `useGoals`, `useTasks`, and `useActivities` hooks
 * are no longer needed, as this hook does everything.
 *
 * - Manages groups, goals, tasks, activities
 * - Dedupes in-flight loads (tasks & activities)
 * - Prefetches tasks and a small set of activities with limited concurrency
 * - Exposes derived totals: goals/tasks/activities counts & finished counts
 */
export default function useProjectApi({ initialPage = 1, initialSize = 20 } = {}) {
  // groups
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

  // generic
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  // ---- dedupe / concurrency helpers
  const inFlightTaskLoads = useRef(new Map()); // goalId -> Promise
  const inFlightActivityLoads = useRef(new Map()); // taskId -> Promise

  // small concurrency pool: limits number of concurrent iterator() executions
  async function asyncPool(items, iterator, concurrency = 3) {
    const results = [];
    const executing = new Set();
    for (const item of items) {
      const p = Promise.resolve().then(() => iterator(item));
      results.push(p);

      executing.add(p);
      const onFinally = () => executing.delete(p);
      p.then(onFinally).catch(onFinally);

      if (executing.size >= concurrency) {
        // wait for at least one to settle
        await Promise.race(executing);
      }
    }
    return Promise.allSettled(results);
  }

  /* ---------- INIT: groups + reporting ---------- */
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

  // loadTasks: dedupe concurrent loads for the same goalId
  const loadTasks = useCallback(
    async (goalId, opts = {}) => {
      if (!goalId) return [];
      if (!opts.silent) setTasksLoading((prev) => ({ ...prev, [goalId]: true }));

      const existing = inFlightTaskLoads.current.get(goalId);
      if (existing) {
        try {
          return await existing;
        } catch (err) {
          // previous in-flight failed -> continue to new attempt
        }
      }

      const promise = (async () => {
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
      })();

      inFlightTaskLoads.current.set(goalId, promise);
      promise.finally(() => inFlightTaskLoads.current.delete(goalId));
      return promise;
    },
    []
  );

  // loadActivities: dedupe concurrent loads for the same taskId
  const loadActivities = useCallback(
    async (taskId, opts = {}) => {
      if (!taskId) return [];
      if (!opts.silent) setActivitiesLoading((prev) => ({ ...prev, [taskId]: true }));

      const existing = inFlightActivityLoads.current.get(taskId);
      if (existing) {
        try {
          return await existing;
        } catch (err) {
          // prior in-flight failed, continue to new attempt
        }
      }

      const promise = (async () => {
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
      })();

      inFlightActivityLoads.current.set(taskId, promise);
      promise.finally(() => inFlightActivityLoads.current.delete(taskId));
      return promise;
    },
    []
  );

  // loadGoals: fetch goals and prefetch tasks + a limited set of activities
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

        // Prefetch tasks for the first few goals with concurrency limit
        const goalIdsToPrefetch = rows.slice(0, 6).map((g) => g.id).filter(Boolean); // up to 6 goals
        const goalConcurrency = 3;
        let prefetchedTaskLists = [];

        if (goalIdsToPrefetch.length) {
          const settled = await asyncPool(
            goalIdsToPrefetch,
            async (gId) => {
              try {
                return await loadTasks(gId, { silent: true });
              } catch (err) {
                console.warn(`prefetch tasks for goal ${gId} failed`, err);
                return null;
              }
            },
            goalConcurrency
          );

          // collect fulfilled task lists
          prefetchedTaskLists = settled
            .filter((r) => r.status === "fulfilled" && Array.isArray(r.value))
            .map((r) => r.value)
            .flat();
        }

        // From prefetched tasks, collect up to N task IDs to prefetch activities for
        const maxTasksToPrefetchActivities = 12;
        const collectedTaskIds = (prefetchedTaskLists || [])
          .slice(0, maxTasksToPrefetchActivities)
          .map((t) => t.id)
          .filter(Boolean);

        // If no prefetched tasks (e.g. the API returned empty arrays), try a conservative fallback:
        // attempt to use already-present tasks state (maybe from earlier loads)
        if (!collectedTaskIds.length) {
          const tasksSnapshot = Object.values(tasks).flat();
          collectedTaskIds.push(...tasksSnapshot.slice(0, maxTasksToPrefetchActivities).map((t) => t.id).filter(Boolean));
        }

        // Prefetch activities for selected tasks with limited concurrency
        const activityConcurrency = 3;
        if (collectedTaskIds.length) {
          await asyncPool(
            collectedTaskIds.slice(0, maxTasksToPrefetchActivities),
            async (taskId) => {
              try {
                return await loadActivities(taskId, { silent: true });
              } catch (err) {
                console.warn(`prefetch activities for task ${taskId} failed`, err);
                return null;
              }
            },
            activityConcurrency
          );
        }

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
    [currentPage, pageSize, loadTasks, loadActivities, tasks]
  );

  /* ---------- CRUD handlers (Note the function signatures) ---------- */

  const createGoalItem = useCallback(
    async (payload) => {
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
    },
    [loadGoals]
  );

  const updateGoalItem = useCallback(
    async (goalId, payload) => {
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
    },
    [loadGoals]
  );

  const deleteGoalItem = useCallback(
    async (goalId) => {
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
    },
    [loadGoals]
  );

  // --- Task Handlers ---
  const createTaskItem = useCallback(
    async (goalId, payload) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await createTask(goalId, payload);
        setSuccess("Task created");
        await loadTasks(goalId); // Reload tasks for this goal
        await loadGoals(); // Reload goals for progress %
      } catch (err) {
        console.error("createTask error:", err);
        setError(err?.message || "Failed to create task");
        throw err;
      } finally {
        setIsSubmitting(false);
        setTimeout(() => setSuccess(null), 2000);
      }
    },
    [loadTasks, loadGoals]
  );

  const updateTaskItem = useCallback(
    async (goalId, taskId, payload) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await updateTask(goalId, taskId, payload);
        setSuccess("Task updated");
        await loadTasks(goalId); // Reload tasks
        await loadGoals(); // Reload goals
      } catch (err) {
        console.error("updateTask error:", err);
        setError(err?.message || "Failed to update task");
        throw err;
      } finally {
        setIsSubmitting(false);
        setTimeout(() => setSuccess(null), 2000);
      }
    },
    [loadTasks, loadGoals]
  );

  const deleteTaskItem = useCallback(
    async (goalId, taskId) => {
      setError(null);
      try {
        await deleteTask(goalId, taskId);
        setSuccess("Task deleted");
        await loadTasks(goalId); // Reload tasks
        await loadGoals(); // Reload goals
      } catch (err) {
        console.error("deleteTask error:", err);
        setError(err?.message || "Failed to delete task");
        throw err;
      } finally {
        setTimeout(() => setSuccess(null), 2000);
      }
    },
    [loadTasks, loadGoals]
  );
  
  // --- Activity Handlers ---
  // Note: These are simpler, they only need `taskId`
  const createActivityItem = useCallback(
    async (taskId, payload) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await createActivity(taskId, payload);
        setSuccess("Activity created");
        await loadActivities(taskId); // Reload activities for this task
      } catch (err) {
        console.error("createActivity error:", err);
        setError(err?.message || "Failed to create activity");
        throw err;
      } finally {
        setIsSubmitting(false);
        setTimeout(() => setSuccess(null), 2000);
      }
    },
    [loadActivities]
  );

  const updateActivityItem = useCallback(
    async (taskId, activityId, payload) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await updateActivity(taskId, activityId, payload);
        setSuccess("Activity updated");
        await loadActivities(taskId); // Reload activities
      } catch (err) {
        console.error("updateActivity error:", err);
        setError(err?.message || "Failed to update activity");
        throw err;
      } finally {
        setIsSubmitting(false);
        setTimeout(() => setSuccess(null), 2000);
      }
    },
    [loadActivities]
  );

  const deleteActivityItem = useCallback(
    async (taskId, activityId) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await deleteActivity(taskId, activityId);
        // Optimistic update
        setActivities((prev) => ({
          ...prev,
          [taskId]: (prev[taskId] || []).filter((a) => a.id !== activityId),
        }));
        setSuccess("Activity deleted");
        await loadActivities(taskId); // Reload to confirm
      } catch (err) {
        console.error("deleteActivity error:", err);
        setError(err?.message || "Failed to delete activity");
        // Rollback optimistic update on error is complex, just reload
        await loadActivities(taskId);
        throw err;
      } finally {
        setIsSubmitting(false);
        setTimeout(() => setSuccess(null), 2000);
      }
    },
    [loadActivities]
  );

  /* ---------- Reporting (submit wrapper) ---------- */
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

  /* ---------- Derived totals (exposed) ---------- */
  const totals = useMemo(() => {
    // helper to determine completion robustly
    const isCompletedItem = (item) => {
      if (!item) return false;
      if (item.completed === true || item.isCompleted === true) return true;
      const st = (item.status || item.state || "").toString().toLowerCase();
      if (["completed", "done", "finished"].includes(st)) return true;
      const prog = Number(item.progress ?? item.progress_percent ?? item.percent ?? item.value ?? -1);
      if (!Number.isNaN(prog) && prog >= 100) return true;
      return false;
    };

    const goalsArr = Array.isArray(goals) ? goals : [];
    const goalsTotal = goalsArr.length;
    const goalsFinished = goalsArr.reduce((s, g) => s + (isCompletedItem(g) ? 1 : 0), 0);

    const tasksLists = Object.values(tasks || {});
    const tasksTotal = tasksLists.reduce((s, list) => s + (Array.isArray(list) ? list.length : 0), 0);
    const tasksFinished = tasksLists.reduce((s, list) => s + (Array.isArray(list) ? list.reduce((ss, it) => ss + (isCompletedItem(it) ? 1 : 0), 0) : 0), 0);

    const actsLists = Object.values(activities || {});
    let activitiesTotal = actsLists.reduce((s, list) => s + (Array.isArray(list) ? list.length : 0), 0);
    let activitiesFinished = actsLists.reduce((s, list) => s + (Array.isArray(list) ? list.reduce((ss, it) => ss + (isCompletedItem(it) ? 1 : 0), 0) : 0), 0);

    // If activities are not present, attempt to infer from task-level counts (best-effort)
    if (activitiesTotal === 0) {
      const allTasks = Object.values(tasks).flat();
      const inferredTotal = allTasks.reduce((s, t) => {
        return s + (Number(t.activities_count ?? t.activity_count ?? t.activitiesTotal ?? t.activityTotal ?? 0) || 0);
      }, 0);

      if (inferredTotal > 0) {
        activitiesTotal = inferredTotal;
        activitiesFinished = allTasks.reduce((s, t) => {
          const completed = Number(t.completed_activities ?? t.finished_activities ?? t.completedActivities ?? 0) || 0;
          if (completed > 0) return s + completed;
          const actCount = Number(t.activities_count ?? t.activity_count ?? 0) || 0;
          const prog = Number(t.progress ?? t.progress_percent ?? t.percent ?? -1);
          if (actCount > 0 && !Number.isNaN(prog) && prog >= 0 && prog <= 100) {
            return s + Math.round((prog / 100) * actCount);
          }
          return s;
        }, 0);
      }
    }

    return {
      goalsTotal,
      goalsFinished,
      tasksTotal,
      tasksFinished,
      activitiesTotal,
      activitiesFinished,
    };
  }, [goals, tasks, activities]);

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

    // totals + finished
    totalGoals: totals.goalsTotal,
    finishedGoals: totals.finishedGoals,
    totalTasks: totals.tasksTotal,
    finishedTasks: totals.tasksFinished,
    totalActivities: totals.activitiesTotal,
    finishedActivities: totals.activitiesFinished,

    // paging
    setCurrentPage,
    setPageSize,

    // loaders
    loadGoals,
    loadTasks,
    loadActivities,
    loadReportingStatus,

    // CRUD
    createGoalItem,
    updateGoalItem,
    deleteGoalItem,

    createTaskItem,
    updateTaskItem,
    deleteTaskItem,

    createActivityItem,
    updateActivityItem,
    deleteActivityItem,

    // reporting
    submitReportForActivity,

    // helpers
    computeGoalWeightAvailable,
    computeTaskWeightAvailable,
  };
}
