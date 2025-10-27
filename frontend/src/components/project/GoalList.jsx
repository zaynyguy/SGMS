import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import ProgressBar from "../ui/ProgressBar";
import StatusBadge from "../ui/StatusBadge";
import SkeletonCard from "../ui/SkeletonCard";

export default function GoalList({ goals, isLoading, onToggleGoal, onCreate, onUpdate, onDelete, searchTerm }) {
  const { t } = useTranslation();
  const [displayedGoals, setDisplayedGoals] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      const filtered = (goals || []).filter((g) => {
        const q = String(searchTerm || "").trim().toLowerCase();
        if (!q) return true;
        return (g.title || "").toLowerCase().includes(q) || (g.description || "").toLowerCase().includes(q);
      });
      
      setIsAnimating(true);
      setDisplayedGoals(filtered);
      
      // Reset animation state after transition
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [goals, isLoading, searchTerm]);

  if (isLoading) return <SkeletonCard rows={3} />;

  if (!displayedGoals.length) {
    return (
      <div className="goal-list-empty goal-fade-in">
        <style>{`
          @keyframes goalListSlideIn {
            from {
              opacity: 0;
              transform: translateY(20px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          @keyframes goalListItemStagger {
            from {
              opacity: 0;
              transform: translateX(-10px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes buttonPulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
          @keyframes progressGlow {
            0% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
            50% { box-shadow: 0 0 15px rgba(59, 130, 246, 0.8); }
            100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
          }
          @keyframes emptyStateFade {
            from { 
              opacity: 0;
              transform: scale(0.95);
            }
            to { 
              opacity: 1;
              transform: scale(1);
            }
          }
          
          .goal-list-container {
            animation: goalListSlideIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          }
          .goal-list-item {
            animation: goalListItemStagger 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            transform-origin: center;
          }
          .goal-list-item:hover {
            transform: translateY(-3px) scale(1.01);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
          }
          .goal-list-btn {
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .goal-list-btn:hover {
            transform: scale(1.1);
            background-color: rgba(59, 130, 246, 0.1);
          }
          .goal-list-btn:active {
            transform: scale(0.95);
          }
          .goal-list-progress {
            transition: all 0.3s ease;
          }
          .goal-list-progress-glow {
            animation: progressGlow 2s ease-in-out infinite;
          }
          .goal-list-pulse:hover {
            animation: buttonPulse 0.6s ease-in-out;
          }
          .goal-fade-in {
            animation: goalListSlideIn 0.5s ease-out both;
          }
          .goal-empty-state {
            animation: emptyStateFade 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          }
          .goal-list-stagger {
            opacity: 0;
            animation: goalListItemStagger 0.4s ease-out both;
          }
        `}</style>
        <div className="p-8 text-center goal-empty-state">
          <div className="text-gray-400 dark:text-gray-500 text-lg mb-2">
            {t("project.empty.noGoals") || "No goals found"}
          </div>
          {searchTerm && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No results for "{searchTerm}"
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 goal-list-container">
      <style>{`
        @keyframes goalListSlideIn {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes goalListItemStagger {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes buttonPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        @keyframes progressGlow {
          0% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
          50% { box-shadow: 0 0 15px rgba(59, 130, 246, 0.8); }
          100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
        }
        @keyframes emptyStateFade {
          from { 
            opacity: 0;
            transform: scale(0.95);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .goal-list-container {
          animation: goalListSlideIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        .goal-list-item {
          animation: goalListItemStagger 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          transform-origin: center;
        }
        .goal-list-item:hover {
          transform: translateY(-3px) scale(1.01);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
        }
        .goal-list-btn {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .goal-list-btn:hover {
          transform: scale(1.1);
          background-color: rgba(59, 130, 246, 0.1);
        }
        .goal-list-btn:active {
          transform: scale(0.95);
        }
        .goal-list-progress {
          transition: all 0.3s ease;
        }
        .goal-list-progress-glow {
          animation: progressGlow 2s ease-in-out infinite;
        }
        .goal-list-pulse:hover {
          animation: buttonPulse 0.6s ease-in-out;
        }
        .goal-fade-in {
          animation: goalListSlideIn 0.5s ease-out both;
        }
        .goal-empty-state {
          animation: emptyStateFade 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        .goal-list-stagger {
          opacity: 0;
          animation: goalListItemStagger 0.4s ease-out both;
        }
      `}</style>

      {displayedGoals.map((g, index) => (
        <div 
          key={g.id} 
          className="bg-white dark:bg-gray-800 p-4 rounded shadow-sm border goal-list-item goal-list-stagger"
          style={{ 
            animationDelay: `${index * 80}ms`,
            transitionDelay: `${index * 20}ms`
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 goal-list-pulse">
                  {g?.rollNo !== undefined && g?.rollNo !== null && (
                    <span className="text-sky-600 font-semibold text-sm goal-list-pulse">
                      {String(g.rollNo)}.
                    </span>
                  )}
                  <span>{g.title}</span>
                </h3>
                <StatusBadge status={g.status} />
              </div>
              
              <div 
                className="text-xs text-gray-500 mt-1 goal-fade-in" 
                style={{ animationDelay: `${index * 80 + 100}ms` }}
              >
                {g.description || t("project.na") || "—"}
              </div>
              
              <div 
                className="mt-3 max-w-xs goal-list-progress"
                style={{ animationDelay: `${index * 80 + 200}ms` }}
              >
                <div className="goal-list-progress-glow">
                  <ProgressBar progress={g.progress ?? 0} variant="goal" />
                </div>
              </div>
            </div>

            <div 
              className="flex flex-col items-end gap-2 goal-fade-in"
              style={{ animationDelay: `${index * 80 + 150}ms` }}
            >
              <div className="text-xs text-gray-400">{g.startDate || t("na") || "—"}</div>
              <div className="flex gap-2">
                <button 
                  onClick={() => onToggleGoal(g)} 
                  aria-label={t("project.actions.toggleGoal") || "Toggle"}
                  className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded goal-list-btn goal-list-pulse"
                >
                  {t("project.actions.toggleGoal") || "Toggle"}
                </button>
                <button 
                  onClick={() => onUpdate && onUpdate(g.id, g)} 
                  aria-label={t("project.actions.edit") || "Edit"}
                  className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded goal-list-btn"
                >
                  {t("project.actions.edit") || "Edit"}
                </button>
                <button 
                  onClick={() => onDelete && onDelete(g.id)} 
                  aria-label={t("project.actions.delete") || "Delete"}
                  className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded goal-list-btn"
                >
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