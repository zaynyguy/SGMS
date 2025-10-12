// src/components/project/GoalCard.jsx
import React, { memo } from "react";
import { ChevronRight, ChevronDown, Edit, Trash2, Calendar, CheckSquare, Plus as PlusIcon } from "lucide-react";
import ProgressBar from "../ui/ProgressBar";
import StatusBadge from "../ui/StatusBadge";
import TaskList from "./TaskList";
import ActivityList from "./ActivityList";
import { formatDate } from "../../uites/projectUtils";

function GoalCard({
  goal,
  expandedGoal,
  toggleGoal,
  setSelectedGoal,
  canManageGTA,
  handleDeleteGoal,

  // NEW props (wire these from parent)
  onEditGoal,
  onCreateTask,
  onEditTask,        // (goalId, taskId, taskPayload) or (goalId, taskObj)
  onDeleteTask,
  onCreateActivity,  // (goalId, taskId, payload)
  onEditActivity,    // (goalId, taskId, activityId, payload)
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
  const isExpanded = expandedGoal === goal.id;

  return (
    <article key={goal.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-lg mb-6 overflow-hidden" role="region" aria-labelledby={`goal-${goal.id}-title`}>
      <div className="p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <button onClick={() => toggleGoal(goal)} className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hidden sm:block" aria-label="Toggle">
              {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>

            <div className="min-w-0 flex-1" onClick={() => setSelectedGoal(goal)} style={{ cursor: "pointer" }}>
              <div className="flex items-start justify-between">
                <h3 id={`goal-${goal.id}-title`} className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white break-words">{goal.title}</h3>

                <div className="md:hidden flex items-center gap-2 ml-2">
                  <button onClick={() => toggleGoal(goal)} className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">{isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}</button>
                </div>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 break-words">{goal.description || "—"}</p>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-300">
                <span className="whitespace-nowrap">Group: <strong className="text-gray-800 dark:text-gray-100">{goal.groupName || "Unassigned"}</strong></span>
                <div className="flex items-center gap-2 whitespace-nowrap"><StatusBadge status={goal.status} /></div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <div className="hidden md:flex flex-col items-end text-xs text-gray-500 dark:text-gray-300 mr-3 w-36">
              <div className="w-full"><ProgressBar progress={goal.progress ?? 0} variant="goal" /></div>
            </div>

            <div className="flex items-center gap-2">
              {canManageGTA && (
                <>
                  {/* EDIT: call parent's onEditGoal */}
                  <button
                    onClick={() => onEditGoal && onEditGoal(goal)}
                    className="p-2 text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md hidden sm:block"
                    title="Edit"
                  >
                    <Edit className="h-5 w-5" />
                  </button>

                  <button
                    onClick={() => handleDeleteGoal && handleDeleteGoal(goal.id)}
                    className="p-2 text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md hidden sm:block"
                    title="Delete"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-600 dark:text-gray-300">
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span className="truncate">{formatDate(goal.startDate)} — {formatDate(goal.endDate)}</span></div>
          <div>Weight: <strong className="text-gray-800 dark:text-gray-100">{goal.weight ?? "-"}</strong></div>
          <div className="flex items-center gap-3 md:hidden"><div className="flex-1 max-w-xs"><ProgressBar progress={goal.progress ?? 0} variant="goal" /></div></div>
        </div>

        {isExpanded && (
          <div className="mt-6 pl-0 sm:pl-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><CheckSquare className="h-4 w-4 text-sky-600" /> Tasks</h4>
              <div>
                {canManageGTA && (
                  <button
                    onClick={() => onCreateTask && onCreateTask(goal.id)}
                    className="px-2 py-1 bg-blue-500 text-white rounded text-xs flex items-center gap-1"
                  >
                    <PlusIcon className="h-3 w-3" /> Add
                  </button>
                )}
              </div>
            </div>

            <TaskList
              goal={goal}
              tasks={tasks[goal.id] || []}
              tasksLoading={tasksLoading ? tasksLoading[goal.id] : false}
              toggleTask={toggleTask}
              expandedTask={expandedTask}
              onEditTask={(task) => onEditTask && onEditTask(goal.id, task)}
              onDeleteTask={(taskId) => onDeleteTask && onDeleteTask(goal.id, taskId)}
              // pass activity-level handlers down so TaskList or ActivityList can use them
              onCreateActivity={(taskId) => onCreateActivity && onCreateActivity(goal.id, taskId)}
              onEditActivity={(taskId, activity) => onEditActivity && onEditActivity(goal.id, taskId, activity)}
              onDeleteActivity={(taskId, activityId) => onDeleteActivity && onDeleteActivity(goal.id, taskId, activityId)}
              openSubmitModal={openSubmitModal}
              canSubmitReport={canSubmitReport}
              reportingActive={reportingActive}
            />
          </div>
        )}
      </div>
    </article>
  );
}

export default memo(GoalCard);
