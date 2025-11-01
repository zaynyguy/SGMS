import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import ProgressBar from "../ui/ProgressBar";
import StatusBadge from "../ui/StatusBadge";
import SkeletonCard from "../ui/SkeletonCard";

function GoalList({ goals = [], isLoading = false, onToggleGoal, onCreate, onUpdate, onDelete, searchTerm = "" }) {
  const { t } = useTranslation();
  const animTimer = useRef(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // derived filtered list
  const filteredGoals = useMemo(() => {
    if (isLoading) return [];
    const q = String(searchTerm || "").trim().toLowerCase();
    if (!q) return goals;
    return goals.filter((g) => {
      const title = String(g.title || "").toLowerCase();
      const desc = String(g.description || "").toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }, [goals, isLoading, searchTerm]);

  useEffect(() => {
    if (!isLoading) {
      setIsAnimating(true);
      clearTimeout(animTimer.current);
      animTimer.current = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(animTimer.current);
    }
    return undefined;
  }, [filteredGoals, isLoading]);

  useEffect(() => () => clearTimeout(animTimer.current), []);

  if (isLoading) return <SkeletonCard rows={3} />;

  if (!filteredGoals.length) {
    return (
      <div className="goal-list-empty goal-fade-in">
        {/* move style out or keep single block */}
        <style>{`/* ...animations... */`}</style>
        <div className="p-8 text-center goal-empty-state">
          <div className="text-gray-400 dark:text-gray-500 text-lg mb-2">
            {t("project.empty.noGoals") || "No goals found"}
          </div>
          {searchTerm && <p className="text-sm text-gray-500 dark:text-gray-400">No results for "{searchTerm}"</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 goal-list-container">
      <style>{`/* ...animations... */`}</style>
      {filteredGoals.map((g, i) => (
        <div
          key={g.id}
          className="bg-white dark:bg-gray-800 p-4 rounded shadow-sm border goal-list-item"
          style={{ animationDelay: `${i * 80}ms`, transitionDelay: `${i * 20}ms` }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  {g?.rollNo != null && <span className="text-sky-600">{String(g.rollNo)}.</span>}
                  <span>{g.title}</span>
                </h3>
                <StatusBadge status={g.status} />
              </div>

              <div className="text-xs text-gray-500 mt-1">{g.description || t("project.na") || "—"}</div>

              <div className="mt-3 max-w-xs">
                <ProgressBar progress={g.progress ?? 0} variant="goal" />
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="text-xs text-gray-400">{g.startDate || t("na") || "—"}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onToggleGoal && onToggleGoal(g)}
                  aria-label={t("project.actions.toggleGoal") || "Toggle"}
                  className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded"
                >
                  {t("project.actions.toggleGoal") || "Toggle"}
                </button>
                <button type="button" onClick={() => onUpdate && onUpdate(g.id, g)} className="px-3 py-1 text-xs bg-blue-100 rounded">
                  {t("project.actions.edit") || "Edit"}
                </button>
                <button type="button" onClick={() => onDelete && onDelete(g.id)} className="px-3 py-1 text-xs bg-red-100 rounded">
                  {t("project.actions.delete") || "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

GoalList.propTypes = {
  goals: PropTypes.array,
  isLoading: PropTypes.bool,
  onToggleGoal: PropTypes.func.isRequired,
  onCreate: PropTypes.func,
  onUpdate: PropTypes.func,
  onDelete: PropTypes.func,
  searchTerm: PropTypes.string,
};

export default React.memo(GoalList);
