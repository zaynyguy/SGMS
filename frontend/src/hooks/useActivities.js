// src/hooks/useActivities.js
import { useCallback, useState } from "react";
import { fetchActivitiesByTask, createActivity, updateActivity, deleteActivity } from "../api/activities";
import { useTranslation } from "react-i18next";

/**
 * useActivities - loads & mutates activities keyed by taskId
 *
 * Fix: sanitizes payloads (convert empty date strings -> null, remove empty rollNo,
 * coerce numeric fields, stringify targetMetric) before optimistic update and API calls.
 */
export default function useActivities() {
  const { t } = useTranslation();
  const [activities, setActivities] = useState({}); // keyed by taskId -> array
  const [loading, setLoading] = useState({}); // keyed by taskId -> boolean
  const [error, setError] = useState(null);

  // sanitize helper - defensive, keeps UI and API safe
  const sanitizePayload = useCallback((raw = {}) => {
    const p = { ...(raw || {}) };

    // Convert common date fields empty string -> null
    ["dueDate", "startDate", "endDate"].forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(p, k)) {
        if (p[k] === "" || p[k] === undefined) {
          p[k] = null;
        } else {
          // keep non-empty string as-is (assume yyyy-mm-dd)
          p[k] = p[k];
        }
      }
    });

    // Remove rollNo if empty-ish
    if (Object.prototype.hasOwnProperty.call(p, "rollNo")) {
      if (p.rollNo === "" || p.rollNo === null || p.rollNo === undefined) {
        delete p.rollNo;
      } else {
        // coerce to integer if possible
        const rn = Number(p.rollNo);
        if (!Number.isNaN(rn)) p.rollNo = Math.floor(rn);
      }
    }

    // Coerce weight to a number (rounded to 2 decimals) if present
    if (Object.prototype.hasOwnProperty.call(p, "weight")) {
      const n = parseFloat(String(p.weight));
      if (Number.isFinite(n)) {
        p.weight = Math.round(n * 100) / 100;
      } else {
        delete p.weight; // remove invalid
      }
    }

    // targetMetric: if object, ensure stringified for endpoints that expect JSON string
    if (Object.prototype.hasOwnProperty.call(p, "targetMetric")) {
      if (p.targetMetric === "" || p.targetMetric === null || p.targetMetric === undefined) {
        p.targetMetric = null;
      } else if (typeof p.targetMetric !== "string") {
        try {
          p.targetMetric = JSON.stringify(p.targetMetric);
        } catch (e) {
          // if stringify fails, delete to avoid sending invalid content
          delete p.targetMetric;
        }
      }
      // if it's already a string, leave it (assume valid JSON)
    }

    return p;
  }, []);

  const loadActivities = useCallback(
    async (taskId, opts = {}) => {
      if (!taskId) return [];
      if (!opts.silent) setLoading((p) => ({ ...p, [taskId]: true }));
      try {
        const resp = await fetchActivitiesByTask(taskId);
        const list = Array.isArray(resp) ? resp : resp?.rows ?? [];
        setActivities((p) => ({ ...p, [taskId]: list }));
        return list;
      } catch (err) {
        setError(err?.message || t("project.errors.loadActivities"));
        setActivities((p) => ({ ...p, [taskId]: [] }));
        throw err;
      } finally {
        if (!opts.silent) setLoading((p) => ({ ...p, [taskId]: false }));
      }
    },
    [t]
  );

  const createActivityItem = useCallback(
    async (taskId, payload) => {
      if (!taskId) throw new Error("taskId required");
      // sanitize payload before optimistic update & API call
      const sanitized = sanitizePayload(payload);

      // optimistic add placeholder (server will return real row)
      const placeholder = { id: `temp-${Date.now()}`, ...sanitized };
      setActivities((p) => ({ ...p, [taskId]: [...(p[taskId] || []), placeholder] }));

      try {
        const res = await createActivity(taskId, sanitized);
        // After creation, best to reload activities for correctness
        await loadActivities(taskId);
        return res;
      } catch (err) {
        // rollback optimistic
        setActivities((p) => ({ ...p, [taskId]: (p[taskId] || []).filter(a => a.id !== placeholder.id) }));
        throw err;
      }
    },
    [loadActivities, sanitizePayload]
  );

  const updateActivityItem = useCallback(
    async (taskId, activityId, payload) => {
      if (!taskId || !activityId) throw new Error("taskId and activityId required");

      // sanitize first
      const sanitized = sanitizePayload(payload);

      // optimistic local update using sanitized values
      setActivities((p) => ({
        ...p,
        [taskId]: (p[taskId] || []).map((a) => (String(a.id) === String(activityId) ? { ...a, ...sanitized } : a)),
      }));

      try {
        // Call API with sanitized payload
        // keep signature: updateActivity(taskId, activityId, payload) as original imports expect
        const res = await updateActivity(taskId, activityId, sanitized);

        // merge returned activity if available, else reload
        if (res && res.id) {
          setActivities((p) => ({
            ...p,
            [taskId]: (p[taskId] || []).map((a) => (String(a.id) === String(activityId) ? res : a)),
          }));
        } else {
          await loadActivities(taskId);
        }
        return res;
      } catch (err) {
        // on error, reload from server to be safe and restore correct data
        await loadActivities(taskId).catch(() => {});
        throw err;
      }
    },
    [loadActivities, sanitizePayload]
  );

  const deleteActivityItem = useCallback(
    async (taskId, activityId) => {
      if (!taskId || !activityId) throw new Error("taskId and activityId required");
      // optimistic remove
      const prev = (activities[taskId] || []);
      setActivities((p) => ({ ...p, [taskId]: prev.filter((a) => String(a.id) !== String(activityId)) }));

      try {
        await deleteActivity(taskId, activityId);
        // may choose to reload or keep optimistic state; we'll reload to be safe
        await loadActivities(taskId);
      } catch (err) {
        // rollback if delete failed
        setActivities((p) => ({ ...p, [taskId]: prev }));
        throw err;
      }
    },
    [activities, loadActivities]
  );

  return {
    activities,
    loading,
    error,
    loadActivities,
    createActivityItem,
    updateActivityItem,
    deleteActivityItem,
  };
}
