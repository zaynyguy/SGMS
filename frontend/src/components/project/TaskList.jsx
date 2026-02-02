import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, Edit, Trash2, Calendar, List, Plus as PlusIcon } from "lucide-react";
import ProgressBar from "../ui/ProgressBar";
import StatusBadge from "../ui/StatusBadge";
import { formatDate } from "../../uites/projectUtils"; 
import ActivityList from "./ActivityList";

function TaskList({
  goal,
  tasks = {},
  tasksLoading = false,
  toggleTask,
  expandedTask,
  onEditTask,
  onDeleteTask,
  activities = {},
  activitiesLoading = {},
  onCreateActivity,
  onEditActivity,
  onDeleteActivity,
  openSubmitModal,
  canSubmitReport,
  reportingActive,
  canManageGTA,
}) {
  const { t } = useTranslation();
  
  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);
  
  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Material Design 3 color system - light theme
  const lightColors = {
    primary: "#10B981", // Green 40
    onPrimary: "#FFFFFF",
    primaryContainer: "#BBF7D0", // Light green container
    onPrimaryContainer: "#047857", // Dark green text on container
    secondary: "#4F7AE6",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#DBE6FD",
    onSecondaryContainer: "#0B2962",
    tertiary: "#9333EA",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#E9D7FD",
    onTertiaryContainer: "#381E72",
    error: "#B3261E",
    onError: "#FFFFFF",
    errorContainer: "#F9DEDC",
    onErrorContainer: "#410E0B",
    background: "#FFFFFF",
    onBackground: "#111827",
    surface: "#FFFFFF",
    onSurface: "#111827",
    surfaceVariant: "#EEF2F7",
    onSurfaceVariant: "#444C45",
    outline: "#737B73",
    outlineVariant: "#C2C9C2",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#313033",
    inverseOnSurface: "#F4EFF4",
    inversePrimary: "#99F6E4",
    surfaceContainerLowest: "#FFFFFF",
    surfaceContainerLow: "#F8FAFB",
    surfaceContainer: "#F4F6F8",
    surfaceContainerHigh: "#EEF2F7",
    surfaceContainerHighest: "#EEF2F7",
  };

  // Material Design 3 color system - dark theme
  const darkColors = {
    primary: "#4ADE80", // Lighter green for dark mode
    onPrimary: "#002115",
    primaryContainer: "#003925",
    onPrimaryContainer: "#BBF7D0",
    secondary: "#B6C9FF",
    onSecondary: "#1E307D",
    secondaryContainer: "#354796",
    onSecondaryContainer: "#DBE6FD",
    tertiary: "#D0BCFF",
    onTertiary: "#4F308B",
    tertiaryContainer: "#6745A3",
    onTertiaryContainer: "#E9D7FD",
    error: "#FFB4AB",
    onError: "#690005",
    errorContainer: "#93000A",
    onErrorContainer: "#FFDAD6",
    background: "#1A1C19",
    onBackground: "#E1E3DD",
    surface: "#1A1C19",
    onSurface: "#E1E3DD",
    surfaceVariant: "#444C45",
    onSurfaceVariant: "#C2C9C2",
    outline: "#8C948D",
    outlineVariant: "#444C45",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#E1E3DD",
    inverseOnSurface: "#1A1C19",
    inversePrimary: "#006D5B",
    surfaceContainerLowest: "#222421",
    surfaceContainerLow: "#2D2F2C",
    surfaceContainer: "#313330",
    surfaceContainerHigh: "#3B3D3A",
    surfaceContainerHighest: "#454744",
  };

  // Select colors based on dark mode
  const m3Colors = darkMode ? darkColors : lightColors;

  // animation + render state for individual tasks
  const [animatingTasks, setAnimatingTasks] = useState({});
  const [renderContents, setRenderContents] = useState({});
  const timeoutRefs = useRef({});

  // CSS single block (deduplicated)
  const css = `
    /* animation/keyframes */
    @keyframes taskSlideIn { 
      from { 
        opacity:0; 
        transform: translateY(15px) scale(.98);
      } 
      to { 
        opacity:1; 
        transform: translateY(0) scale(1);
      } 
    }
    @keyframes taskExpand { 
      from { 
        opacity:0; 
        max-height:0; 
        transform: translateY(-8px);
      } 
      to { 
        opacity:1; 
        max-height:2000px; 
        transform: translateY(0);
      } 
    }
    @keyframes taskCollapse { 
      from { 
        opacity:1; 
        max-height:2000px; 
        transform: translateY(0);
      } 
      to { 
        opacity:0; 
        max-height:0; 
        transform: translateY(-8px);
      } 
    }
    @keyframes buttonPulse { 
      0%{transform:scale(1);} 
      50%{transform:scale(1.05);} 
      100%{transform:scale(1);} 
    }
    @keyframes progressGlow { 
      0%{box-shadow:0 0 5px rgba(59,130,246,.5);} 
      50%{box-shadow:0 0 15px rgba(59,130,246,.8);} 
      100%{box-shadow:0 0 5px rgba(59,130,246,.5);} 
    }

    .task-list-container { 
      animation: taskSlideIn .4s cubic-bezier(.25,.46,.45,.94) both; 
    }
    .task-item { 
      animation: taskSlideIn .3s cubic-bezier(.25,.46,.45,.94) both; 
      transition: all .25s cubic-bezier(.4,0,.2,1); 
      transform-origin:center; 
    }
    .task-item:hover { 
      transform: translateY(-2px) scale(1.005); 
      box-shadow:0 6px 20px rgba(0,0,0,.1); 
    }
    .task-btn { 
      transition: all .2s cubic-bezier(.4,0,.2,1); 
    }
    .task-btn:hover { 
      transform: scale(1.1); 
    }
    .task-icon-rotate { 
      transition: transform .28s cubic-bezier(.68,-.55,.265,1.55); 
    }
    .task-expanded .task-icon-rotate { 
      transform: rotate(90deg); 
    }
    .task-progress-glow { 
      animation: progressGlow 2s ease-in-out infinite; 
    }
    .task-fade-in { 
      animation: taskSlideIn .5s ease-out both; 
    }
    .task-content-wrapper { 
      overflow:hidden; 
      transition: all .3s cubic-bezier(.4,0,.2,1); 
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
  `;

  // derive tasks for this goal (accept array or keyed object)
  const goalTasks = useMemo(() => {
    if (Array.isArray(tasks)) return tasks;
    if (tasks && goal && tasks[goal.id]) return tasks[goal.id];
    return [];
  }, [tasks, goal]);

  const loading = useMemo(() => {
    if (typeof tasksLoading === "object" && goal) return Boolean(tasksLoading[goal.id]);
    return Boolean(tasksLoading);
  }, [tasksLoading, goal]);

  // cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach((t) => clearTimeout(t));
      timeoutRefs.current = {};
    };
  }, []);

  // toggle handler (memoized)
  const handleToggleTask = useCallback(
    (goalArg, task) => {
      const taskId = task.id;
      const isCurrentlyExpanded = expandedTask === taskId;

      if (!isCurrentlyExpanded) {
        // expanding — render immediately and set anim flag
        setRenderContents((p) => ({ ...p, [taskId]: true }));
        setAnimatingTasks((p) => ({ ...p, [taskId]: true }));

        // cancel any collapse timers
        if (timeoutRefs.current[taskId]) {
          clearTimeout(timeoutRefs.current[taskId]);
          delete timeoutRefs.current[taskId];
        }
      } else {
        // collapsing — animate then remove content
        setAnimatingTasks((p) => ({ ...p, [taskId]: false }));

        if (timeoutRefs.current[taskId]) clearTimeout(timeoutRefs.current[taskId]);
        timeoutRefs.current[taskId] = setTimeout(() => {
          setRenderContents((p) => ({ ...p, [taskId]: false }));
          setAnimatingTasks((p) => {
            const copy = { ...p };
            delete copy[taskId];
            return copy;
          });
          delete timeoutRefs.current[taskId];
        }, 300);
      }

      // fire parent toggle (which will load tasks/activities etc)
      toggleTask(goalArg, task);
    },
    [expandedTask, toggleTask]
  );

  if (loading) {
    return (
      <div className="p-3 task-fade-in bg-gray-50 dark:bg-gray-900">
        <style>{css}</style>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <List className="h-4 w-4" />
          {t("project.loadingTasks") || "Loading tasks…"}
        </div>
      </div>
    );
  }

  if (!goalTasks || goalTasks.length === 0) {
    return (
      <div className="p-3 text-xs text-gray-500 dark:text-gray-400 task-fade-in bg-gray-50 dark:bg-gray-900">
        <style>{css}</style>
        {t("project.empty.noTasks") || "No tasks for this goal."}
      </div>
    );
  }

  return (
    <div className="space-y-3 task-list-container px-3 rounded-xl bg-gray-100 dark:bg-gray-700">
      <style>{`
        :root {
          --primary: ${m3Colors.primary};
          --on-primary: ${m3Colors.onPrimary};
          --primary-container: ${m3Colors.primaryContainer};
          --on-primary-container: ${m3Colors.onPrimaryContainer};
          --secondary: ${m3Colors.secondary};
          --on-secondary: ${m3Colors.onSecondary};
          --secondary-container: ${m3Colors.secondaryContainer};
          --on-secondary-container: ${m3Colors.onSecondaryContainer};
          --tertiary: ${m3Colors.tertiary};
          --on-tertiary: ${m3Colors.onTertiary};
          --tertiary-container: ${m3Colors.tertiaryContainer};
          --on-tertiary-container: ${m3Colors.onTertiaryContainer};
          --error: ${m3Colors.error};
          --on-error: ${m3Colors.onError};
          --error-container: ${m3Colors.errorContainer};
          --on-error-container: ${m3Colors.onErrorContainer};
          --background: ${m3Colors.background};
          --on-background: ${m3Colors.onBackground};
          --surface: ${m3Colors.surface};
          --on-surface: ${m3Colors.onSurface};
          --surface-variant: ${m3Colors.surfaceVariant};
          --on-surface-variant: ${m3Colors.onSurfaceVariant};
          --outline: ${m3Colors.outline};
          --outline-variant: ${m3Colors.outlineVariant};
          --shadow: ${m3Colors.shadow};
          --scrim: ${m3Colors.scrim};
          --inverse-surface: ${m3Colors.inverseSurface};
          --inverse-on-surface: ${m3Colors.inverseOnSurface};
          --inverse-primary: ${m3Colors.inversePrimary};
          --surface-container-lowest: ${m3Colors.surfaceContainerLowest};
          --surface-container-low: ${m3Colors.surfaceContainerLow};
          --surface-container: ${m3Colors.surfaceContainer};
          --surface-container-high: ${m3Colors.surfaceContainerHigh};
          --surface-container-highest: ${m3Colors.surfaceContainerHighest};
        }
        
        ${css}
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
        .surface-elevation-1 {
          box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04);
          border: 1px solid var(--outline-variant);
        }
        .surface-elevation-2 {
          box-shadow: 0 2px 6px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06);
          border: 1px solid var(--outline-variant);
        }
        .surface-elevation-3 {
          box-shadow: 0 4px 12px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08);
          border: 1px solid var(--outline-variant);
        }
      `}</style>

      {goalTasks.map((task, index) => {
        const taskIsExpanded = expandedTask === task.id;
        const isAnimating = animatingTasks[task.id];
        const shouldRenderContent = Boolean(renderContents[task.id]) || taskIsExpanded;

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
              className={`p-3 bg-white dark:bg-gray-800 rounded-xl border border-[var(--outline-variant)] dark:border-gray-700 surface-elevation-1${
                taskIsExpanded ? "task-expanded" : ""
              }`}
              style={{
                animationDelay: `${index * 60}ms`,
                transitionDelay: `${index * 20}ms`,
              }}
              onClick={() => handleToggleTask(goal, task)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { handleToggleTask(goal, task); } }}
            >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 min-w-0">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleToggleTask(goal, task); }}
                  className="p-1.5 rounded-full text-[var(--on-surface-variant)] dark:text-gray-400 hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 task-btn task-icon-rotate"
                  aria-label={t("project.actions.toggleTask") || "Toggle task"}
                  aria-expanded={taskIsExpanded}
                >
                  {taskIsExpanded ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between">
                    <div className="font-semibold text-[var(--on-surface)] dark:text-white break-words flex items-center gap-2 task-pulse">
                      {compositeRoll && (
                        <span className="text-[var(--primary)] dark:text-indigo-600 font-semibold" aria-hidden>
                          {compositeRoll}.
                        </span>
                      )}
                      <span className="text-[var(--on-surface)] dark:text-white">{task.title}</span>
                    </div>

                    {/* <div className="sm:hidden flex items-center gap-2 ml-2">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(goal, task)}
                        className="p-1.5 rounded-full text-[var(--on-surface-variant)] dark:text-gray-400 hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 task-btn task-icon-rotate"
                        aria-label={t("project.actions.toggleTask") || "Toggle task"}
                        aria-expanded={taskIsExpanded}
                      >
                        {taskIsExpanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </button>
                    </div> */}
                  </div>

                  <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400 mt-1 break-words task-fade-in" style={{ animationDelay: `${index * 60 + 50}ms` }}>
                    {task.description || t("project.na") || "—"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 whitespace-nowrap justify-between sm:justify-end">
                <StatusBadge status={task.status} />

                {canManageGTA && (
                  <div className="hidden sm:flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onEditTask && onEditTask(goal.id, task); }}
                      className="p-2 text-blue-400 hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 rounded-full task-btn task-pulse"
                      title={(t("project.actions.edit") || "Edit") + (task.title ? `: ${task.title}` : "")}
                      aria-label={(t("project.actions.edit") || "Edit") + (task.title ? `: ${task.title}` : "")}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDeleteTask && onDeleteTask(goal.id, task.id); }}
                      className="p-2 text-[var(--error)] dark:text-red-400 hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 rounded-full task-btn"
                      title={(t("project.actions.delete") || "Delete") + (task.title ? `: ${task.title}` : "")}
                      aria-label={(t("project.actions.delete") || "Delete") + (task.title ? `: ${task.title}` : "")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 pl-0 sm:pl-9 task-stagger-item" style={{ animationDelay: `${index * 60 + 150}ms` }}>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="truncate">{t("project.fields.due") || "Due"}: {formatDate(task.dueDate)}</span>
              </div>
              <div>{t("project.fields.weight") || "Weight"}: <strong className="text-[var(--on-surface)] dark:text-white">{task.weight ?? "-"}</strong></div>
              {canManageGTA && (
                <div className="inline-flex sm:hidden items-center gap-1 mt-2 task-fade-in" style={{ animationDelay: `${index * 60 + 100}ms` }}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEditTask && onEditTask(goal.id, task); }}
                    className="flex-shrink-0 inline-flex items-center gap-2 px-2 py-1 border border-[var(--outline-variant)] dark:border-gray-600 rounded-md text-sm dark:text-white task-btn task-pulse"
                    title={t("project.actions.edit") || "Edit task"}
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDeleteTask && onDeleteTask(goal.id, task.id); }}
                    className="flex-shrink-0 inline-flex items-center gap-2 px-2 py-1 border border-[var(--outline-variant)] dark:border-gray-600 rounded-md text-sm text-[var(--error)] dark:text-red-400 task-btn"
                    title={t("project.actions.delete") || "Delete task"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1 max-w-xs">
                  <ProgressBar progress={task.progress ?? 0} variant="task" />
                </div>
              </div>
            </div>

            <div className={`task-content-wrapper ${taskIsExpanded ? "task-content-expanded" : "task-content-collapsed"}`}>
              {shouldRenderContent && (
                <div className="mt-4 pl-0 sm:pl-9">
                  <div className="flex items-center justify-between pt-3 px-3 border-t border-l border-r border-[var(--outline-variant)] dark:border-gray-700 rounded-t-xl bg-gray-100 dark:bg-gray-700">
                    <h6 className="text-sm font-semibold text-[var(--on-surface)] dark:text-white flex items-center gap-2 task-fade-in">
                      <List className="h-4 w-4 text-[var(--primary)] dark:text-indigo-600" /> {t("project.sections.activities") || "Activities"}
                    </h6>

                    <div>
                      {canManageGTA && (
                        <button
                          type="button"
                          onClick={() => onCreateActivity && onCreateActivity(goal.id, task.id)}
                          className="px-2 py-1 text-xs bg-green-800 dark:bg-indigo-700 text-[var(--on-primary)] dark:text-white rounded-full task- task- hover:bg-[var(--primary-container)] dark:hover:bg-indigo-600 transition-all duration-300"
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
                    onEditActivity={(activity) => onEditActivity && onEditActivity(goal.id, task.id, activity)}
                    onDeleteActivity={(activityId) => onDeleteActivity && onDeleteActivity(goal.id, task.id, activityId)}
                    openSubmitModal={(activityId) => openSubmitModal && openSubmitModal(goal.id, task.id, activityId)}
                    canSubmitReport={canSubmitReport}
                    reportingActive={reportingActive}
                    canManageGTA={canManageGTA}
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

TaskList.propTypes = {
  goal: PropTypes.object.isRequired,
  tasks: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
  tasksLoading: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
  toggleTask: PropTypes.func.isRequired,
  expandedTask: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onEditTask: PropTypes.func,
  onDeleteTask: PropTypes.func,
  activities: PropTypes.object,
  activitiesLoading: PropTypes.object,
  onCreateActivity: PropTypes.func,
  onEditActivity: PropTypes.func,
  onDeleteActivity: PropTypes.func,
  openSubmitModal: PropTypes.func,
  canSubmitReport: PropTypes.bool,
  reportingActive: PropTypes.bool,
  canManageGTA: PropTypes.bool,
};

TaskList.defaultProps = {
  tasks: {},
  tasksLoading: false,
  expandedTask: null,
  activities: {},
  activitiesLoading: {},
  canSubmitReport: false,
  reportingActive: false,
  canManageGTA: false,
};

export default React.memo(TaskList);