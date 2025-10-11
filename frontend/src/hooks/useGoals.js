// src/hooks/useGoals.js
import { useCallback, useState } from "react";
import { fetchGoals, createGoal, updateGoal, deleteGoal } from "../api/goals";
import { useTranslation } from "react-i18next";

export default function useGoals({ initialPage = 1, initialSize = 20, prefetchTasks } = {}) {
  const { t } = useTranslation();
  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadGoals = useCallback(
    async (opts = {}) => {
      setIsLoading(true);
      setError(null);
      try {
        const page = opts.page ?? initialPage;
        const size = opts.pageSize ?? initialSize;
        const resp = await fetchGoals(page, size);
        const rows = resp?.rows ?? resp ?? [];
        setGoals(rows);

        if (typeof prefetchTasks === "function") {
          const firstFew = rows.slice(0, 2).map((g) => g.id).filter(Boolean);
          await Promise.all(firstFew.map((gId) => prefetchTasks(gId, { silent: true })));
        }
        return rows;
      } catch (err) {
        setError(err?.message || t("project.errors.loadGoals"));
        setGoals([]);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [initialPage, initialSize, prefetchTasks, t]
  );

  const createGoalItem = useCallback(async (payload) => {
    await createGoal(payload);
    await loadGoals({ page: 1 });
  }, [loadGoals]);

  const updateGoalItem = useCallback(async (id, payload) => {
    await updateGoal(id, payload);
    await loadGoals();
  }, [loadGoals]);

  const deleteGoalItem = useCallback(async (id) => {
    await deleteGoal(id);
    await loadGoals();
  }, [loadGoals]);

  return { goals, setGoals, isLoading, error, loadGoals, createGoalItem, updateGoalItem, deleteGoalItem };
}
