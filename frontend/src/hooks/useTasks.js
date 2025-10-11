// src/hooks/useTasks.js
import { useCallback, useState } from "react";
import { fetchTasksByGoal, createTask, updateTask, deleteTask } from "../api/tasks";
import { useTranslation } from "react-i18next";

export default function useTasks() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);

  const loadTasks = useCallback(async (goalId, opts = {}) => {
    if (!goalId) return;
    if (!opts.silent) setLoading((p) => ({ ...p, [goalId]: true }));
    try {
      const resp = await fetchTasksByGoal(goalId);
      const list = Array.isArray(resp) ? resp : resp?.rows ?? [];
      setTasks((p) => ({ ...p, [goalId]: list }));
      return list;
    } catch (err) {
      setError(err?.message || t("project.errors.loadTasks"));
      setTasks((p) => ({ ...p, [goalId]: [] }));
      throw err;
    } finally {
      if (!opts.silent) setLoading((p) => ({ ...p, [goalId]: false }));
    }
  }, [t]);

  const createTaskItem = useCallback(async (goalId, payload) => {
    await createTask(goalId, payload);
    await loadTasks(goalId);
  }, [loadTasks]);

  const updateTaskItem = useCallback(async (goalId, taskId, payload) => {
    await updateTask(goalId, taskId, payload);
    await loadTasks(goalId);
  }, [loadTasks]);

  const deleteTaskItem = useCallback(async (goalId, taskId) => {
    await deleteTask(goalId, taskId);
    await loadTasks(goalId);
  }, [loadTasks]);

  return { tasks, loading, error, loadTasks, createTaskItem, updateTaskItem, deleteTaskItem };
}
