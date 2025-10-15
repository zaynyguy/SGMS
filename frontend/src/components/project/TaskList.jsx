import React from "react";
import { ChevronRight, ChevronDown, Edit, Trash2, Calendar, List, Plus as PlusIcon } from "lucide-react";
import ProgressBar from "../ui/ProgressBar";
import StatusBadge from "../ui/StatusBadge";
import ActivityList from "./ActivityList";
import { formatDate } from "../../uites/projectUtils";

/**
 * Props expected:
 * - goal: object (required to build composite roll)
 * - tasks: object keyed by goalId -> task array OR a plain array (we will support both)
 * - tasksLoading: boolean | object keyed by goalId
 * - toggleTask: function(goal, task)
 * - expandedTask: id of currently expanded task
 *
 * - onEditTask(goalId, task)
 * - onDeleteTask(goalId, taskId)
 * - onCreateActivity(goalId, taskId)
 * - onEditActivity(goalId, taskId, activity)
 * - onDeleteActivity(goalId, taskId, activityId)
 * - openSubmitModal(goalId, taskId, activityId)
 *
 * - activities: object keyed by taskId -> activity array
 * - activitiesLoading: object keyed by taskId -> boolean
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
  // <-- accept canManageGTA from parent
  canManageGTA,
}) {
  // tasks might be passed as an object keyed by goal.id OR as an array for this goal.
  const goalTasks =
    Array.isArray(tasks) ? tasks : (tasks && tasks[goal.id]) ? tasks[goal.id] : [];

  const loading = typeof tasksLoading === "object" ? tasksLoading[goal.id] : tasksLoading;

  if (loading) {
    return (
      <div className="p-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <List className="h-4 w-4" />
          Loading tasks…
        </div>
      </div>
    );
  }

  if (!goalTasks || goalTasks.length === 0) {
    return <div className="p-3 text-sm text-gray-500">No tasks for this goal.</div>;
  }

  return (
    <div className="space-y-3">
      {goalTasks.map((task) => {
        const taskIsExpanded = expandedTask === task.id;

        // compute composite roll: goal.rollNo.task.rollNo (if available)
        const compositeRoll = (goal?.rollNo !== undefined && goal?.rollNo !== null && task?.rollNo !== undefined && task?.rollNo !== null)
          ? `${String(goal.rollNo)}.${String(task.rollNo)}`
          : (task?.rollNo !== undefined && task?.rollNo !== null)
            ? String(task.rollNo)
            : null;

        return (
          <div key={task.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 min-w-0">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <button
                  onClick={() => toggleTask(goal, task)}
                  className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hidden sm:block"
                  aria-label="Toggle task"
                >
                  {taskIsExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between">
                    <div className="font-medium text-gray-900 dark:text-white break-words flex items-center gap-2">
                      {compositeRoll && (
                        <span className="text-sky-600 dark:text-sky-400 font-semibold">{compositeRoll}.</span>
                      )}
                      <span>{task.title}</span>
                    </div>

                    {/* Mobile inline toggle */}
                    <div className="sm:hidden flex items-center gap-2 ml-2">
                      <button
                        onClick={() => toggleTask(goal, task)}
                        className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                        aria-label="Toggle task"
                      >
                        {taskIsExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words">{task.description || "—"}</div>

                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-3">
                    <div>
                      Due: {formatDate(task.dueDate)}
                    </div>
                    <div>
                      Weight: <strong>{task.weight ?? "-"}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 whitespace-nowrap justify-between sm:justify-end">
                <StatusBadge status={task.status} />

                <div className="hidden sm:flex items-center gap-1">
                  <button
                    onClick={() => onEditTask && onEditTask(goal.id, task)}
                    className="p-2 text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    title="Edit task"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDeleteTask && onDeleteTask(goal.id, task.id)}
                    className="p-2 text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    title="Delete task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Mobile actions (compact) */}
                <div className="inline-flex sm:hidden items-center gap-1">
                  <button
                    onClick={() => onEditTask && onEditTask(goal.id, task)}
                    className="flex-shrink-0 inline-flex items-center gap-2 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-md text-sm"
                    aria-label="Edit task"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDeleteTask && onDeleteTask(goal.id, task.id)}
                    className="flex-shrink-0 inline-flex items-center gap-2 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-md text-sm text-red-600"
                    aria-label="Delete task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-600 dark:text-gray-300 pl-0 sm:pl-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{formatDate(task.dueDate)}</span>
              </div>
              <div>
                Weight: <strong>{task.weight ?? "-"}</strong>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 max-w-xs">
                  <ProgressBar progress={task.progress ?? 0} />
                </div>
              </div>
            </div>

            {/* Expanded: activities + add activity button */}
            {taskIsExpanded && (
              <div className="mt-4 pl-0 sm:pl-6">
                <div className="flex items-center justify-between mb-2">
                  <h6 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <List className="h-4 w-4 text-sky-600" /> Activities
                  </h6>

                  <div>
                    <button
                      onClick={() => onCreateActivity && onCreateActivity(goal.id, task.id)}
                      className="px-2 py-1 text-xs bg-blue-500 text-white rounded"
                    >
                      <PlusIcon className="inline-block h-3 w-3 mr-1" />  Add Activity
                    </button>
                  </div>
                </div>

                <ActivityList
                  goal={goal}
                  task={task}
                  activities={activities[task.id] || []}
                  activitiesLoading={activitiesLoading ? activitiesLoading[task.id] : false}
                  onEditActivity={(gId, tId, activity) => onEditActivity && onEditActivity(gId, tId, activity)}
                  onDeleteActivity={(gId, tId, activityId) => onDeleteActivity && onDeleteActivity(gId, tId, activityId)}
                  openSubmitModal={(gId, tId, activityId) => openSubmitModal && openSubmitModal(gId, tId, activityId)}
                  canSubmitReport={canSubmitReport}
                  reportingActive={reportingActive}
                  // <-- pass canManageGTA down so ActivityList can show edit/delete
                  canManageGTA={canManageGTA}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
