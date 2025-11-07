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

  // animation + render state for individual tasks
  const [animatingTasks, setAnimatingTasks] = useState({});
  const [renderContents, setRenderContents] = useState({});
  const timeoutRefs = useRef({});

  // CSS single block (deduplicated)
  const css = `
    /* animation/keyframes trimmed — keep what's needed in your project */
    @keyframes taskSlideIn { from { opacity:0; transform: translateY(15px) scale(.98);} to { opacity:1; transform: translateY(0) scale(1);} }
    @keyframes taskExpand { from { opacity:0; max-height:0; transform: translateY(-8px);} to { opacity:1; max-height:2000px; transform: translateY(0);} }
    @keyframes taskCollapse { from { opacity:1; max-height:2000px; transform: translateY(0);} to { opacity:0; max-height:0; transform: translateY(-8px);} }
    @keyframes buttonPulse { 0%{transform:scale(1);} 50%{transform:scale(1.05);} 100%{transform:scale(1);} }
    @keyframes progressGlow { 0%{box-shadow:0 0 5px rgba(59,130,246,.5);} 50%{box-shadow:0 0 15px rgba(59,130,246,.8);} 100%{box-shadow:0 0 5px rgba(59,130,246,.5);} }

    .task-list-container { animation: taskSlideIn .4s cubic-bezier(.25,.46,.45,.94) both; }
    .task-item { animation: taskSlideIn .3s cubic-bezier(.25,.46,.45,.94) both; transition: all .25s cubic-bezier(.4,0,.2,1); transform-origin:center; }
    .task-item:hover { transform: translateY(-2px) scale(1.005); box-shadow:0 6px 20px rgba(0,0,0,.1); }
    .task-btn { transition: all .2s cubic-bezier(.4,0,.2,1); }
    .task-btn:hover { transform: scale(1.1); }
    .task-icon-rotate { transition: transform .28s cubic-bezier(.68,-.55,.265,1.55); }
    .task-expanded .task-icon-rotate { transform: rotate(90deg); }
    .task-progress-glow { animation: progressGlow 2s ease-in-out infinite; }
    .task-fade-in { animation: taskSlideIn .5s ease-out both; }
    .task-content-wrapper { overflow:hidden; transition: all .3s cubic-bezier(.4,0,.2,1); }
    .task-content-expanded { max-height: 5000px; opacity: 1; transform: translateY(0); }
    .task-content-collapsed { max-height: 0; opacity: 0; transform: translateY(-8px); }
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
      <div className="p-3 task-fade-in">
        <style>{css}</style>
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
        <style>{css}</style>
        {t("project.empty.noTasks") || "No tasks for this goal."}
      </div>
    );
  }

  return (
    <div className="space-y-3 task-list-container">
      <style>{css}</style>

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
            className={`p-3 bg-gray-100 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 task-item ${
              taskIsExpanded ? "task-expanded" : ""
            }`}
            style={{
              animationDelay: `${index * 60}ms`,
              transitionDelay: `${index * 20}ms`,
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 min-w-0">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => handleToggleTask(goal, task)}
                  className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hidden sm:block task-btn task-icon-rotate"
                  aria-label={t("project.actions.toggleTask") || "Toggle task"}
                  aria-expanded={taskIsExpanded}
                >
                  {taskIsExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between">
                    <div className="font-medium text-gray-900 dark:text-white break-words flex items-center gap-2 task-pulse">
                      {compositeRoll && (
                        <span className="text-sky-600 dark:text-sky-400 font-semibold task-pulse" aria-hidden>
                          {compositeRoll}.
                        </span>
                      )}
                      <span>{task.title}</span>
                    </div>

                    <div className="sm:hidden flex items-center gap-2 ml-2">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(goal, task)}
                        className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 task-btn task-icon-rotate"
                        aria-label={t("project.actions.toggleTask") || "Toggle task"}
                        aria-expanded={taskIsExpanded}
                      >
                        {taskIsExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words task-fade-in" style={{ animationDelay: `${index * 60 + 50}ms` }}>
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
                      onClick={() => onEditTask && onEditTask(goal.id, task)}
                      className="p-2 text-blue-600 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md task-btn task-pulse"
                      title={(t("project.actions.edit") || "Edit") + (task.title ? `: ${task.title}` : "")}
                      aria-label={(t("project.actions.edit") || "Edit") + (task.title ? `: ${task.title}` : "")}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTask && onDeleteTask(goal.id, task.id)}
                      className="p-2 text-red-600 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md task-btn"
                      title={(t("project.actions.delete") || "Delete") + (task.title ? `: ${task.title}` : "")}
                      aria-label={(t("project.actions.delete") || "Delete") + (task.title ? `: ${task.title}` : "")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {canManageGTA && (
              <div className="inline-flex sm:hidden items-center gap-1 mt-2 task-fade-in" style={{ animationDelay: `${index * 60 + 100}ms` }}>
                <button
                  type="button"
                  onClick={() => onEditTask && onEditTask(goal.id, task)}
                  className="flex-shrink-0 inline-flex items-center gap-2 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-sm task-btn task-pulse"
                  title={t("project.actions.edit") || "Edit task"}
                >
                  <Edit className="h-4 w-4 dark:text-blue-400" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteTask && onDeleteTask(goal.id, task.id)}
                  className="flex-shrink-0 inline-flex items-center gap-2 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-red-600 task-btn"
                  title={t("project.actions.delete") || "Delete task"}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-600 dark:text-gray-300 pl-0 sm:pl-9 task-stagger-item" style={{ animationDelay: `${index * 60 + 150}ms` }}>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{t("project.fields.due") || "Due"}: {formatDate(task.dueDate)}</span>
              </div>
              <div>{t("project.fields.weight") || "Weight"}: <strong>{task.weight ?? "-"}</strong></div>
              <div className="flex items-center gap-2">
                <div className="flex-1 max-w-xs task-progress-glow">
                  <ProgressBar progress={task.progress ?? 0} />
                </div>
              </div>
            </div>

            <div className={`task-content-wrapper ${taskIsExpanded ? "task-content-expanded" : "task-content-collapsed"}`}>
              {shouldRenderContent && (
                <div className="mt-4 pl-0 sm:pl-9">
                  <div className="flex items-center justify-between mb-2">
                    <h6 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 task-fade-in">
                      <List className="h-4 w-4 text-sky-600 task-pulse" /> {t("project.sections.activities") || "Activities"}
                    </h6>

                    <div>
                      {canManageGTA && (
                        <button
                          type="button"
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
