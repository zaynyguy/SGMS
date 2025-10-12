import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader } from "lucide-react";

export default function GenericModal({
  modal,
  setModal,
  groups = [],
  tasks = {},
  goals = [],
  activities = {},
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

  const firstFieldRef = useRef(null);

  // keep modal local state in sync when opening
  useEffect(() => {
    if (!modal?.isOpen) return;
    const initial = modal.data || {};
    setInlineError(null);

    // shared helper to normalize rollNo into either number or empty string
    const initRoll = (val) => {
      if (val === null || val === undefined) return "";
      // keep numeric values as numbers, string numbers to Number
      const n = Number(val);
      return Number.isFinite(n) && String(n).trim() !== "" ? Math.floor(n) : "";
    };

    if (modal.type === "createActivity" || modal.type === "editActivity") {
      setLocal({
        title: initial.title || "",
        description: initial.description || "",
        dueDate: initial.dueDate || "",
        weight: initial.weight ?? 1,
        status: initial.status || "not-started",
        isDone: initial.isDone ?? false,
        rollNo: initRoll(initial.rollNo),
        targetMetrics: (() => {
          try {
            if (!initial.targetMetric) return [{ key: "", value: "" }];
            if (typeof initial.targetMetric === "string") return JSON.parse(initial.targetMetric);
            return Object.keys(initial.targetMetric || {}).map((k) => ({ key: k, value: String(initial.targetMetric[k]) }));
          } catch {
            return [{ key: "", value: "" }];
          }
        })(),
      });
    } else if (modal.type === "createTask" || modal.type === "editTask") {
      setLocal({
        title: initial.title || "",
        description: initial.description || "",
        dueDate: initial.dueDate || "",
        weight: initial.weight ?? 1,
        status: initial.status || "not-started",
        rollNo: initRoll(initial.rollNo),
      });
    } else if (modal.type === "createGoal" || modal.type === "editGoal") {
      setLocal({
        title: initial.title || "",
        description: initial.description || "",
        groupId: initial.groupId ? String(initial.groupId) : "",
        startDate: initial.startDate || "",
        endDate: initial.endDate || "",
        weight: initial.weight ?? 1,
        status: initial.status || "active",
        rollNo: initRoll(initial.rollNo),
      });
    } else {
      setLocal({});
    }
    setJsonError(null);

    // focus first field after a tick
    setTimeout(() => {
      if (firstFieldRef.current) firstFieldRef.current.focus?.();
    }, 50);
  }, [modal?.isOpen, modal?.type, modal?.data]);

  // prevent background scroll while modal open
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

  // close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && modal?.isOpen) setModal({ isOpen: false, type: null, data: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal?.isOpen, setModal]);

  const onLocalChange = (e) => {
    const { name, value, type, checked } = e.target;
    // convert numeric inputs to numbers where appropriate
    const nextVal = type === "checkbox" ? checked : type === "number" ? (value === "" ? "" : Number(value)) : value;
    setLocal((p) => ({ ...p, [name]: nextVal }));
    if (name === "targetMetric" && jsonError) setJsonError(null);
    if (inlineError) setInlineError(null);
  };

  const updateMetricRow = (idx, field, value) =>
    setLocal((p) => {
      const next = { ...(p || {}) };
      const arr = Array.isArray(next.targetMetrics) ? [...next.targetMetrics] : [];
      arr[idx] = { ...(arr[idx] || {}), [field]: value };
      next.targetMetrics = arr;
      return next;
    });

  const addMetricRow = () =>
    setLocal((p) => {
      const next = { ...(p || {}) };
      next.targetMetrics = Array.isArray(next.targetMetrics) ? [...next.targetMetrics, { key: "", value: "" }] : [{ key: "", value: "" }];
      return next;
    });

  const removeMetricRow = (idx) =>
    setLocal((p) => {
      const next = { ...(p || {}) };
      const arr = Array.isArray(next.targetMetrics) ? next.targetMetrics : [];
      const filtered = arr.filter((_, i) => i !== idx);
      next.targetMetrics = filtered.length ? filtered : [{ key: "", value: "" }];
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
      const sumOther = list.reduce((s, t) => {
        if (excludeTaskId && String(t.id) === String(excludeTaskId)) return s;
        return s + parseNum(t.weight, 0);
      }, 0);
      return { goalWeight, used: sumOther, available: Math.max(0, goalWeight - sumOther) };
    },
    [goals, tasks, parseNum]
  );

  const computeTaskWeightAvailable = useCallback(
    (taskId, excludeActivityId = null) => {
      const allTasksLists = Object.values(tasks).flat();
      const taskObj = allTasksLists.find((t) => String(t.id) === String(taskId) || t.id === taskId);
      const taskWeight = parseNum(taskObj?.weight, 0);
      const list = activities[taskId] || [];
      const sumOther = list.reduce((s, a) => {
        if (excludeActivityId && String(a.id) === String(excludeActivityId)) return s;
        return s + parseNum(a.weight, 0);
      }, 0);
      return { taskWeight, used: sumOther, available: Math.max(0, taskWeight - sumOther) };
    },
    [tasks, activities, parseNum]
  );

  const computeSystemWeightAvailable = useCallback(
    (excludeGoalId = null) => {
      const sumOther = goals.reduce((s, g) => {
        if (excludeGoalId && String(g.id) === String(excludeGoalId)) return s;
        return s + parseNum(g.weight, 0);
      }, 0);
      const used = sumOther;
      const available = Math.max(0, 100 - used);
      return { used, available };
    },
    [goals, parseNum]
  );

  const submitLocal = async (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    try {
      setInlineError(null);

      // rollNo client-side validation (positive integer if provided)
      const rollVal = local.rollNo;
      if (rollVal !== "" && rollVal !== undefined && rollVal !== null) {
        const asNum = Number(rollVal);
        if (!Number.isFinite(asNum) || !Number.isInteger(asNum) || asNum <= 0) {
          setInlineError(t("project.errors.rollNoPositive") || "Roll number must be a positive integer");
          return;
        }
      }

      // Task weight validations
      if (modal.type === "createTask" || modal.type === "editTask") {
        const goalId = modal.data?.goalId;
        if (!goalId) {
          setInlineError(t("project.errors.missingGoalId") || "Missing goal id");
          return;
        }
        const newWeight = parseNum(local.weight, 0);
        const excludeTaskId = modal.type === "editTask" ? modal.data?.id : null;
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

      // Activity weight validations
      if (modal.type === "createActivity" || modal.type === "editActivity") {
        const taskId = modal.data?.taskId;
        if (!taskId) {
          setInlineError(t("project.errors.missingTaskId") || "Missing task id");
          return;
        }
        const newWeight = parseNum(local.weight, 0);
        const excludeActivityId = modal.type === "editActivity" ? modal.data?.id : null;
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

      // Goal weight validations
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

      // CRUD actions (include rollNo if provided)
      if (modal.type === "createGoal") {
        const payload = { ...local, groupId: local.groupId === "" ? null : Number(local.groupId) };
        if (payload.rollNo === "") delete payload.rollNo;
        await onCreateGoal(payload);
        return;
      }
      if (modal.type === "editGoal") {
        const { id } = modal.data || {};
        const payload = { ...local, groupId: local.groupId === "" ? null : Number(local.groupId) };
        if (payload.rollNo === "") delete payload.rollNo;
        await onUpdateGoal(id, payload);
        return;
      }
      if (modal.type === "createTask") {
        const goalId = modal.data?.goalId;
        const payload = { ...local };
        if (payload.rollNo === "") delete payload.rollNo;
        await onCreateTask(goalId, payload);
        return;
      }

      // Defensive editTask branch (supports varied modal.data shapes)
      if (modal.type === "editTask") {
        const rawGoalId = modal.data?.goalId ?? modal.data?.goal_id ?? modal.data?.goal ?? null;
        const rawTaskId = modal.data?.id ?? modal.data?.taskId ?? modal.data?.task_id ?? null;

        if (rawGoalId === null || rawGoalId === undefined || String(rawGoalId).trim() === "") {
          setInlineError(t("project.errors.missingGoalId") || "Missing goal id");
          return;
        }
        if (rawTaskId === null || rawTaskId === undefined || String(rawTaskId).trim() === "") {
          setInlineError(t("project.errors.missingTaskId") || "Missing task id");
          return;
        }

        const goalIdNum = Number(rawGoalId);
        const taskIdNum = Number(rawTaskId);
        if (Number.isNaN(goalIdNum) || Number.isNaN(taskIdNum)) {
          setInlineError(t("project.errors.invalidIds") || "Invalid goal or task id");
          return;
        }

        const payload = { ...local };
        if (payload.rollNo === "") delete payload.rollNo;
        await onUpdateTask(goalIdNum, taskIdNum, payload);
        return;
      }

      if (modal.type === "createActivity") {
        const { goalId, taskId } = modal.data || {};
        const payload = { ...local };
        if (Array.isArray(local.targetMetrics)) {
          const obj = {};
          local.targetMetrics.forEach((m) => {
            if (m && String(m.key).trim() !== "") obj[String(m.key).trim()] = m.value ?? "";
          });
          payload.targetMetric = obj;
        }
        delete payload.targetMetrics;
        if (payload.rollNo === "") delete payload.rollNo;
        await onCreateActivity(goalId, taskId, payload);
        return;
      }

      if (modal.type === "editActivity") {
        const { goalId, taskId, id } = modal.data || {};
        const payload = { ...local };
        if (Array.isArray(local.targetMetrics)) {
          const obj = {};
          local.targetMetrics.forEach((m) => {
            if (m && String(m.key).trim() !== "") obj[String(m.key).trim()] = m.value ?? "";
          });
          payload.targetMetric = obj;
        }
        delete payload.targetMetrics;
        if (payload.rollNo === "") delete payload.rollNo;
        await onUpdateActivity(goalId, taskId, id, payload);
        return;
      }
    } catch (err) {
      console.error("modal submit error", err);
      setInlineError(err?.message || t("project.errors.modalSubmit") || "Submit failed");
    }
  };

  if (!modal?.isOpen) return null;

  const systemHint =
    modal.type === "createGoal" || modal.type === "editGoal"
      ? (() => {
          const excludeGoalId = modal.type === "editGoal" ? modal.data?.id : null;
          const { used, available } = computeSystemWeightAvailable(excludeGoalId);
          return { used, available };
        })()
      : null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="generic-modal-title">
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded shadow overflow-auto max-h-[90vh]">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 id="generic-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            {modal.type === "createGoal" && t("project.modal.createGoal")}
            {modal.type === "editGoal" && t("project.modal.editGoal")}
            {modal.type === "createTask" && t("project.modal.createTask")}
            {modal.type === "editTask" && t("project.modal.editTask")}
            {modal.type === "createActivity" && t("project.modal.createActivity")}
            {modal.type === "editActivity" && t("project.modal.editActivity")}
          </h3>
          <button type="button" onClick={() => setModal({ isOpen: false, type: null, data: null })} className="text-gray-400 hover:text-gray-600" aria-label={t("project.actions.close")}>×</button>
        </div>

        <form onSubmit={submitLocal} className="px-4 py-4 space-y-3">
          {/* Activity */}
          {(modal.type === "createActivity" || modal.type === "editActivity") && (
            <>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.title")} *</label>
              <input ref={firstFieldRef} name="title" value={local.title || ""} onChange={onLocalChange} required className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />

              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.description")}</label>
              <textarea name="description" value={local.description || ""} onChange={onLocalChange} rows="3" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.dueDate")}</label>
                  <input name="dueDate" value={local.dueDate || ""} onChange={onLocalChange} type="date" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.weight")}</label>
                  <input name="weight" value={local.weight ?? 1} onChange={onLocalChange} type="number" min="0.01" step="any" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>

              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.status")}</label>
              <select name="status" value={local.status || "not-started"} onChange={onLocalChange} className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="not-started">{t("project.status.notStarted")}</option>
                <option value="in-progress">{t("project.status.inProgress")}</option>
                <option value="done">{t("project.status.completed")}</option>
              </select>

              {/* Roll number input for activity */}
              <div className="mt-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Roll number (optional)</label>
                <input
                  name="rollNo"
                  value={local.rollNo === "" ? "" : (local.rollNo ?? "")}
                  onChange={onLocalChange}
                  type="number"
                  min="1"
                  step="1"
                  placeholder={t("project.placeholders.rollNo") || "Leave empty to auto-assign"}
                  className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <div className="text-xs text-gray-500 mt-1">Optional. Positive integer. If left blank the system will auto-assign. Uniqueness enforced by backend.</div>
              </div>

              {modal.data?.taskId && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                  {(() => {
                    const { taskWeight, used, available } = computeTaskWeightAvailable(modal.data.taskId, modal.type === "editActivity" ? modal.data?.id : null);
                    return t("project.hints.taskWeight", { taskWeight, used, available });
                  })()}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.labels.targetMetrics")}</label>
                <div className="mt-2 space-y-2">
                  {(Array.isArray(local.targetMetrics) ? local.targetMetrics : [{ key: "", value: "" }]).map((m, idx) => (
                    <div key={m.id ?? `${m.key}-${m.value}-${idx}`} className="flex gap-2">
                      <input placeholder={t("project.placeholders.metricKey")} value={m?.key || ""} onChange={(e) => updateMetricRow(idx, "key", e.target.value)} className="flex-1 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
                      <input placeholder={t("project.placeholders.metricValue")} value={m?.value || ""} onChange={(e) => updateMetricRow(idx, "value", e.target.value)} className="flex-1 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
                      <button type="button" onClick={() => removeMetricRow(idx)} className="px-2 py-1 bg-red-500 text-white rounded text-xs" aria-label={t("project.actions.remove")}>
                        {t("project.actions.removeShort")}
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addMetricRow} className="mt-2 px-2 py-1 bg-green-600 text-white rounded text-xs">+ {t("project.actions.addMetric")}</button>
                {jsonError && <div className="text-xs text-red-500 mt-1">{jsonError}</div>}
              </div>
            </>
          )}

          {/* Task */}
          {(modal.type === "createTask" || modal.type === "editTask") && (
            <>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.title")} *</label>
              <input ref={firstFieldRef} name="title" value={local.title || ""} onChange={onLocalChange} required className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />

              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.description")}</label>
              <textarea name="description" value={local.description || ""} onChange={onLocalChange} rows="3" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />

              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.dueDate")}</label>
              <input name="dueDate" value={local.dueDate || ""} onChange={onLocalChange} type="date" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />

              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Roll number (optional)</label>
              <input
                name="rollNo"
                value={local.rollNo === "" ? "" : (local.rollNo ?? "")}
                onChange={onLocalChange}
                type="number"
                min="1"
                step="1"
                placeholder={t("project.placeholders.rollNo") || "Leave empty to auto-assign"}
                className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <div className="text-xs text-gray-500 mt-1">Optional. Positive integer. If left blank the system will auto-assign. Uniqueness enforced per-goal on the backend.</div>

              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.weight")}</label>
              <input name="weight" value={local.weight ?? 1} onChange={onLocalChange} type="number" min="0.01" step="any" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />

              {modal.type === "createTask" && modal.data?.goalId && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                  {(() => {
                    const { goalWeight, used, available } = computeGoalWeightAvailable(modal.data.goalId, null);
                    return t("project.hints.goalWeight", { goalWeight, used, available });
                  })()}
                </div>
              )}
            </>
          )}

          {/* Goal */}
          {(modal.type === "createGoal" || modal.type === "editGoal") && (
            <>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.title")} *</label>
              <input ref={firstFieldRef} name="title" value={local.title || ""} onChange={onLocalChange} required className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />

              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.description")}</label>
              <textarea name="description" value={local.description || ""} onChange={onLocalChange} rows="3" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />

              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.assignGroup")}</label>
              <select name="groupId" value={local.groupId ?? ""} onChange={onLocalChange} className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="">{t("project.unassigned")}</option>
                {groups.map((g) => (
                  <option key={g.id} value={String(g.id)}>{g.name}</option>
                ))}
              </select>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.startDate")}</label>
                  <input name="startDate" value={local.startDate || ""} onChange={onLocalChange} type="date" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.endDate")}</label>
                  <input name="endDate" value={local.endDate || ""} onChange={onLocalChange} type="date" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>

              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Roll number (optional)</label>
              <input
                name="rollNo"
                value={local.rollNo === "" ? "" : (local.rollNo ?? "")}
                onChange={onLocalChange}
                type="number"
                min="1"
                step="1"
                placeholder={t("project.placeholders.rollNo") || "Leave empty to auto-assign"}
                className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <div className="text-xs text-gray-500 mt-1">Optional. Positive integer. If left blank the system will auto-assign. Uniqueness enforced by backend across goals.</div>

              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("project.fields.weight")}</label>
              <input name="weight" value={local.weight ?? 1} onChange={onLocalChange} type="number" min="0.01" step="any" max="100" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />

              {systemHint && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">{t("project.hints.systemWeight", { used: systemHint.used, available: systemHint.available }) || `System used: ${systemHint.used}, available: ${systemHint.available}`}</div>
              )}
            </>
          )}

          {inlineError && <div className="text-sm text-red-600 dark:text-red-400">{inlineError}</div>}

          {/* footer inside form */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2 bg-white dark:bg-gray-800 sticky bottom-0">
            <button type="button" onClick={() => setModal({ isOpen: false, type: null, data: null })} className="px-3 py-2 rounded border bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200">{t("project.actions.cancel")}</button>
            <button type="submit" disabled={isSubmitting} className="px-3 py-2 rounded bg-blue-600 text-white flex items-center">
              {isSubmitting ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
              {modal.type && modal.type.startsWith("edit") ? t("project.actions.save") : t("project.actions.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
