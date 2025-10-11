// src/hooks/useActivities.js
import { useCallback, useState } from "react";
import { fetchActivitiesByTask, createActivity, updateActivity, deleteActivity } from "../api/activities";
import { useTranslation } from "react-i18next";

export default function useActivities() {
  const { t } = useTranslation();
  const [activities, setActivities] = useState({}); // keyed by taskId
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);

  const loadActivities = useCallback(
    async (taskId, opts = {}) => {
      if (!taskId) return;
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
      await createActivity(taskId, payload);
      await loadActivities(taskId);
    },
    [loadActivities]
  );

  const updateActivityItem = useCallback(
    async (taskId, activityId, payload) => {
      await updateActivity(taskId, activityId, payload);
      await loadActivities(taskId);
    },
    [loadActivities]
  );

  const deleteActivityItem = useCallback(
    async (taskId, activityId) => {
      await deleteActivity(taskId, activityId);
      // optimistically remove from state to avoid an extra fetch (optional)
      setActivities((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] || []).filter((a) => a.id !== activityId),
      }));
      await loadActivities(taskId);
    },
    [loadActivities]
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
