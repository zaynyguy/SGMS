// src/pages/ProjectManagement.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown,
  Target,
  List,
  CheckSquare,
  Calendar,
  AlertCircle,
  Loader,
  RefreshCw,
  Search,
  X,
  Menu,
  Filter,
  MoreVertical,
} from "lucide-react";
import { fetchGroups } from "../api/groups";
import { fetchGoals, createGoal, updateGoal, deleteGoal } from "../api/goals";
import {
  fetchTasksByGoal,
  createTask,
  updateTask,
  deleteTask,
} from "../api/tasks";
import {
  fetchActivitiesByTask,
  createActivity,
  updateActivity,
  deleteActivity,
} from "../api/activities";
import { submitReport } from "../api/reports";
import { useAuth } from "../context/AuthContext";

/* -------------------------
   Helpers: date formatting
------------------------- */
const formatDate = (d) => {
  if (!d) return "—";
  try {
    const parsed = new Date(d);
    if (isNaN(parsed)) return d;
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(parsed);
  } catch {
    return d;
  }
};

/* -------------------------
   Slim / minimalist ProgressBar
   - slimmer heights
   - single subtle gradient
   - small centered label (text-xs)
   - subtle border for contrast
------------------------- */
const ProgressBar = ({ progress = 0, variant = "normal" }) => {
  const pct = Math.max(0, Math.min(100, Number(progress || 0)));
  const isGoal = variant === "goal";
  // slimmer sizes per request (slick/minimal)
  const heightClass = isGoal ? "h-5" : "h-4";
  const fillGradient = isGoal
    ? "bg-gradient-to-r from-indigo-500 to-indigo-600"
    : "bg-gradient-to-r from-sky-400 to-indigo-500";

  const labelInFill = pct >= 30;
  const labelClass = labelInFill
    ? "text-white font-medium text-xs"
    : "text-gray-800 dark:text-gray-200 font-medium text-xs";

  return (
    <div
      className={`relative ${heightClass} rounded-md overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={`Progress ${pct}%`}
    >
      <div
        className={`absolute left-0 top-0 bottom-0 ${fillGradient} transition-all duration-500 ease-out`}
        style={{
          width: `${pct}%`,
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-2">
        <span className={labelClass}>{pct}%</span>
      </div>
    </div>
  );
};

/* -------------------------
   Status badge consistent in dark mode
------------------------- */
const StatusBadge = ({ status }) => {
  const normalized = (status || "")
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-");
  const statusClasses = {
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    "in-progress": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    "not-started": "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  };
  const cls = statusClasses[normalized] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls} whitespace-nowrap`}>
      {status ? String(status).replace(/-/g, " ") : "N/A"}
    </span>
  );
};

/* -------------------------
   Skeleton: loading placeholder that mimics final cards
------------------------- */
const SkeletonCard = ({ rows = 3 }) => (
  <div className="animate-pulse w-full">
    <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-100 dark:border-gray-700 shadow-sm mb-4">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded bg-gray-300 dark:bg-gray-700" />
        <div className="flex-1 space-y-3 py-1">
          <div className="h-5 w-2/3 bg-gray-300 dark:bg-gray-700 rounded" />
          <div className="h-4 w-1/3 bg-gray-300 dark:bg-gray-700 rounded" />
          <div className="flex gap-2 items-center">
            <div className="h-3 w-20 bg-gray-300 dark:bg-gray-700 rounded" />
            <div className="h-3 w-16 bg-gray-300 dark:bg-gray-700 rounded" />
            <div className="h-3 w-10 bg-gray-300 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-gray-300 dark:bg-gray-700" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-2/3 bg-gray-300 dark:bg-gray-700 rounded" />
              <div className="h-3 w-1/3 bg-gray-300 dark:bg-gray-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* -------------------------
   Main component
------------------------- */
const ProjectManagement = () => {
  const { user } = useAuth();

  const [groups, setGroups] = useState([]);
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState({});
  const [activities, setActivities] = useState({});

  const [isLoadingGoals, setIsLoadingGoals] = useState(true);
  const [tasksLoading, setTasksLoading] = useState({});
  const [activitiesLoading, setActivitiesLoading] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expandedGoal, setExpandedGoal] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);

  const [modal, setModal] = useState({ isOpen: false, type: null, data: null });
  const [submitModal, setSubmitModal] = useState({ isOpen: false, data: null });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const [canManageGTA, setCanManageGTA] = useState(false);
  const [canViewGTA, setCanViewGTA] = useState(false);

  // derive permissions
  useEffect(() => {
    if (user) {
      const perms = Array.isArray(user?.permissions) ? user.permissions : user?.user?.permissions || [];
      setCanManageGTA(perms.includes("manage_gta"));
      setCanViewGTA(perms.includes("view_gta") || perms.includes("manage_gta"));
    }
  }, [user]);

  /* ---------- LOADERS ---------- */
  const loadGoals = useCallback(
    async (opts = {}) => {
      setIsLoadingGoals(true);
      setError(null);
      try {
        const page = opts.page || currentPage;
        const size = opts.pageSize || pageSize;
        const resp = await fetchGoals(page, size);
        const rows = resp?.rows ?? resp ?? [];
        setGoals(rows);

        // prefetch tasks for first couple goals
        const firstFew = rows.slice(0, 2).map((g) => g.id).filter(Boolean);
        await Promise.all(firstFew.map((gId) => loadTasks(gId, { silent: true })));
      } catch (err) {
        console.error("loadGoals error:", err);
        setError(err?.message || "Failed to load goals");
        setGoals([]);
      } finally {
        setIsLoadingGoals(false);
      }
    },
    [currentPage, pageSize]
  );

  useEffect(() => {
    const loadGroups = async () => {
      try {
        const resp = await fetchGroups();
        setGroups(Array.isArray(resp) ? resp : resp?.rows ?? []);
      } catch (err) {
        console.error("Failed to load groups:", err);
        setGroups([]);
      }
    };
    loadGroups();
  }, []);

  useEffect(() => {
    loadGoals();
  }, [currentPage, pageSize, loadGoals]);

  const loadTasks = useCallback(async (goalId, opts = {}) => {
    if (!goalId) return;
    if (!opts.silent) setTasksLoading((prev) => ({ ...prev, [goalId]: true }));
    try {
      const resp = await fetchTasksByGoal(goalId);
      const list = Array.isArray(resp) ? resp : resp?.rows ?? [];
      setTasks((prev) => ({ ...prev, [goalId]: list }));
    } catch (err) {
      console.error("loadTasks error:", err);
      setTasks((prev) => ({ ...prev, [goalId]: [] }));
      setError(err?.message || "Failed to load tasks");
    } finally {
      if (!opts.silent) setTasksLoading((prev) => ({ ...prev, [goalId]: false }));
    }
  }, []);

  const loadActivities = useCallback(async (taskId) => {
    if (!taskId) return;
    setActivitiesLoading((prev) => ({ ...prev, [taskId]: true }));
    try {
      const resp = await fetchActivitiesByTask(taskId);
      const list = Array.isArray(resp) ? resp : resp?.rows ?? [];
      setActivities((prev) => ({ ...prev, [taskId]: list }));
    } catch (err) {
      console.error("loadActivities error:", err);
      setActivities((prev) => ({ ...prev, [taskId]: [] }));
      setError(err?.message || "Failed to load activities");
    } finally {
      setActivitiesLoading((prev) => ({ ...prev, [taskId]: false }));
    }
  }, []);

  /* ---------- CRUD handlers (unchanged semantics) ---------- */
  const handleCreateGoal = async (payload) => {
    setIsSubmitting(true);
    try {
      await createGoal(payload);
      setModal({ isOpen: false, type: null, data: null });
      setSuccess("Goal created");
      await loadGoals({ page: 1 });
    } catch (err) {
      console.error("createGoal error:", err);
      setError(err?.message || "Failed to create goal");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  };
  const handleUpdateGoal = async (goalId, payload) => {
    setIsSubmitting(true);
    try {
      await updateGoal(goalId, payload);
      setModal({ isOpen: false, type: null, data: null });
      setSuccess("Goal updated");
      await loadGoals();
    } catch (err) {
      console.error("updateGoal error:", err);
      setError(err?.message || "Failed to update goal");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  };
  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm("Delete this goal and all children?")) return;
    try {
      await deleteGoal(goalId);
      setSuccess("Goal deleted");
      await loadGoals();
    } catch (err) {
      console.error("deleteGoal error:", err);
      setError(err?.message || "Failed to delete goal");
    } finally {
      setTimeout(() => setSuccess(null), 2000);
    }
  };

  const handleCreateTask = async (goalId, payload) => {
    setIsSubmitting(true);
    try {
      await createTask(goalId, payload);
      setModal({ isOpen: false, type: null, data: null });
      setSuccess("Task created");
      await loadTasks(goalId);
      await loadGoals();
    } catch (err) {
      console.error("createTask error:", err);
      setError(err?.message || "Failed to create task");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  };
  const handleUpdateTask = async (goalId, taskId, payload) => {
    setIsSubmitting(true);
    try {
      await updateTask(goalId, taskId, payload);
      setModal({ isOpen: false, type: null, data: null });
      setSuccess("Task updated");
      await loadTasks(goalId);
      await loadGoals();
    } catch (err) {
      console.error("updateTask error:", err);
      setError(err?.message || "Failed to update task");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  };
  const handleDeleteTask = async (goalId, taskId) => {
    if (!window.confirm("Delete this task and activities?")) return;
    try {
      await deleteTask(goalId, taskId);
      setSuccess("Task deleted");
      await loadTasks(goalId);
      await loadGoals();
    } catch (err) {
      console.error("deleteTask error:", err);
      setError(err?.message || "Failed to delete task");
    } finally {
      setTimeout(() => setSuccess(null), 2000);
    }
  };

  const handleCreateActivity = async (goalId, taskId, payload) => {
    setIsSubmitting(true);
    try {
      await createActivity(taskId, payload);
      setModal({ isOpen: false, type: null, data: null });
      setSuccess("Activity created");
      await loadActivities(taskId);
      await loadTasks(goalId);
      await loadGoals();
    } catch (err) {
      console.error("createActivity error:", err);
      setError(err?.message || "Failed to create activity");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  };
  const handleUpdateActivity = async (goalId, taskId, activityId, payload) => {
    setIsSubmitting(true);
    try {
      await updateActivity(taskId, activityId, payload);
      setModal({ isOpen: false, type: null, data: null });
      setSuccess("Activity updated");
      await loadActivities(taskId);
      await loadTasks(goalId);
      await loadGoals();
    } catch (err) {
      console.error("updateActivity error:", err);
      setError(err?.message || "Failed to update activity");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  };
  const handleDeleteActivity = async (goalId, taskId, activityId) => {
    if (!window.confirm("Delete this activity?")) return;
    setIsSubmitting(true);
    try {
      await deleteActivity(taskId, activityId);
      setActivities((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] || []).filter((a) => a.id !== activityId),
      }));
      setSuccess("Activity deleted");
      await loadTasks(goalId);
      await loadGoals();
    } catch (err) {
      console.error("deleteActivity error:", err);
      setError(err?.message || "Failed to delete activity");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  };

  /* ---------- Helpers ---------- */
  const filteredGoals = (goals || []).filter((g) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (g.title || "").toLowerCase().includes(q) || (g.description || "").toLowerCase().includes(q);
  });

  const toggleGoal = async (goal) => {
    if (expandedGoal === goal.id) setExpandedGoal(null);
    else {
      setExpandedGoal(goal.id);
      if (!tasks[goal.id]) await loadTasks(goal.id);
    }
  };

  const toggleTask = async (goal, task) => {
    if (expandedTask === task.id) setExpandedTask(null);
    else {
      setExpandedTask(task.id);
      if (!activities[task.id]) await loadActivities(task.id);
    }
  };

  /* ---------- Submit report modal handlers ---------- */
  const openSubmitModal = (goalId, taskId, activityId) => {
    setSubmitModal({ isOpen: true, data: { goalId, taskId, activityId } });
  };

  const closeSubmitModal = () => {
    setSubmitModal({ isOpen: false, data: null });
  };

  const handleSubmitReport = async (formState) => {
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
      for (let i = 0; i < files.length; i += 1) {
        fd.append("attachments", files[i]);
      }
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await submitReport(activityId, fd);
      setSuccess("Report submitted");
      closeSubmitModal();
      if (taskId) await loadActivities(taskId);
      if (goalId) await loadTasks(goalId);
      await loadGoals();
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      console.error("submitReport error (full):", err);
      let message = err?.message || "Failed to submit report.";
      try {
        if (err?.response && typeof err.response === "object") {
          const r = err.response;
          if (r.data && (r.data.error || r.data.message)) {
            message = r.data.error || r.data.message;
          } else if (typeof r === "string") {
            message = r;
          }
        } else if (err?.text) {
          message = err.text;
        } else {
          const maybeJson = String(message).match(/(\{.*\})/s);
          if (maybeJson) {
            const parsed = JSON.parse(maybeJson[1]);
            message = parsed.message || parsed.error || JSON.stringify(parsed);
          }
        }
      } catch (parseErr) {}
      setError(String(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------- Render ---------- */
  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 p-4 md:p-6 transition-colors duration-200">
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        ></div>
      )}
      
      <header className="mb-4 min-w-8xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-gradient-to-br from-purple-50 to-sky-50 dark:from-purple-900/10 dark:to-sky-900/10">
                <Target className="h-6 w-6 text-sky-600 dark:text-sky-300" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">Project Manager</h1>
                {/* description removed per request */}
              </div>
            </div>
            
            <button 
              className="md:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>

          {/* Mobile menu */}
          <div className={`${mobileMenuOpen ? 'block' : 'hidden'} md:flex md:items-center gap-2 w-full md:w-auto md:flex-nowrap mt-4 md:mt-0`}>
            <div className="relative flex-1 md:flex-none min-w-0">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search goals..."
                className="pl-10 pr-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-sm w-full min-w-0 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 mt-2 md:mt-0">
              <button
                onClick={() => loadGoals({ page: 1 })}
                className="px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700 dark:text-white text-sm flex items-center gap-2 whitespace-nowrap w-full md:w-auto justify-center"
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>

              {canManageGTA && (
                <button
                  onClick={() => setModal({ isOpen: true, type: "createGoal", data: null })}
                  className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm flex items-center gap-2 whitespace-nowrap w-full md:w-auto justify-center"
                >
                  <Plus className="h-4 w-4" /> Add Goal
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="min-w-8xl mx-auto">
        {/* Filters (optional - can be expanded)
        <div className="mb-4 flex justify-between items-center">
          <button 
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <Filter className="h-4 w-4" /> Filters
          </button>
          
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {filteredGoals.length} of {goals.length} goals
          </div>
        </div>
        
        {filterOpen && (
          <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3 text-sm">
                  <option>All Statuses</option>
                  <option>Active</option>
                  <option>Completed</option>
                  <option>Not Started</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group</label>
                <select className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3 text-sm">
                  <option>All Groups</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date Range</label>
                <select className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3 text-sm">
                  <option>All Time</option>
                  <option>This Week</option>
                  <option>This Month</option>
                  <option>This Quarter</option>
                </select>
              </div>
            </div>
          </div>
        )} */}

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-3 py-2 rounded relative">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="absolute top-1 right-1 p-2">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-200 px-3 py-2 rounded relative">
            <div className="text-sm">{success}</div>
            <button onClick={() => setSuccess(null)} className="absolute top-1 right-1 p-2">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {isLoadingGoals ? (
          // show several skeletons to match number of cards we usually show
          <>
            <SkeletonCard rows={2} />
            <SkeletonCard rows={3} />
            <SkeletonCard rows={1} />
          </>
        ) : filteredGoals.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {goals.length === 0 ? "No goals found. Create your first goal." : "No goals match your search."}
          </div>
        ) : (
          filteredGoals.map((goal) => (
            <article
              key={goal.id}
              className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-lg mb-6 overflow-hidden"
            >
              <div className="p-5 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <button
                      onClick={() => toggleGoal(goal)}
                      className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hidden sm:block"
                      aria-label="Toggle goal"
                    >
                      {expandedGoal === goal.id ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between">
                        <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white break-words">{goal.title}</h3>
                        
                        <div className="md:hidden flex items-center gap-2 ml-2">
                          <button
                            onClick={() => toggleGoal(goal)}
                            className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                            aria-label="Toggle goal"
                          >
                            {expandedGoal === goal.id ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                          </button>
                          
                          {canManageGTA && (
                            <div className="relative">
                              <button className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                                <MoreVertical className="h-5 w-5" />
                              </button>
                              <div className="absolute right-0 mt-1 w-fit bg-white dark:bg-gray-900 rounded-md shadow-lg py-1 z-10 border border-gray-200 dark:border-gray-700">
                                <button
                                  onClick={() => setModal({ isOpen: true, type: "editGoal", data: goal })}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  <Edit/>
                                </button>
                                <button 
                                  onClick={() => handleDeleteGoal(goal.id)}
                                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  <Trash2/>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 break-words">{goal.description || "—"}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-300">
                        <span className="whitespace-nowrap">
                          Group:{" "}
                          <strong className="text-gray-800 dark:text-gray-100">{goal.groupName || "Unassigned"}</strong>
                        </span>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <StatusBadge status={goal.status} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-4 md:mt-0">
                    <div className="hidden md:flex flex-col items-end text-xs text-gray-500 dark:text-gray-300 mr-3 w-36">
                      <div className="w-full">
                        <ProgressBar progress={goal.progress ?? 0} variant="goal" />
                      </div>
                    </div>

                    {canManageGTA && (
                      <div className="hidden md:flex items-center gap-2">
                        <button
                          onClick={() => setModal({ isOpen: true, type: "editGoal", data: goal })}
                          className="p-2 text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button onClick={() => handleDeleteGoal(goal.id)} className="p-2 text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-600 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 flex-shrink-0" /> 
                    <span className="truncate">{formatDate(goal.startDate)} — {formatDate(goal.endDate)}</span>
                  </div>
                  <div>
                    Weight: <strong className="text-gray-800 dark:text-gray-100">{goal.weight ?? "-"}</strong>
                  </div>
                  <div className="flex items-center gap-3 md:hidden">
                    <div className="flex-1 max-w-xs">
                      <ProgressBar progress={goal.progress ?? 0} variant="goal" />
                    </div>
                  </div>
                </div>

                {expandedGoal === goal.id && (
                  <div className="mt-6 pl-0 sm:pl-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-sky-600" /> Tasks
                      </h4>
                      <div>
                        {canManageGTA && (
                          <button
                            onClick={() => setModal({ isOpen: true, type: "createTask", data: { goalId: goal.id } })}
                            className="px-2 py-1 bg-blue-500 text-white rounded text-xs flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" /> Add Task
                          </button>
                        )}
                      </div>
                    </div>

                    {tasksLoading[goal.id] ? (
                      <div className="p-3">
                        <Loader className="h-6 w-6 animate-spin text-sky-600" />
                      </div>
                    ) : (tasks[goal.id] || []).length === 0 ? (
                      <div className="p-3 text-sm text-gray-500 dark:text-gray-400">No tasks for this goal.</div>
                    ) : (
                      <div className="space-y-3">
                        {tasks[goal.id].map((task) => (
                          <div key={task.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-100 dark:border-gray-700">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 min-w-0">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <button
                                  onClick={() => toggleTask(goal, task)}
                                  className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hidden sm:block"
                                  aria-label="Toggle task"
                                >
                                  {expandedTask === task.id ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                </button>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between">
                                    <div className="font-medium text-gray-900 dark:text-white break-words">{task.title}</div>
                                    
                                    <div className="sm:hidden flex items-center gap-2 ml-2">
                                      <button
                                        onClick={() => toggleTask(goal, task)}
                                        className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        aria-label="Toggle task"
                                      >
                                        {expandedTask === task.id ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                      </button>
                                      
                                      {canManageGTA && (
                                        <div className="relative">
                                          <button className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                                            <MoreVertical className="h-5 w-5" />
                                          </button>
                                          <div className="absolute right-0 mt-1 w-fit bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10 border border-gray-200 dark:border-gray-700">
                                            <button
                                              onClick={() => setModal({ isOpen: true, type: "editTask", data: { goalId: goal.id, ...task } })}
                                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                            >
                                              <Edit/>
                                            </button>
                                            <button 
                                              onClick={() => handleDeleteTask(goal.id, task.id)}
                                              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                                            >
                                              <Trash2/>
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words">{task.description || "—"}</div>
                                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-3">
                                    <div>Due: {formatDate(task.dueDate)}</div>
                                    <div>Weight: {task.weight ?? "-"}</div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 whitespace-nowrap justify-between sm:justify-end">
                                <StatusBadge status={task.status} />
                                {canManageGTA && (
                                  <>
                                    <button
                                      onClick={() => setModal({ isOpen: true, type: "editTask", data: { goalId: goal.id, ...task } })}
                                      className="p-2 text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md hidden sm:block"
                                    >
                                      <Edit className="h-5 w-5" />
                                    </button>
                                    <button onClick={() => handleDeleteTask(goal.id, task.id)} className="p-2 text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md hidden sm:block">
                                      <Trash2 className="h-5 w-5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-600 dark:text-gray-300 pl-0 sm:pl-6">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 flex-shrink-0" /> 
                                <span className="truncate">{formatDate(task.dueDate)}</span>
                              </div>
                              <div>
                                Weight: <strong>{task.weight ?? "-"}</strong>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 max-w-xs">
                                  <ProgressBar progress={task.progress ?? 0} />
                                </div>
                              </div>
                            </div>

                            {expandedTask === task.id && (
                              <div className="mt-4 pl-0 sm:pl-6">
                                <div className="flex items-center justify-between mb-2">
                                  <h6 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <List className="h-4 w-4 text-sky-600" /> Activities
                                  </h6>
                                  <div>
                                    {canManageGTA && (
                                      <button
                                        onClick={() => setModal({ isOpen: true, type: "createActivity", data: { goalId: goal.id, taskId: task.id } })}
                                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded"
                                      >
                                        Add Activity
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {activitiesLoading[task.id] ? (
                                  <div className="p-2">
                                    <Loader className="h-5 w-5 animate-spin text-sky-600" />
                                  </div>
                                ) : (activities[task.id] || []).length === 0 ? (
                                  <div className="p-2 text-sm text-center text-gray-500 dark:text-gray-400">No activities for this task.</div>
                                ) : (
                                  <div className="space-y-2">
                                    {activities[task.id].map((activity) => (
                                      <div key={activity.id} className="p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                          <div className="font-medium text-gray-900 dark:text-white break-words">{activity.title}</div>
                                          <div className="text-xs text-gray-500 dark:text-gray-300 mt-1 break-words">{activity.description || "—"}</div>

                                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-300 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                            <div>Due: {formatDate(activity.dueDate)}</div>
                                            <div>Weight: {activity.weight ?? "-"}</div>
                                            <div>{activity.isDone ? "Completed" : "Open"}</div>
                                          </div>

                                          {activity.targetMetric && (
                                            <div className="mt-2 text-xs p-2 rounded bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100">
                                              <div className="font-medium text-xs mb-1">Target Metrics</div>
                                              <div className="space-y-1">{renderMetricsList(activity.targetMetric)}</div>
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex flex-col sm:items-end gap-2 mt-2 sm:mt-0">
                                          <StatusBadge status={activity.status} />
                                          <div className="flex items-center gap-2 whitespace-nowrap justify-between sm:justify-end">
                                            {canManageGTA && (
                                              <>
                                                <button
                                                  onClick={() => setModal({ isOpen: true, type: "editActivity", data: { goalId: goal.id, taskId: task.id, ...activity } })}
                                                  className="p-1 text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md hidden sm:block"
                                                >
                                                  <Edit className="h-5 w-5" />
                                                </button>
                                                <button onClick={() => handleDeleteActivity(goal.id, task.id, activity.id)} className="p-1 text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md hidden sm:block">
                                                  <Trash2 className="h-5 w-5" />
                                                </button>
                                              </>
                                            )}

                                            {(canViewGTA || canManageGTA) && (
                                              <button onClick={() => openSubmitModal(goal.id, task.id, activity.id)} className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs">
                                                Submit Report
                                              </button>
                                            )}
                                            
                                            {canManageGTA && (
                                              <div className="sm:hidden relative">
                                                <button className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                                                  <MoreVertical className="h-4 w-4" />
                                                </button>
                                                <div className="flex mt-1 w-fit bg-white dark:bg-gray-900 rounded-md shadow-lg py-1 z-10 border border-gray-200 dark:border-gray-700">
                                                  <button
                                                    onClick={() => setModal({ isOpen: true, type: "editActivity", data: { goalId: goal.id, taskId: task.id, ...activity } })}
                                                    className="block w-fit text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                  >
                                                    <Edit/>
                                                  </button>
                                                  <button 
                                                    onClick={() => handleDeleteActivity(goal.id, task.id, activity.id)}
                                                    className="block w-fit text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                  >
                                                    <Trash2/>
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))
        )}

        {/* pagination footer */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing {Math.min((currentPage - 1) * pageSize + 1, goals.length)} - {Math.min(currentPage * pageSize, goals.length)} of {goals.length}
          </div>
          <div className="flex items-center gap-2">
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="px-2 py-1 rounded-md bg-white dark:bg-gray-700 border text-sm text-gray-700 dark:text-gray-200">
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200">
              Previous
            </button>
            <button onClick={() => setCurrentPage((p) => p + 1)} className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200">
              Next
            </button>
          </div>
        </div>
      </main>

      {/* Generic modal: pass tasks+goals+activities so modal can validate weights */}
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
        />
      )}

      {/* Submit Report modal */}
      {submitModal.isOpen && submitModal.data && (
        <SubmitReportInline data={submitModal.data} onClose={closeSubmitModal} onSubmit={handleSubmitReport} loading={isSubmitting} />
      )}
    </div>
  );
};

export default ProjectManagement;

/* ---------------------------
   GenericModal (improved styling + weight validation)
   Receives: modal, setModal, groups, tasks, goals, activities, handlers...
----------------------------*/
function GenericModal({
  modal,
  setModal,
  groups = [],
  tasks = {},
  goals = [],
  activities = {},
  onCreateGoal,
  onUpdateGoal,
  onCreateTask,
  onUpdateTask,
  onCreateActivity,
  onUpdateActivity,
  isSubmitting,
}) {
  const [local, setLocal] = React.useState({});
  const [jsonError, setJsonError] = React.useState(null);
  const [inlineError, setInlineError] = React.useState(null);

  const metricsObjectToArray = (tm) => {
    try {
      if (!tm) return [{ key: "", value: "" }];
      let obj = tm;
      if (typeof tm === "string") {
        obj = tm.trim() === "" ? {} : JSON.parse(tm);
      }
      if (typeof obj !== "object" || Array.isArray(obj)) return [{ key: "", value: "" }];
      const arr = Object.keys(obj).map((k) => ({ key: k, value: String(obj[k]) }));
      if (arr.length === 0) return [{ key: "", value: "" }];
      return arr;
    } catch (err) {
      return [{ key: "", value: "" }];
    }
  };

  React.useEffect(() => {
    if (!modal.isOpen) return;
    const initial = modal.data || {};
    setInlineError(null);
    if (modal.type === "createActivity" || modal.type === "editActivity") {
      setLocal({
        title: initial.title || "",
        description: initial.description || "",
        dueDate: initial.dueDate || "",
        weight: initial.weight ?? 0,
        status: initial.status || "not-started",
        isDone: initial.isDone ?? false,
        targetMetrics: metricsObjectToArray(initial.targetMetric),
      });
    } else if (modal.type === "createTask" || modal.type === "editTask") {
      setLocal({
        title: initial.title || "",
        description: initial.description || "",
        dueDate: initial.dueDate || "",
        weight: initial.weight ?? 0,
        status: initial.status || "not-started",
      });
    } else if (modal.type === "createGoal" || modal.type === "editGoal") {
      setLocal({
        title: initial.title || "",
        description: initial.description || "",
        groupId: initial.groupId ? String(initial.groupId) : "",
        startDate: initial.startDate || "",
        endDate: initial.endDate || "",
        weight: initial.weight ?? 100,
        status: initial.status || "active",
      });
    } else {
      setLocal({});
    }
    setJsonError(null);
  }, [modal.isOpen, modal.type, modal.data]);

  if (!modal.isOpen) return null;

  const onLocalChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLocal((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
    if (name === "targetMetric" && jsonError) setJsonError(null);
    if (inlineError) setInlineError(null);
  };

  const updateMetricRow = (idx, field, value) => {
    setLocal((p) => {
      const next = { ...(p || {}) };
      const arr = Array.isArray(next.targetMetrics) ? [...next.targetMetrics] : [];
      arr[idx] = { ...(arr[idx] || {}), [field]: value };
      next.targetMetrics = arr;
      return next;
    });
  };

  const addMetricRow = () => {
    setLocal((p) => {
      const next = { ...(p || {}) };
      next.targetMetrics = Array.isArray(next.targetMetrics) ? [...next.targetMetrics, { key: "", value: "" }] : [{ key: "", value: "" }];
      return next;
    });
  };

  const removeMetricRow = (idx) => {
    setLocal((p) => {
      const next = { ...(p || {}) };
      next.targetMetrics = (Array.isArray(next.targetMetrics) ? next.targetMetrics.filter((_, i) => i !== idx) : []).length
        ? next.targetMetrics.filter((_, i) => i !== idx)
        : [{ key: "", value: "" }];
      return next;
    });
  };

  const computeGoalWeightAvailable = (goalId, excludeTaskId = null) => {
    const g = goals.find((x) => String(x.id) === String(goalId) || x.id === goalId);
    const goalWeight = Number(g?.weight ?? 100);
    const list = tasks[goalId] || [];
    const sumOther = list.reduce((s, t) => {
      if (excludeTaskId && (String(t.id) === String(excludeTaskId))) return s;
      return s + Number(t.weight || 0);
    }, 0);
    return { goalWeight, used: sumOther, available: Math.max(0, goalWeight - sumOther) };
  };

  const computeTaskWeightAvailable = (taskId, excludeActivityId = null) => {
    const // find task and its weight fallback
      allTasksLists = Object.values(tasks).flat();
    const task = allTasksLists.find((t) => String(t.id) === String(taskId) || t.id === taskId);
    const taskWeight = Number(task?.weight ?? 0);
    const list = activities[taskId] || [];
    const sumOther = list.reduce((s, a) => {
      if (excludeActivityId && (String(a.id) === String(excludeActivityId))) return s;
      return s + Number(a.weight || 0);
    }, 0);
    return { taskWeight, used: sumOther, available: Math.max(0, taskWeight - sumOther) };
  };

  const submitLocal = async (e) => {
    if (e) e.preventDefault();
    try {
      setInlineError(null);

      // Task create/edit weight validation (client-side)
      if (modal.type === "createTask" || modal.type === "editTask") {
        const goalId = modal.data?.goalId;
        if (!goalId) {
          setInlineError("Missing goal id for task.");
          return;
        }
        const newWeight = Number(local.weight || 0);
        const excludeTaskId = modal.type === "editTask" ? modal.data?.id : null;
        const { goalWeight, used, available } = computeGoalWeightAvailable(goalId, excludeTaskId);

        if (newWeight < 0) {
          setInlineError("Task weight must be >= 0.");
          return;
        }

        if (newWeight > available) {
          setInlineError(
            `Cannot set task weight to ${newWeight}. Goal total is ${goalWeight} and ${used} is already used by other tasks. Available: ${available}.`
          );
          return;
        }
      }

      // Activity create/edit weight validation (client-side)
      if (modal.type === "createActivity" || modal.type === "editActivity") {
        const taskId = modal.data?.taskId;
        if (!taskId) {
          setInlineError("Missing task id for activity.");
          return;
        }
        const newWeight = Number(local.weight || 0);
        const excludeActivityId = modal.type === "editActivity" ? modal.data?.id : null;
        const { taskWeight, used, available } = computeTaskWeightAvailable(taskId, excludeActivityId);

        if (newWeight < 0) {
          setInlineError("Activity weight must be >= 0.");
          return;
        }

        if (newWeight > available) {
          setInlineError(
            `Cannot set activity weight to ${newWeight}. Task total is ${taskWeight} and ${used} is already used by other activities. Available: ${available}.`
          );
          return;
        }
      }

      if (modal.type === "createGoal") {
        const payload = {
          ...local,
          groupId: local.groupId === "" ? null : Number(local.groupId),
        };
        await onCreateGoal(payload);
        return;
      }
      if (modal.type === "editGoal") {
        const { id } = modal.data || {};
        const payload = {
          ...local,
          groupId: local.groupId === "" ? null : Number(local.groupId),
        };
        await onUpdateGoal(id, payload);
        return;
      }
      if (modal.type === "createTask") {
        const goalId = modal.data?.goalId;
        await onCreateTask(goalId, local);
        return;
      }
      if (modal.type === "editTask") {
        const goalId = modal.data?.goalId;
        const id = modal.data?.id;
        await onUpdateTask(goalId, id, local);
        return;
      }
      if (modal.type === "createActivity") {
        const { goalId, taskId } = modal.data || {};
        const payload = { ...local };
        if (Array.isArray(local.targetMetrics)) {
          const obj = {};
          local.targetMetrics.forEach((m) => {
            if (m && String(m.key).trim() !== "") {
              obj[String(m.key).trim()] = m.value ?? "";
            }
          });
          payload.targetMetric = obj;
        }
        delete payload.targetMetrics;
        await onCreateActivity(goalId, taskId, payload);
        return;
      }
      if (modal.type === "editActivity") {
        const { goalId, taskId, id } = modal.data || {};
        const payload = { ...local };
        if (Array.isArray(local.targetMetrics)) {
          const obj = {};
          local.targetMetrics.forEach((m) => {
            if (m && String(m.key).trim() !== "") {
              obj[String(m.key).trim()] = m.value ?? "";
            }
          });
          payload.targetMetric = obj;
        }
        delete payload.targetMetrics;
        await onUpdateActivity(goalId, taskId, id, payload);
        return;
      }
    } catch (err) {
      console.error("modal submit error", err);
      setInlineError(err?.message || "Failed to submit");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded shadow overflow-auto max-h-[90vh]">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {modal.type === "createGoal" && "Create Goal"}
            {modal.type === "editGoal" && "Edit Goal"}
            {modal.type === "createTask" && "Create Task"}
            {modal.type === "editTask" && "Edit Task"}
            {modal.type === "createActivity" && "Create Activity"}
            {modal.type === "editActivity" && "Edit Activity"}
          </h3>
          <button onClick={() => setModal({ isOpen: false, type: null, data: null })} className="text-gray-400 hover:text-gray-600">
            &times;
          </button>
        </div>

        <form onSubmit={submitLocal} className="px-4 py-4 space-y-3">
          {(modal.type === "createActivity" || modal.type === "editActivity") && (
            <>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Title *</label>
              <input name="title" value={local.title || ""} onChange={(e) => onLocalChange(e)} required className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />

              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea name="description" value={local.description || ""} onChange={(e) => onLocalChange(e)} rows="3" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Due Date</label>
                  <input name="dueDate" value={local.dueDate || ""} onChange={(e) => onLocalChange(e)} type="date" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Weight</label>
                  <input name="weight" value={local.weight ?? 0} onChange={(e) => onLocalChange(e)} type="number" min="0" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>

              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <select name="status" value={local.status || "not-started"} onChange={(e) => onLocalChange(e)} className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="not-started">Not Started</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>

              {/* show available space for activity within task */}
              {modal.data?.taskId && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                  {(() => {
                    const { taskWeight, used, available } = computeTaskWeightAvailable(modal.data.taskId, modal.type === "editActivity" ? modal.data?.id : null);
                    return (
                      <span>
                        Task total: <strong className="text-gray-800 dark:text-gray-100">{taskWeight}</strong>. Used by other activities: <strong>{used}</strong>. Available: <strong>{available}</strong>.
                      </span>
                    );
                  })()}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Target Metrics</label>
                <div className="mt-2 space-y-2">
                  {(Array.isArray(local.targetMetrics) ? local.targetMetrics : [{ key: "", value: "" }]).map((m, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input placeholder="Key" value={m?.key || ""} onChange={(e) => updateMetricRow(idx, "key", e.target.value)} className="flex-1 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
                      <input placeholder="Value" value={m?.value || ""} onChange={(e) => updateMetricRow(idx, "value", e.target.value)} className="flex-1 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
                      <button type="button" onClick={() => removeMetricRow(idx)} className="px-2 py-1 bg-red-500 text-white rounded text-xs">X</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addMetricRow} className="mt-2 px-2 py-1 bg-green-600 text-white rounded text-xs">+ Add Metric</button>
                {jsonError && <div className="text-xs text-red-500 mt-1">{jsonError}</div>}
              </div>
            </>
          )}

          {(modal.type === "createTask" || modal.type === "editTask") && (
            <>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Title *</label>
              <input name="title" value={local.title || ""} onChange={(e) => onLocalChange(e)} required className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea name="description" value={local.description || ""} onChange={(e) => onLocalChange(e)} rows="3" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Due Date</label>
              <input name="dueDate" value={local.dueDate || ""} onChange={(e) => onLocalChange(e)} type="date" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Weight</label>
              <input name="weight" value={local.weight ?? 0} onChange={(e) => onLocalChange(e)} type="number" min="0" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              {modal.type === "createTask" && modal.data?.goalId && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                  {(() => {
                    const { goalWeight, used, available } = computeGoalWeightAvailable(modal.data.goalId, null);
                    return (
                      <span>
                        Goal total: <strong className="text-gray-800 dark:text-gray-100">{goalWeight}</strong>. Used by other tasks: <strong>{used}</strong>. Available: <strong>{available}</strong>.
                      </span>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          {(modal.type === "createGoal" || modal.type === "editGoal") && (
            <>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Title *</label>
              <input name="title" value={local.title || ""} onChange={(e) => onLocalChange(e)} required className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea name="description" value={local.description || ""} onChange={(e) => onLocalChange(e)} rows="3" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Assign to group</label>
              <select name="groupId" value={local.groupId ?? ""} onChange={(e) => onLocalChange(e)} className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="">— Unassigned —</option>
                {groups.map((g) => (
                  <option key={g.id} value={String(g.id)}>
                    {g.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Start date</label>
                  <input name="startDate" value={local.startDate || ""} onChange={(e) => onLocalChange(e)} type="date" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">End date</label>
                  <input name="endDate" value={local.endDate || ""} onChange={(e) => onLocalChange(e)} type="date" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Weight</label>
              <input name="weight" value={local.weight ?? 100} onChange={(e) => onLocalChange(e)} type="number" min="1" max="100" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </>
          )}

          {/* inline error for validation */}
          {inlineError && <div className="text-sm text-red-600 dark:text-red-400">{inlineError}</div>}
        </form>

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2 bg-white dark:bg-gray-800 sticky bottom-0">
          <button onClick={() => setModal({ isOpen: false, type: null, data: null })} className="px-3 py-2 rounded border bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200">
            Cancel
          </button>
          <button onClick={submitLocal} disabled={isSubmitting} className="px-3 py-2 rounded bg-blue-600 text-white flex items-center">
            {isSubmitting ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
            {modal.type && modal.type.startsWith("edit") ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------
   SubmitReportInline (unchanged styling)
----------------------------*/
function SubmitReportInline({ data, onClose, onSubmit, loading }) {
  const { goalId, taskId, activityId } = data || {};
  const [narrative, setNarrative] = useState("");
  const [metricsArray, setMetricsArray] = useState([{ key: "", value: "" }]);
  const [newStatus, setNewStatus] = useState("");
  const [files, setFiles] = useState([]);
  const [localErr, setLocalErr] = useState(null);

  useEffect(() => {
    setNarrative("");
    setMetricsArray([{ key: "", value: "" }]);
    setNewStatus("");
    setFiles([]);
    setLocalErr(null);
  }, [activityId]);

  const onFileChange = (e) => {
    setFiles(Array.from(e.target.files || []));
  };

  const updateMetricRow = (idx, field, value) => {
    setMetricsArray((prev) => {
      const arr = [...prev];
      arr[idx] = { ...(arr[idx] || {}), [field]: value };
      return arr;
    });
  };

  const addMetricRow = () => setMetricsArray((p) => [...p, { key: "", value: "" }]);
  const removeMetricRow = (idx) => setMetricsArray((p) => (p.length > 1 ? p.filter((_, i) => i !== idx) : [{ key: "", value: "" }]));

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLocalErr(null);
    const hasInvalid = metricsArray.some((m) => m && String(m.key).trim() === "" && String(m.value).trim() !== "");
    if (hasInvalid) {
      setLocalErr("Metric keys cannot be empty when a value is provided.");
      return;
    }

    await onSubmit({
      activityId,
      narrative,
      metricsArray,
      newStatus: newStatus || null,
      files,
      goalId,
      taskId,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded shadow-lg overflow-auto max-h-[90vh]">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Submit Report</h3>
          <button type="button" onClick={() => onClose()} className="text-gray-400 hover:text-gray-600">
            &times;
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Activity</label>
            <div className="mt-1 text-sm text-gray-700 dark:text-gray-200">{activityId}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Narrative</label>
            <textarea value={narrative} onChange={(e) => setNarrative(e.target.value)} rows={4} className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Target / Metrics</label>
            <div className="mt-2 space-y-2">
              {metricsArray.map((m, idx) => (
                <div key={idx} className="flex gap-2">
                  <input placeholder="Key" value={m.key} onChange={(e) => updateMetricRow(idx, "key", e.target.value)} className="flex-1 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
                  <input placeholder="Value" value={m.value} onChange={(e) => updateMetricRow(idx, "value", e.target.value)} className="flex-1 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
                  <button type="button" onClick={() => removeMetricRow(idx)} className="px-2 py-1 bg-red-500 text-white rounded text-xs">X</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addMetricRow} className="mt-2 px-2 py-1 bg-green-600 text-white rounded text-xs">+ Add Metric</button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Add metrics as key/value pairs.</p>
            {localErr && <div className="text-xs text-red-500 mt-1">{localErr}</div>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Status (optional)</label>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">— No change —</option>
              <option value="Done">Done</option>
              <option value="In Progress">In Progress</option>
              <option value="Not Started">Not Started</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Attachments</label>
            <input type="file" multiple onChange={onFileChange} className="mt-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Max files: server-side limit applies.</p>
            {files.length > 0 && (
              <ul className="mt-2 text-xs text-gray-700 dark:text-gray-200">
                {files.map((f, i) => (
                  <li key={i}>
                    {f.name} ({Math.round(f.size / 1024)} KB)
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2 bg-white dark:bg-gray-800 sticky bottom-0">
          <button type="button" onClick={() => onClose()} className="px-3 py-2 rounded border bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="px-3 py-2 rounded bg-indigo-600 text-white flex items-center">
            {loading ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------------------------
   Helper to render metrics in the activity card
----------------------------*/
function renderMetricsList(metrics) {
  let obj = null;
  try {
    if (!metrics) return null;
    if (typeof metrics === "string") {
      obj = metrics.trim() === "" ? null : JSON.parse(metrics);
    } else {
      obj = metrics;
    }
  } catch (err) {
    return <div className="text-xs font-mono break-words">{String(metrics)}</div>;
  }
  if (!obj || typeof obj !== "object") return null;
  const keys = Object.keys(obj);
  if (keys.length === 0) return <div className="text-xs text-gray-500">—</div>;
  return keys.map((k) => (
    <div key={k} className="flex items-center justify-between">
      <div className="text-xs text-gray-600 dark:text-gray-300">{k}</div>
      <div className="text-xs font-medium text-gray-900 dark:text-gray-100">{String(obj[k])}</div>
    </div>
  ));
}
