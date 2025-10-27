import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, Edit, Trash2, Calendar, List, Plus as PlusIcon } from "lucide-react";
// Assuming 'ui' components are in 'src/components/ui'
import ProgressBar from "../ui/ProgressBar";
import StatusBadge from "../ui/StatusBadge";
// Assuming 'utils' are in 'src/utils'
import { formatDate } from "../../uites/projectUtils";
// ActivityList is now imported explicitly
import ActivityList from "./ActivityList"; 

/**
 * Renders a list of Task cards for a specific Goal.
 *
 * **FIX APPLIED:** The desktop "Edit" button (`onEditTask`) now passes the
 * full `task` object instead of just `task.id`. This makes it
 * consistent with the mobile button and ensures the Edit Modal
 * receives the full data, fixing the "data not loading" bug.
 */
export default function TaskList({
  goal,
  tasks = {},
  tasksLoading = false,
  toggleTask,
  expandedTask,

  // task-level handlers (expected from parent)
  onEditTask,
  onDeleteTask,

  // activity-level handlers (forwarded to ActivityList)
  activities = {},
  activitiesLoading = {},
  onCreateActivity,
  onEditActivity,
  onDeleteActivity,
  openSubmitModal,

  canSubmitReport,
  reportingActive,
  canManageGTA, // Permission prop
}) {
  const { t } = useTranslation();
  const [animatingTasks, setAnimatingTasks] = useState({});
  const [renderContents, setRenderContents] = useState({});
  const timeoutRefs = useRef({});

  // tasks might be passed as an object keyed by goal.id OR as an array for this goal.
  const goalTasks = Array.isArray(tasks) ? tasks : tasks && tasks[goal.id] ? tasks[goal.id] : [];

  const loading = typeof tasksLoading === "object" ? tasksLoading[goal.id] : tasksLoading;

  useEffect(() => {
    // Cleanup timeouts on unmount
    return () => {
      Object.values(timeoutRefs.current).forEach(clearTimeout);
    };
  }, []);

  const handleToggleTask = (goal, task) => {
    const taskId = task.id;
    const isCurrentlyExpanded = expandedTask === taskId;
    
    if (!isCurrentlyExpanded) {
      // Expanding - immediately render content
      setRenderContents(prev => ({ ...prev, [taskId]: true }));
      setAnimatingTasks(prev => ({ ...prev, [taskId]: true }));
    } else {
      // Collapsing - start animation
      setAnimatingTasks(prev => ({ ...prev, [taskId]: false }));
      
      // Remove content after animation completes
      if (timeoutRefs.current[taskId]) {
        clearTimeout(timeoutRefs.current[taskId]);
      }
      timeoutRefs.current[taskId] = setTimeout(() => {
        setRenderContents(prev => ({ ...prev, [taskId]: false }));
        setAnimatingTasks(prev => ({ ...prev, [taskId]: null }));
      }, 300);
    }

    toggleTask(goal, task);
  };

  if (loading) {
    return (
      <div className="p-3 task-fade-in">
        <style>{`
          @keyframes taskSlideIn {
            from {
              opacity: 0;
              transform: translateY(15px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          @keyframes taskExpand {
            from {
              opacity: 0;
              max-height: 0;
              transform: translateY(-8px);
            }
            to {
              opacity: 1;
              max-height: 2000px;
              transform: translateY(0);
            }
          }
          @keyframes taskCollapse {
            from {
              opacity: 1;
              max-height: 2000px;
              transform: translateY(0);
            }
            to {
              opacity: 0;
              max-height: 0;
              transform: translateY(-8px);
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
          @keyframes iconRotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(180deg); }
          }
          
          .task-list-container {
            animation: taskSlideIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          }
          .task-item {
            animation: taskSlideIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            transform-origin: center;
          }
          .task-item:hover {
            transform: translateY(-2px) scale(1.005);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
          }
          .task-btn {
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .task-btn:hover {
            transform: scale(1.1);
          }
          .task-btn:active {
            transform: scale(0.95);
          }
          .task-icon-rotate {
            transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          }
          .task-expanded .task-icon-rotate {
            transform: rotate(90deg);
          }
          .task-progress-glow {
            animation: progressGlow 2s ease-in-out infinite;
          }
          .task-pulse:hover {
            animation: buttonPulse 0.6s ease-in-out;
          }
          .task-fade-in {
            animation: taskSlideIn 0.5s ease-out both;
          }
          .task-expand-content {
            animation: taskExpand 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          }
          .task-collapse-content {
            animation: taskCollapse 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          }
          .task-content-wrapper {
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .task-content-expanded {
            max-height: 5000px;
            opacity: 1;
            transform: translateY(0);
          }
          .task-content-collapsed {
            max-height: 0;
            opacity: 0;
            transform: translateY(-8px);
          }
          .task-stagger-item {
            opacity: 0;
            animation: taskSlideIn 0.4s ease-out both;
          }
        `}</style>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <List className="h-4 w-4" />
          {t("project.loadingTasks") || "Loading tasks…"}
        </div>
      </div>
    );
  }

  if (!goalTasks || goalTasks.length === 0) {
    return (
      <div className="p-3 text-sm text-gray-500 task-fade-in">
        {t("project.empty.noTasks") || "No tasks for this goal."}
      </div>
    );
  }

  return (
    <div className="space-y-3 task-list-container">
      <style>{`
        @keyframes taskSlideIn {
          from {
            opacity: 0;
            transform: translateY(15px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes taskExpand {
          from {
            opacity: 0;
            max-height: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            max-height: 2000px;
            transform: translateY(0);
          }
        }
        @keyframes taskCollapse {
          from {
            opacity: 1;
            max-height: 2000px;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            max-height: 0;
            transform: translateY(-8px);
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
        @keyframes iconRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(180deg); }
        }
        
        .task-list-container {
          animation: taskSlideIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        .task-item {
          animation: taskSlideIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          transform-origin: center;
        }
        .task-item:hover {
          transform: translateY(-2px) scale(1.005);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
        }
        .task-btn {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .task-btn:hover {
          transform: scale(1.1);
        }
        .task-btn:active {
          transform: scale(0.95);
        }
        .task-icon-rotate {
          transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        .task-expanded .task-icon-rotate {
          transform: rotate(90deg);
        }
        .task-progress-glow {
          animation: progressGlow 2s ease-in-out infinite;
        }
        .task-pulse:hover {
          animation: buttonPulse 0.6s ease-in-out;
        }
        .task-fade-in {
          animation: taskSlideIn 0.5s ease-out both;
        }
        .task-expand-content {
          animation: taskExpand 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        .task-collapse-content {
          animation: taskCollapse 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        .task-content-wrapper {
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .task-content-expanded {
          max-height: 5000px;
          opacity: 1;
          transform: translateY(0);
        }
        .task-content-collapsed {
          max-height: 0;
          opacity: 0;
          transform: translateY(-8px);
        }
        .task-stagger-item {
          opacity: 0;
          animation: taskSlideIn 0.4s ease-out both;
        }
      `}</style>

      {goalTasks.map((task, index) => {
        const taskIsExpanded = expandedTask === task.id;
        const isAnimating = animatingTasks[task.id];
        const shouldRenderContent = renderContents[task.id] || taskIsExpanded;

        // compute composite roll: goal.rollNo.task.rollNo (if available)
        const compositeRoll =
          goal?.rollNo !== undefined &&
          goal?.rollNo !== null &&
          task?.rollNo !== undefined &&
          task?.rollNo !== null
            ? `${String(goal.rollNo)}.${String(task.rollNo)}`
            : task?.rollNo !== undefined && task?.rollNo !== null
            ? String(task.rollNo)
            : null;

        return (
          <div 
            key={task.id} 
            className={`p-3 bg-gray-100 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 task-item ${taskIsExpanded ? 'task-expanded' : ''}`}
            style={{ 
              animationDelay: `${index * 60}ms`,
              transitionDelay: `${index * 20}ms`
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 min-w-0">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <button
                  onClick={() => handleToggleTask(goal, task)}
                  className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hidden sm:block task-btn task-icon-rotate"
                  aria-label={t("project.actions.toggleTask") || "Toggle task"}
                >
                  {taskIsExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between">
                    <div className="font-medium text-gray-900 dark:text-white break-words flex items-center gap-2 task-pulse">
                      {compositeRoll && <span className="text-sky-600 dark:text-sky-400 font-semibold task-pulse">{compositeRoll}.</span>}
                      <span>{task.title}</span>
                    </div>

                    {/* Mobile inline toggle */}
                    <div className="sm:hidden flex items-center gap-2 ml-2">
                      <button
                        onClick={() => handleToggleTask(goal, task)}
                        className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 task-btn task-icon-rotate"
                        aria-label={t("project.actions.toggleTask") || "Toggle task"}
                      >
                        {taskIsExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div 
                    className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words task-fade-in"
                    style={{ animationDelay: `${index * 60 + 50}ms` }}
                  >
                    {task.description || t("project.na") || "—"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 whitespace-nowrap justify-between sm:justify-end">
                <StatusBadge status={task.status} />

                {/* Desktop edit/delete - hidden if canManageGTA is falsy */}
                {canManageGTA && (
                  <div className="hidden sm:flex items-center gap-1">
                    <button
                      onClick={() => onEditTask && onEditTask(goal.id, task)}
                      className="p-2 text-blue-600 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md task-btn task-pulse"
                      title={t("project.actions.edit") || "Edit task"}
                      aria-label={(t("project.actions.edit") || "Edit") + (task.title ? `: ${task.title}` : "")}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDeleteTask && onDeleteTask(goal.id, task.id)}
                      className="p-2 text-red-600 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md task-btn"
                      title={t("project.actions.delete") || "Delete task"}
                      aria-label={(t("project.actions.delete") || "Delete") + (task.title ? `: ${task.title}` : "")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Mobile actions (compact) - hidden if canManageGTA is falsy */}
            {canManageGTA && (
              <div 
                className="inline-flex sm:hidden items-center gap-1 mt-2 task-fade-in"
                style={{ animationDelay: `${index * 60 + 100}ms` }}
              >
                <button
                  onClick={() => onEditTask && onEditTask(goal.id, task)}
                  className="flex-shrink-0 inline-flex items-center gap-2 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-sm task-btn task-pulse"
                  aria-label={t("project.actions.edit") || "Edit task"}
                  title={t("project.actions.edit") || "Edit task"}
                >
                  <Edit className="h-4 w-4 dark:text-blue-400" />
                </button>
                <button
                  onClick={() => onDeleteTask && onDeleteTask(goal.id, task.id)}
                  className="flex-shrink-0 inline-flex items-center gap-2 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-red-600 task-btn"
                  aria-label={t("project.actions.delete") || "Delete task"}
                  title={t("project.actions.delete") || "Delete task"}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}

            <div 
              className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-600 dark:text-gray-300 pl-0 sm:pl-9 task-stagger-item"
              style={{ animationDelay: `${index * 60 + 150}ms` }}
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{t("project.fields.due") || "Due"}: {formatDate(task.dueDate)}</span>
              </div>
              <div>
                {t("project.fields.weight") || "Weight"}: <strong>{task.weight ?? "-"}</strong>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 max-w-xs task-progress-glow">
                  <ProgressBar progress={task.progress ?? 0} />
                </div>
              </div>
            </div>

            {/* Smooth Expand/Collapse Container for Activities */}
            <div 
              className={`task-content-wrapper ${
                taskIsExpanded && isAnimating 
                  ? 'task-content-expanded' 
                  : !taskIsExpanded && isAnimating 
                  ? 'task-content-collapsed' 
                  : 'task-content-collapsed'
              }`}
            >
              {shouldRenderContent && (
                <div className="mt-4 pl-0 sm:pl-9">
                  <div className="flex items-center justify-between mb-2">
                    <h6 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 task-fade-in">
                      <List className="h-4 w-4 text-sky-600 task-pulse" /> {t("project.sections.activities") || "Activities"}
                    </h6>

                    <div>
                      {/* Add Activity button hidden when canManageGTA is falsy */}
                      {canManageGTA && (
                        <button
                          onClick={() => onCreateActivity && onCreateActivity(goal.id, task.id)}
                          className="px-2 py-1 text-xs bg-blue-500 text-white rounded task-btn task-pulse"
                          title={t("actions.addActivity") || "Add Activity"}
                        >
                          <PlusIcon className="inline-block h-3 w-3 mr-1" /> {t("project.actions.addActivity") || "Add Activity"}
                        </button>
                      )}
                    </div>
                  </div>

                  <ActivityList
                    goal={goal}
                    task={task}
                    activities={activities[task.id] || []}
                    activitiesLoading={activitiesLoading ? activitiesLoading[task.id] : false}
                    // Pass handlers down, ensuring to include goal.id and task.id
                    onEditActivity={(activity) => onEditActivity && onEditActivity(goal.id, task.id, activity)}
                    onDeleteActivity={(activityId) => onDeleteActivity && onDeleteActivity(goal.id, task.id, activityId)}
                    openSubmitModal={(activityId) => openSubmitModal && openSubmitModal(goal.id, task.id, activityId)}
                    canSubmitReport={canSubmitReport}
                    reportingActive={reportingActive}
                    canManageGTA={canManageGTA} // Pass permission down
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}