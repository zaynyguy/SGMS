import React from "react";
import PropTypes from "prop-types";
import ProgressBar from "../ui/ProgressBar";
import StatusBadge from "../ui/StatusBadge";
import SkeletonCard from "../ui/SkeletonCard";

export default function GoalList({ goals, isLoading, onToggleGoal, onCreate, onUpdate, onDelete, searchTerm }) {
  if (isLoading) return <SkeletonCard rows={3} />;

  const filtered = (goals || []).filter((g) => {
    const q = String(searchTerm || "").trim().toLowerCase();
    if (!q) return true;
    return (g.title || "").toLowerCase().includes(q) || (g.description || "").toLowerCase().includes(q);
  });

  if (!filtered.length) return <div className="p-4 text-sm text-gray-500">No goals</div>;

  return (
    <div className="space-y-3">
      {filtered.map((g) => (
        <div key={g.id} className="bg-white dark:bg-gray-800 p-4 rounded shadow-sm border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  {g?.rollNo !== undefined && g?.rollNo !== null && (
                    <span className="text-sky-600 font-semibold text-sm">{String(g.rollNo)}.</span>
                  )}
                  <span>{g.title}</span>
                </h3>
                <StatusBadge status={g.status} />
              </div>
              <div className="text-xs text-gray-500 mt-1">{g.description}</div>
              <div className="mt-3 max-w-xs">
                <ProgressBar progress={g.progress ?? 0} variant="goal" />
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="text-xs text-gray-400">{g.startDate || "—"}</div>
              <div className="flex gap-2">
                <button onClick={() => onToggleGoal(g)} aria-label="Toggle">Toggle</button>
                <button onClick={() => onUpdate(g.id, g)}>Edit</button>
                <button onClick={() => onDelete(g.id)}>Delete</button>
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
