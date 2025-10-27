import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader } from "lucide-react";

/**
 * GenericModal - create/edit Goals, Tasks, Activities
 *
 * Important: payloads are sanitized before being sent:
 *  - empty date strings -> null
 *  - empty rollNo -> deleted
 *  - numeric-like strings -> numbers
 * ENHANCED: Added smooth fade in/out animations
 */
export default function GenericModal({
  modal,
  setModal,
  groups = [],
  tasks = {}, // { [goalId]: [task...] } or array
  goals = [],
  activities = {}, // { [taskId]: [activity...] } or array
  onCreateGoal = async () => {},
  onUpdateGoal = async () => {},
  onCreateTask = async () => {},
  onUpdateTask = async () => {},
  onCreateActivity = async () => {},
  onUpdateActivity = async () => {},
  isSubmitting = false,
  t = (s) => s,
}) {
  const [local, setLocal] = useState({});
  const [jsonError, setJsonError] = useState(null);
  const [inlineError, setInlineError] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const firstFieldRef = useRef(null);
  const modalRef = useRef(null);
  const backdropRef = useRef(null);

  // Animation management
  useEffect(() => {
    if (modal?.isOpen) {
      setIsVisible(true);
      setIsAnimating(true);
      // Small delay to ensure DOM is updated before animation starts
      requestAnimationFrame(() => {
        if (backdropRef.current && modalRef.current) {
          backdropRef.current.style.opacity = '1';
          modalRef.current.style.transform = 'scale(1) translateY(0)';
          modalRef.current.style.opacity = '1';
        }
      });
    } else if (isVisible) {
      // Start exit animation
      setIsAnimating(true);
      if (backdropRef.current && modalRef.current) {
        backdropRef.current.style.opacity = '0';
        modalRef.current.style.transform = 'scale(0.95) translateY(10px)';
        modalRef.current.style.opacity = '0';
      }
      // Delay unmounting for animation to complete
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [modal?.isOpen, isVisible]);

  const generateId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  };

  const resolveIds = useCallback((data = {}) => {
    const d = data || {};
    const goalId =
      d.goalId ??
      d.goal_id ??
      d.goal ??
      (d.goal && (d.goal.id ?? d.goal)) ??
      null;
    const taskId =
      d.taskId ??
      d.task_id ??
      d.task ??
      (d.task && (d.task.id ?? d.task)) ??
      null;
    const id =
      d.id ??
      d.activityId ??
      d.activity_id ??
      (d.activity && (d.activity.id ?? d.activity)) ??
      d.taskId ??
      (d.task && (d.task.id ?? d.task)) ??
      null;

    const tryNum = (v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : v;
    };

    return {
      goalId: tryNum(goalId),
      taskId: tryNum(taskId),
      id: tryNum(id),
      raw: d,
    };
  }, []);

  useEffect(() => {
    if (!modal?.isOpen) return;

    const initial = modal.data || {};
    setInlineError(null);
    setJsonError(null);

    const initRoll = (val) => {
      if (val === null || val === undefined) return "";
      const n = Number(val);
      return Number.isFinite(n) && String(n).trim() !== "" ? Math.floor(n) : "";
    };

    const { goalId, taskId, id } = resolveIds(initial);

    const findTask = (gId, tId) => {
      if (!tId) return null;
      if (Array.isArray(tasks)) {
        return tasks.find((x) => String(x.id) === String(tId) || x.id === tId) || null;
      }
      const list = tasks && tasks[gId] ? tasks[gId] : [];
      return (Array.isArray(list) ? list : []).find((x) => String(x.id) === String(tId) || x.id === tId) || null;
    };

    const findActivity = (tId, aId) => {
      if (!aId) return null;
      if (Array.isArray(activities)) {
        return activities.find((x) => String(x.id) === String(aId) || x.id === aId) || null;
      }
      const list = activities && activities[tId] ? activities[tId] : [];
      return (Array.isArray(list) ? list : []).find((x) => String(x.id) === String(aId) || x.id === aId) || null;
    };

    let source = {};
    const isCreate = typeof modal.type === "string" && modal.type.startsWith("create");
    const isEdit = typeof modal.type === "string" && modal.type.startsWith("edit");

    if (isCreate) {
      source = {};
      if (goalId) source.goalId = goalId;
      if (taskId) source.taskId = taskId;
      if (initial.groupId) source.groupId = initial.groupId;
    } else {
      source = initial || {};
      if ((modal.type === "editTask" || modal.type === "editActivity") && (!source || !source.title)) {
        if (modal.type === "editTask") {
          const found = findTask(goalId, id);
          if (found) source = found;
        } else if (modal.type === "editActivity") {
          const found = findActivity(taskId || source.taskId, id);
          if (found) source = found;
        }
      }
    }

    if (modal.type === "createActivity" || modal.type === "editActivity") {
      setLocal({
        title: source.title || "",
        description: source.description || "",
        dueDate: source.dueDate || source.endDate || "",
        weight: source.weight ?? 1,
        status: source.status || "To Do",
        isDone: source.isDone ?? false,
        rollNo: initRoll(source.rollNo),
        targetMetrics: (() => {
          try {
            const tm = source.targetMetric ?? source.targetMetrics ?? {};
            if (!tm) return [{ id: generateId(), key: "", value: "" }];
            if (typeof tm === "string") {
              const parsed = JSON.parse(tm);
              if (Array.isArray(parsed)) {
                return parsed.map((m) => ({ id: generateId(), key: m?.key ?? "", value: m?.value ?? "" }));
              }
              return Object.keys(parsed || {}).map((k) => ({ id: generateId(), key: k, value: String(parsed[k]) }));
            }
            if (Array.isArray(tm)) {
              return tm.map((m) => ({ id: generateId(), key: m?.key ?? "", value: m?.value ?? "" }));
            }
            return Object.keys(tm || {}).map((k) => ({ id: generateId(), key: k, value: String(tm[k]) }));
          } catch {
            return [{ id: generateId(), key: "", value: "" }];
          }
        })(),
      });
    } else if (modal.type === "createTask" || modal.type === "editTask") {
      setLocal({
        title: source.title || "",
        description: source.description || "",
        dueDate: source.dueDate || source.endDate || "",
        weight: source.weight ?? 1,
        status: source.status || "To Do",
        rollNo: initRoll(source.rollNo),
      });
    } else if (modal.type === "createGoal" || modal.type === "editGoal") {
      setLocal({
        title: source.title || "",
        description: source.description || "",
        groupId: source.groupId ? String(source.groupId) : "",
        startDate: source.startDate || "",
        endDate: source.endDate || "",
        weight: source.weight ?? 1,
        status: source.status || "Not Started",
        rollNo: initRoll(source.rollNo),
      });
    } else {
      setLocal({});
    }

    // Enhanced focus with animation
    setTimeout(() => {
      if (firstFieldRef.current) {
        firstFieldRef.current.focus?.();
        // Add subtle focus animation
        firstFieldRef.current.style.transform = 'scale(1.02)';
        setTimeout(() => {
          if (firstFieldRef.current) firstFieldRef.current.style.transform = 'scale(1)';
        }, 200);
      }
    }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal?.isOpen, modal?.type, modal?.data, tasks, activities, resolveIds, goals]);

  useEffect(() => {
    if (modal?.isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [modal?.isOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && modal?.isOpen) setModal({ isOpen: false, type: null, data: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal?.isOpen, setModal]);

  const onLocalChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextVal =
      type === "checkbox" ? checked : type === "number" ? (value === "" ? "" : Number(value)) : value;
    setLocal((p) => ({ ...p, [name]: nextVal }));
    if (name === "targetMetric" && jsonError) setJsonError(null);
    if (inlineError) setInlineError(null);
  };

  // Enhanced metric functions with animations
  const updateMetricRow = (idx, field, value) =>
    setLocal((p) => {
      const next = { ...(p || {}) };
      const arr = Array.isArray(next.targetMetrics) ? [...next.targetMetrics] : [];
      const existing = arr[idx] || { id: generateId(), key: "", value: "" };
      arr[idx] = { ...existing, [field]: value };
      next.targetMetrics = arr;
      return next;
    });

  const addMetricRow = () =>
    setLocal((p) => {
      const next = { ...(p || {}) };
      const arr = Array.isArray(next.targetMetrics) ? [...next.targetMetrics] : [];
      arr.push({ id: generateId(), key: "", value: "" });
      next.targetMetrics = arr;
      return next;
    });

  const removeMetricRow = (idx) =>
    setLocal((p) => {
      const next = { ...(p || {}) };
      const arr = Array.isArray(next.targetMetrics) ? [...next.targetMetrics] : [];
      const filtered = arr.filter((_, i) => i !== idx);
      next.targetMetrics = filtered.length ? filtered : [{ id: generateId(), key: "", value: "" }];
      return next;
    });

  const parseNum = useCallback((v, fallback = 0) => {
    const n = parseFloat(String(v));
    return Number.isNaN(n) ? fallback : n;
  }, []);

  const computeGoalWeightAvailable = useCallback(
    (goalId, excludeTaskId = null) => {
      const g = goals.find((x) => String(x.id) === String(goalId) || x.id === goalId);
      const goalWeight = parseNum(g?.weight, 0);
      const list = tasks[goalId] || [];
      const sumOther = (Array.isArray(list) ? list : []).reduce((s, t) => {
        if (excludeTaskId && String(t.id) === String(excludeTaskId)) return s;
        return s + parseNum(t.weight, 0);
      }, 0);
      return { goalWeight, used: sumOther, available: Math.max(0, goalWeight - sumOther) };
    },
    [goals, tasks, parseNum]
  );

  const computeTaskWeightAvailable = useCallback(
    (taskId, excludeActivityId = null) => {
      const allTasksLists = Array.isArray(tasks) ? tasks : Object.values(tasks).flat();
      const taskObj = (Array.isArray(allTasksLists) ? allTasksLists : []).find((t) => String(t.id) === String(taskId) || t.id === taskId);
      const taskWeight = parseNum(taskObj?.weight, 0);
      const list = activities[taskId] || [];
      const sumOther = (Array.isArray(list) ? list : []).reduce((s, a) => {
        if (excludeActivityId && String(a.id) === String(excludeActivityId)) return s;
        return s + parseNum(a.weight, 0);
      }, 0);
      return { taskWeight, used: sumOther, available: Math.max(0, taskWeight - sumOther) };
    },
    [tasks, activities, parseNum]
  );

  const computeSystemWeightAvailable = useCallback(
    (excludeGoalId = null) => {
      const sumOther = (goals || []).reduce((s, g) => {
        if (excludeGoalId && String(g.id) === String(excludeGoalId)) return s;
        return s + parseNum(g.weight, 0);
      }, 0);
      const used = sumOther;
      const available = Math.max(0, 100 - used);
      return { used, available };
    },
    [goals, parseNum]
  );

  const callHandler = async (fn, argsOptions = []) => {
    if (typeof fn !== "function") throw new Error("Handler not provided");
    const len = fn.length;
    const tryList = argsOptions.slice();
    const idx = tryList.findIndex((a) => a.length === len);
    if (idx >= 0) {
      try {
        return await fn(...tryList[idx]);
      } catch (e) {}
    }
    for (const args of tryList) {
      try {
        return await fn(...args);
      } catch (e) {}
    }
    return await fn(...(argsOptions[0] || []));
  };

  // sanitize payload helper: convert empty dates to null, remove empty rollNo, coerce numbers
  const sanitizePayload = (raw) => {
    const payload = { ...(raw || {}) };

    // convert common date fields
    ["dueDate", "startDate", "endDate"].forEach((k) => {
      if (payload.hasOwnProperty(k)) {
        if (payload[k] === "") {
          // explicit null so DB receives NULL instead of ''
          payload[k] = null;
        } else if (typeof payload[k] === "string") {
          // leave valid non-empty string (assume yyyy-mm-dd)
          payload[k] = payload[k];
        }
      }
    });

    // rollNo: delete if empty string
    if (payload.hasOwnProperty("rollNo") && (payload.rollNo === "" || payload.rollNo === null || payload.rollNo === undefined)) {
      delete payload.rollNo;
    }

    // coerce numeric-ish fields
    if (payload.hasOwnProperty("weight")) {
      const n = parseFloat(String(payload.weight));
      payload.weight = Number.isNaN(n) ? payload.weight : Math.round(n * 100) / 100;
    }

    // if any targetMetric is an object (already handled earlier), keep it
    return payload;
  };

  const submitLocal = async (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    try {
      setInlineError(null);

      const rollVal = local.rollNo;
      if (rollVal !== "" && rollVal !== undefined && rollVal !== null) {
        const asNum = Number(rollVal);
        if (!Number.isFinite(asNum) || !Number.isInteger(asNum) || asNum <= 0) {
          setInlineError(t("project.errors.rollNoPositive") || "Roll number must be a positive integer");
          return;
        }
      }

      if (modal.type === "createTask" || modal.type === "editTask") {
        const { goalId, id } = resolveIds(modal.data || {});
        if (!goalId) {
          setInlineError(t("project.errors.missingGoalId") || "Missing goal id");
          return;
        }
        const newWeight = parseNum(local.weight, 0);
        const excludeTaskId = modal.type === "editTask" ? id : null;
        const { goalWeight, used, available } = computeGoalWeightAvailable(goalId, excludeTaskId);

        if (newWeight <= 0) {
          setInlineError(t("project.errors.weightPositive") || "Weight must be > 0");
          return;
        }
        if (newWeight > available) {
          setInlineError(t("project.errors.weightExceeds", { newWeight, goalWeight, used, available }) || `Weight ${newWeight} exceeds available ${available}`);
          return;
        }
      }

      if (modal.type === "createActivity" || modal.type === "editActivity") {
        const { taskId, id } = resolveIds(modal.data || {});
        if (!taskId) {
          setInlineError(t("project.errors.missingTaskId") || "Missing task id");
          return;
        }
        const newWeight = parseNum(local.weight, 0);
        const excludeActivityId = modal.type === "editActivity" ? id : null;
        const { taskWeight, used, available } = computeTaskWeightAvailable(taskId, excludeActivityId);

        if (newWeight <= 0) {
          setInlineError(t("project.errors.weightPositive") || "Weight must be > 0");
          return;
        }
        if (newWeight > available) {
          setInlineError(t("project.errors.weightExceedsTask", { newWeight, taskWeight, used, available }) || `Weight ${newWeight} exceeds available ${available}`);
          return;
        }
      }

      if (modal.type === "createGoal" || modal.type === "editGoal") {
        const newWeight = parseNum(local.weight, 0);
        if (newWeight <= 0) {
          setInlineError(t("project.errors.weightPositive") || "Weight must be > 0");
          return;
        }
        const excludeGoalId = modal.type === "editGoal" ? modal.data?.id : null;
        const { used, available } = computeSystemWeightAvailable(excludeGoalId);
        if (newWeight > available) {
          setInlineError(t("project.errors.weightExceedsSystem", { newWeight, used, available }) || `Cannot set weight to ${newWeight}. System used ${used}, available ${available}.`);
          return;
        }
      }

      // --- Actions with sanitized payloads ---

      // CREATE GOAL
      if (modal.type === "createGoal") {
        const payloadRaw = { ...local, groupId: local.groupId === "" ? null : Number(local.groupId) };
        const payload = sanitizePayload(payloadRaw);
        await callHandler(onCreateGoal, [[payload]]);
        return;
      }

      // EDIT GOAL
      if (modal.type === "editGoal") {
        const { id } = modal.data || {};
        const payloadRaw = { ...local, groupId: local.groupId === "" ? null : Number(local.groupId) };
        const payload = sanitizePayload(payloadRaw);
        await callHandler(onUpdateGoal, [[id, payload], [payload]]);
        return;
      }

      // CREATE TASK
      if (modal.type === "createTask") {
        const { goalId } = resolveIds(modal.data || {});
        const payloadRaw = { ...local };
        const payload = sanitizePayload(payloadRaw);
        await callHandler(onCreateTask, [[goalId, payload], [payload, goalId]]);
        return;
      }

      // EDIT TASK
      if (modal.type === "editTask") {
        const { goalId, id } = resolveIds(modal.data || {});
        if (!goalId || !id) {
          setInlineError(t("project.errors.invalidIds") || "Invalid goal or task id");
          return;
        }
        const payloadRaw = { ...local };
        const payload = sanitizePayload(payloadRaw);
        await callHandler(onUpdateTask, [[goalId, id, payload], [id, payload], [payload, goalId, id]]);
        return;
      }

      // CREATE ACTIVITY
      if (modal.type === "createActivity") {
        const { goalId, taskId } = resolveIds(modal.data || {});
        const payloadRaw = { ...local };
        if (Array.isArray(local.targetMetrics)) {
          const obj = {};
          local.targetMetrics.forEach((m) => {
            if (m && String(m.key).trim() !== "") obj[String(m.key).trim()] = m.value ?? "";
          });
          payloadRaw.targetMetric = obj;
        }
        delete payloadRaw.targetMetrics;
        const payload = sanitizePayload(payloadRaw);
        await callHandler(onCreateActivity, [[goalId, taskId, payload], [taskId, payload], [payload, taskId, goalId]]);
        return;
      }

      // EDIT ACTIVITY
      if (modal.type === "editActivity") {
        const { goalId, taskId, id } = resolveIds(modal.data || {});
        if (!taskId || !id) {
          setInlineError(t("project.errors.missingTaskId") || "Missing task or activity id");
          return;
        }
        const payloadRaw = { ...local };
        if (Array.isArray(local.targetMetrics)) {
          const obj = {};
          local.targetMetrics.forEach((m) => {
            if (m && String(m.key).trim() !== "") obj[String(m.key).trim()] = m.value ?? "";
          });
          payloadRaw.targetMetric = obj;
        }
        delete payloadRaw.targetMetrics;
        const payload = sanitizePayload(payloadRaw);
        await callHandler(onUpdateActivity, [
          [taskId, id, payload],
          [goalId, taskId, id, payload],
          [id, payload],
        ]);
        return;
      }
    } catch (err) {
      console.error("modal submit error", err);
      setInlineError(err?.message || t("project.errors.modalSubmit") || "Submit failed");
    }
  };

  if (!isVisible && !isAnimating) return null;

  const systemHint =
    modal.type === "createGoal" || modal.type === "editGoal"
      ? (() => {
          const excludeGoalId = modal.type === "editGoal" ? modal.data?.id : null;
          const { used, available } = computeSystemWeightAvailable(excludeGoalId);
          return { used, available };
        })()
      : null;

  return (
    <>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .modal-shake {
          animation: shake 0.4s ease-in-out;
        }
        .metric-row-enter {
          animation: slideIn 0.2s ease-out;
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 transition-all duration-300 ease-out"
        role="dialog"
        aria-modal="true"
        aria-labelledby="generic-modal-title"
        style={{
          opacity: 0,
          pointerEvents: isAnimating ? 'auto' : 'none'
        }}
      >
        <div
          ref={modalRef}
          className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-auto max-h-[90vh] transform transition-all duration-300 ease-out"
          style={{
            transform: 'scale(0.95) translateY(10px)',
            opacity: 0
          }}
        >
          {/* Enhanced header with smooth transitions */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10 backdrop-blur-sm bg-white/95 dark:bg-gray-800/95">
            <h3 id="generic-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-200">
              {modal.type === "createGoal" && t("project.modal.createGoal")}
              {modal.type === "editGoal" && t("project.modal.editGoal")}
              {modal.type === "createTask" && t("project.modal.createTask")}
              {modal.type === "editTask" && t("project.modal.editTask")}
              {modal.type === "createActivity" && t("project.modal.createActivity")}
              {modal.type === "editActivity" && t("project.modal.editActivity")}
            </h3>
            <button
              type="button"
              onClick={() => setModal({ isOpen: false, type: null, data: null })}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-200 transform hover:scale-110 hover:rotate-90 p-1 rounded-full"
              aria-label={t("project.actions.close")}
              style={{ transition: 'all 0.2s ease' }}
            >
              ×
            </button>
          </div>

          <form onSubmit={submitLocal} className="px-4 py-4 space-y-4">
            {(modal.type === "createActivity" || modal.type === "editActivity") && (
              <>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.fields.title")} *</label>
                <input
                  ref={firstFieldRef}
                  name="title"
                  value={local.title || ""}
                  onChange={onLocalChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
                />

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.fields.description")}</label>
                <textarea
                  name="description"
                  value={local.description || ""}
                  onChange={onLocalChange}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none hover:border-gray-400 dark:hover:border-gray-500"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.fields.dueDate")}</label>
                    <input
                      name="dueDate"
                      value={local.dueDate || ""}
                      onChange={onLocalChange}
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.fields.weight")}</label>
                    <input
                      name="weight"
                      value={local.weight ?? 1}
                      onChange={onLocalChange}
                      type="number"
                      min="0.01"
                      step="any"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
                    />
                  </div>
                </div>

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.fields.status")}</label>
                <select
                  name="status"
                  value={local.status || "To Do"}
                  onChange={onLocalChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
                >
                  <option value="To Do">{t("project.status.toDo") || "To Do"}</option>
                  <option value="In Progress">{t("project.status.inProgress") || "In Progress"}</option>
                  <option value="Done">{t("project.status.completed") || "Done"}</option>
                </select>

                <div className="mt-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.labels.rollLabel")}</label>
                  <input
                    name="rollNo"
                    value={local.rollNo === "" ? "" : (local.rollNo ?? "")}
                    onChange={onLocalChange}
                    type="number"
                    min="1"
                    step="1"
                    placeholder={t("project.placeholders.rollNo") || "Leave empty to auto-assign"}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
                  />
                  <div className="text-xs text-gray-500 mt-1 transition-colors duration-200">{t("project.hints.hint")}</div>
                </div>

                {modal.data?.taskId && (
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg transition-all duration-200">
                    {(() => {
                      const resolved = resolveIds(modal.data || {});
                      const { taskWeight, used, available } = computeTaskWeightAvailable(resolved.taskId, modal.type === "editActivity" ? resolved.id : null);
                      return t("project.hints.taskWeight", { taskWeight, used, available });
                    })()}
                  </div>
                )}

                {/* Enhanced Metrics Section */}
                <div className="transition-all duration-300">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.labels.targetMetrics")}</label>
                  <div className="mt-2 space-y-2">
                    {(Array.isArray(local.targetMetrics) ? local.targetMetrics : [{ id: "empty-0", key: "", value: "" }]).map((m, idx) => (
                      <div 
                        key={m.id} 
                        className="flex gap-2 metric-row-enter transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1 rounded"
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <input
                          placeholder={t("project.placeholders.metricKey")}
                          value={m?.key || ""}
                          onChange={(e) => updateMetricRow(idx, "key", e.target.value)}
                          className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white transition-all duration-200 focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        />
                        <input
                          type="number"
                          min={0}
                          placeholder={t("project.placeholders.metricValue")}
                          value={m?.value || ""}
                          onChange={(e) => updateMetricRow(idx, "value", e.target.value)}
                          className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white transition-all duration-200 focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => removeMetricRow(idx)}
                          className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs transition-all duration-200 transform hover:scale-105 active:scale-95"
                          aria-label={t("project.actions.remove")}
                        >
                          {t("project.actions.removeShort")}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button 
                    type="button" 
                    onClick={addMetricRow} 
                    className="mt-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t("project.actions.addMetric")}
                  </button>
                  {jsonError && <div className="text-xs text-red-500 mt-1 p-2 bg-red-50 dark:bg-red-900/20 rounded transition-all duration-200">{jsonError}</div>}
                </div>
              </>
            )}

            {/* Other form sections with enhanced animations... */}
            {(modal.type === "createTask" || modal.type === "editTask") && (
              <>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.fields.title")} *</label>
                <input
                  ref={firstFieldRef}
                  name="title"
                  value={local.title || ""}
                  onChange={onLocalChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
                />

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.fields.description")}</label>
                <textarea
                  name="description"
                  value={local.description || ""}
                  onChange={onLocalChange}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none hover:border-gray-400 dark:hover:border-gray-500"
                />

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.fields.dueDate")}</label>
                <input
                  name="dueDate"
                  value={local.dueDate || ""}
                  onChange={onLocalChange}
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
                />

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.labels.rollLabel")}</label>
                <input
                  name="rollNo"
                  value={local.rollNo === "" ? "" : (local.rollNo ?? "")}
                  onChange={onLocalChange}
                  type="number"
                  min="1"
                  step="1"
                  placeholder={t("project.placeholders.rollNo") || "Leave empty to auto-assign"}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
                />
                <div className="text-xs text-gray-500 mt-1 transition-colors duration-200">{t("project.hints.hint")}</div>

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.fields.weight")}</label>
                <input
                  name="weight"
                  value={local.weight ?? 1}
                  onChange={onLocalChange}
                  type="number"
                  min="0.01"
                  step="any"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
                />

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.fields.status")}</label>
                <select
                  name="status"
                  value={local.status || "To Do"}
                  onChange={onLocalChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
                >
                  <option value="To Do">{t("project.status.toDo") || "To Do"}</option>
                  <option value="In Progress">{t("project.status.inProgress") || "In Progress"}</option>
                  <option value="Done">{t("project.status.completed") || "Done"}</option>
                  <option value="Blocked">{t("project.status.blocked") || "Blocked"}</option>
                </select>

                {modal.data?.goalId && (
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg transition-all duration-200">
                    {(() => {
                      const { goalId, id } = resolveIds(modal.data || {});
                      const excludeTaskId = modal.type === "editTask" ? id : null;
                      const { goalWeight, used, available } = computeGoalWeightAvailable(modal.data.goalId, excludeTaskId);
                      return t("project.hints.goalWeight", { goalWeight, used, available });
                    })()}
                  </div>
                )}
              </>
            )}

            {(modal.type === "createGoal" || modal.type === "editGoal") && (
              <>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.fields.title")} *</label>
                <input
                  ref={firstFieldRef}
                  name="title"
                  value={local.title || ""}
                  onChange={onLocalChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
                />

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.fields.description")}</label>
                <textarea
                  name="description"
                  value={local.description || ""}
                  onChange={onLocalChange}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none hover:border-gray-400 dark:hover:border-gray-500"
                />

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.fields.assignGroup")}</label>
                <select
                  name="groupId"
                  value={local.groupId ?? ""}
                  onChange={onLocalChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
                >
                  <option value="">{t("project.unassigned")}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={String(g.id)}>
                      {g.name}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.fields.startDate")}</label>
                    <input
                      name="startDate"
                      value={local.startDate || ""}
                      onChange={onLocalChange}
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.fields.endDate")}</label>
                    <input
                      name="endDate"
                      value={local.endDate || ""}
                      onChange={onLocalChange}
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
                    />
                  </div>
                </div>

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.fields.status")}</label>
                <select
                  name="status"
                  value={local.status || "Not Started"}
                  onChange={onLocalChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
                >
                  <option value="Not Started">{t("project.status.notStarted") || "Not Started"}</option>
                  <option value="In Progress">{t("project.status.inProgress") || "In Progress"}</option>
                  <option value="On Hold">{t("project.status.onHold") || "On Hold"}</option>
                  <option value="Completed">{t("project.status.completed") || "Completed"}</option>
                </select>

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.labels.rollLabel")}</label>
                <input
                  name="rollNo"
                  value={local.rollNo === "" ? "" : (local.rollNo ?? "")}
                  onChange={onLocalChange}
                  type="number"
                  min="1"
                  step="1"
                  placeholder={t("project.placeholders.rollNo") || "Leave empty to auto-assign"}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
                />
                <div className="text-xs text-gray-500 mt-1 transition-colors duration-200">{t("project.hints.hint")}</div>

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">{t("project.fields.weight")}</label>
                <input
                  name="weight"
                  value={local.weight ?? 1}
                  onChange={onLocalChange}
                  type="number"
                  min="0.01"
                  step="any"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 dark:hover:border-gray-500"
                />

                {systemHint && (
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg transition-all duration-200">
                    {t("project.hints.systemWeight", { used: systemHint.used, available: systemHint.available }) ||
                      `System used: ${systemHint.used}, available: ${systemHint.available}`}
                  </div>
                )}
              </>
            )}

            {inlineError && (
              <div 
                className="text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 transition-all duration-200"
                style={{ animation: 'shake 0.4s ease-in-out' }}
              >
                {inlineError}
              </div>
            )}

            {/* Enhanced footer with smooth transitions */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2 bg-white dark:bg-gray-800 sticky bottom-0 backdrop-blur-sm bg-white/95 dark:bg-gray-800/95">
              <button
                type="button"
                onClick={() => setModal({ isOpen: false, type: null, data: null })}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-600 hover:scale-105 active:scale-95"
              >
                {t("project.actions.cancel")}
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 disabled:scale-100"
              >
                {isSubmitting ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
                {modal.type && modal.type.startsWith("edit") ? t("project.actions.save") : t("project.actions.create")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}