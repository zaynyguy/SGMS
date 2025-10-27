import React, { memo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, Edit, Trash2, Calendar, CheckSquare, Plus as PlusIcon } from "lucide-react";
// Assuming 'ui' components are in 'src/components/ui'
import ProgressBar from "../ui/ProgressBar";
import StatusBadge from "../ui/StatusBadge";
import TaskList from "./TaskList";
// Assuming 'utils' are in 'src/utils'
import { formatDate } from "../../uites/projectUtils";

/**
 * Renders a single Goal card.
 * Manages its own expanded state to show/hide the TaskList.
 * Delegates all actions (edit/delete goal, create/edit/delete task) to props.
 */
function GoalCard({
  goal,
  expandedGoal,
  toggleGoal,
  setSelectedGoal,
  canManageGTA,
  handleDeleteGoal,

  // props forwarded from parent
  onEditGoal,
  onCreateTask,
  onEditTask,
  onDeleteTask,
  onCreateActivity,
  onEditActivity,
  onDeleteActivity,
  openSubmitModal,
  canSubmitReport,
  reportingActive,

  // existing data props
  tasks,
  tasksLoading,
  toggleTask,
  expandedTask,
  activities,
  activitiesLoading,
}) {
  const { t } = useTranslation();
  const isExpanded = expandedGoal === goal.id;
  const [isAnimating, setIsAnimating] = useState(false);
  const [renderContent, setRenderContent] = useState(false);
  const contentRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (isExpanded) {
      setRenderContent(true);
      // Small delay to ensure DOM is updated before animation starts
      timeoutRef.current = setTimeout(() => {
        setIsAnimating(true);
      }, 10);
    } else {
      setIsAnimating(false);
      // Wait for collapse animation to complete before removing content
      timeoutRef.current = setTimeout(() => {
        setRenderContent(false);
      }, 300);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isExpanded]);

  const handleToggleGoal = (goal) => {
    setIsAnimating(true);
    toggleGoal(goal);
  };

  return (
    <>
      <style>{`
        @keyframes goalCardSlideIn {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes goalExpand {
          from {
            opacity: 0;
            max-height: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            max-height: 2000px;
            transform: translateY(0);
          }
        }
        @keyframes goalCollapse {
          from {
            opacity: 1;
            max-height: 2000px;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            max-height: 0;
            transform: translateY(-10px);
          }
        }
        @keyframes buttonPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        @keyframes iconRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(180deg); }
        }
        @keyframes progressGlow {
          0% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
          50% { box-shadow: 0 0 15px rgba(59, 130, 246, 0.8); }
          100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
        }
        @keyframes smoothHeight {
          from { 
            max-height: 0;
            overflow: hidden;
          }
          to { 
            max-height: var(--max-height);
            overflow: hidden;
          }
        }
        
        .goal-card-animate {
          animation: goalCardSlideIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        .goal-expand-animate {
          animation: goalExpand 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        .goal-collapse-animate {
          animation: goalCollapse 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        .goal-card-interactive {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          transform-origin: center;
        }
        .goal-card-interactive:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }
        .goal-btn-interactive {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .goal-btn-interactive:hover {
          transform: scale(1.1);
        }
        .goal-btn-interactive:active {
          transform: scale(0.95);
        }
        .goal-icon-rotate {
          transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        .goal-expanded .goal-icon-rotate {
          transform: rotate(90deg);
        }
        .goal-progress-glow {
          animation: progressGlow 2s ease-in-out infinite;
        }
        .goal-pulse-on-hover:hover {
          animation: buttonPulse 0.6s ease-in-out;
        }
        .goal-fade-in {
          animation: goalCardSlideIn 0.5s ease-out both;
        }
        .goal-stagger-item {
          opacity: 0;
          animation: goalCardSlideIn 0.4s ease-out both;
        }
        .goal-content-wrapper {
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .goal-content-expanded {
          max-height: 5000px;
          opacity: 1;
          transform: translateY(0);
        }
        .goal-content-collapsed {
          max-height: 0;
          opacity: 0;
          transform: translateY(-10px);
        }
        .goal-smooth-transition {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      <article
        key={goal.id}
        className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-lg mb-6 overflow-hidden goal-card-animate goal-card-interactive ${isExpanded ? 'goal-expanded' : ''}`}
        role="region"
        aria-labelledby={`goal-${goal.id}-title`}
        style={{ animationDelay: `${goal.id % 5 * 100}ms` }}
      >
        <div className="p-5 md:p-6">
          <div className="flex flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <button
                onClick={() => handleToggleGoal(goal)}
                className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hidden sm:block goal-btn-interactive goal-icon-rotate"
                aria-label={t("project.actions.toggleGoal") || "Toggle"}
                title={t("project.actions.toggleGoal") || "Toggle"}
              >
                {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </button>

              <div 
                className="min-w-0 flex-1" 
                onClick={() => setSelectedGoal(goal)} 
                style={{ cursor: "pointer" }}
              >
                <div className="flex items-start justify-between">
                  {/* rollNo displayed before title */}
                  <h3 id={`goal-${goal.id}-title`} className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white break-words flex items-center gap-3 goal-fade-in">
                    {goal?.rollNo !== undefined && goal?.rollNo !== null ? (
                      <span className="text-sky-600 dark:text-sky-400 font-semibold goal-pulse-on-hover">{String(goal.rollNo)}.</span>
                    ) : null}
                    <span>{goal.title}</span>
                  </h3>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 break-words goal-fade-in" style={{ animationDelay: "50ms" }}>
                  {goal.description || t("project.na") || "—"}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-300 goal-fade-in" style={{ animationDelay: "100ms" }}>
                  <span className="whitespace-nowrap">
                    {t("project.fields.group") || "Group"}:{" "}
                    <strong className="text-gray-800 dark:text-gray-100">{goal.groupName || t("project.unassigned")}</strong>
                  </span>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <StatusBadge status={goal.status} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4 md:mt-0">
              <div className="flex flex-col md:flex-row md:items-center items-end gap-2 ml-2">
                <div className="md:hidden">
                  <button
                    onClick={() => handleToggleGoal(goal)}
                    className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 goal-btn-interactive goal-icon-rotate"
                    aria-label={isExpanded ? (t("project.actions.close") || "Close") : (t("project.actions.open") || "Open")}
                  >
                    {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </button>
                </div>

                <div className="hidden md:flex flex-col items-end text-xs text-gray-500 dark:text-gray-300 mr-3 w-36">
                  <div className="w-full goal-progress-glow">
                    <ProgressBar progress={goal.progress ?? 0} variant="goal" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {canManageGTA && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent card click
                          onEditGoal && onEditGoal(goal);
                        }}
                        className="p-2 text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md sm:block goal-btn-interactive goal-pulse-on-hover"
                        title={t("project.actions.edit") || "Edit"}
                        aria-label={(t("project.actions.edit") || "Edit") + (goal.title ? `: ${goal.title}` : "")}
                      >
                        <Edit className="h-5 w-5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent card click
                          handleDeleteGoal && handleDeleteGoal(goal.id);
                        }}
                        className="p-2 text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md sm:block goal-btn-interactive"
                        title={t("project.actions.delete") || "Delete"}
                        aria-label={(t("project.actions.delete") || "Delete") + (goal.title ? `: ${goal.title}` : "")}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-2 goal-stagger-item" style={{ animationDelay: "150ms" }}>
              <Calendar className="h-4 w-4" />
              <span className="truncate">
                {formatDate(goal.startDate)} — {formatDate(goal.endDate)}
              </span>
            </div>
            <div className="goal-stagger-item" style={{ animationDelay: "200ms" }}>
              {t("project.fields.weight") || "Weight"}: <strong className="text-gray-800 dark:text-gray-100">{goal.weight ?? "-"}</strong>
            </div>
            <div className="flex items-center gap-3 md:hidden goal-stagger-item" style={{ animationDelay: "250ms" }}>
              <div className="flex-1 max-w-xs goal-progress-glow">
                <ProgressBar progress={goal.progress ?? 0} variant="goal" />
              </div>
            </div>
          </div>

          {/* Smooth Expand/Collapse Container */}
          <div 
            ref={contentRef}
            className={`goal-content-wrapper goal-smooth-transition ${
              isExpanded && isAnimating 
                ? 'goal-content-expanded' 
                : !isExpanded && isAnimating 
                ? 'goal-content-collapsed' 
                : 'goal-content-collapsed'
            }`}
          >
            {(renderContent || isExpanded) && (
              <div className="mt-6 pl-0 sm:pl-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 goal-fade-in">
                    <CheckSquare className="h-4 w-4 text-sky-600 goal-pulse-on-hover" /> {t("project.sections.tasks") || "Tasks"}
                  </h4>
                  <div>
                    {canManageGTA && (
                      <button
                        onClick={(e) => {
                           e.stopPropagation();
                           onCreateTask && onCreateTask(goal.id);
                        }}
                        className="px-2 py-1 bg-blue-500 text-white rounded text-xs flex items-center gap-1 goal-btn-interactive goal-pulse-on-hover"
                        title={t("project.actions.addTask") || "Add Task"}
                      >
                        <PlusIcon className="h-3 w-3" /> {t("project.actions.addTask") || "Add Task"}
                      </button>
                    )}
                  </div>
                </div>

                <TaskList
                  goal={goal}
                  tasks={tasks}
                  tasksLoading={tasksLoading}
                  toggleTask={toggleTask}
                  expandedTask={expandedTask}
                  // forward parent handlers directly
                  onEditTask={onEditTask}
                  onDeleteTask={onDeleteTask}
                  onCreateActivity={onCreateActivity}
                  onEditActivity={onEditActivity}
                  onDeleteActivity={onDeleteActivity}
                  openSubmitModal={openSubmitModal}
                  canSubmitReport={canSubmitReport}
                  reportingActive={reportingActive}
                  activities={activities}
                  activitiesLoading={activitiesLoading}
                  canManageGTA={canManageGTA} // Pass permission down
                />
              </div>
            )}
          </div>
        </div>
      </article>
    </>
  );
}

export default memo(GoalCard);