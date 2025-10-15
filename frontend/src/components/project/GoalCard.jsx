import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, Edit, Trash2, Calendar, CheckSquare, Plus as PlusIcon } from "lucide-react";
import ProgressBar from "../ui/ProgressBar";
import StatusBadge from "../ui/StatusBadge";
import TaskList from "./TaskList";
// FIXED import path (was "../../uites/...") — adjust if your project uses a different folder
import { formatDate } from "../../uites/projectUtils";

function GoalCard({
  goal,
  expandedGoal,
  toggleGoal,
  setSelectedGoal,
  canManageGTA,
  handleDeleteGoal,

  // props forwarded from parent (expect the parent to accept goalId first, taskId second)
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

  return (
    <article
      key={goal.id}
      className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-lg mb-6 overflow-hidden"
      role="region"
      aria-labelledby={`goal-${goal.id}-title`}
    >
      <div className="p-5 md:p-6">
        <div className="flex flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <button
              onClick={() => toggleGoal(goal)}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hidden sm:block"
              aria-label={t("project.actions.toggleGoal") || "Toggle"}
              title={t("project.actions.toggleGoal") || "Toggle"}
            >
              {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>

            <div className="min-w-0 flex-1" onClick={() => setSelectedGoal(goal)} style={{ cursor: "pointer" }}>
              <div className="flex items-start justify-between">
                {/* rollNo displayed before title */}
                <h3 id={`goal-${goal.id}-title`} className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white break-words flex items-center gap-3">
                  {goal?.rollNo !== undefined && goal?.rollNo !== null ? (
                    <span className="text-sky-600 dark:text-sky-400 font-semibold">{String(goal.rollNo)}.</span>
                  ) : null}
                  <span>{goal.title}</span>
                </h3>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 break-words">{goal.description || t("project.na") || "—"}</p>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-300">
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
                  onClick={() => toggleGoal(goal)}
                  className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label={isExpanded ? (t("project.actions.close") || "Close") : (t("project.actions.open") || "Open")}
                >
                  {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>
              </div>

              <div className="hidden md:flex flex-col items-end text-xs text-gray-500 dark:text-gray-300 mr-3 w-36">
                <div className="w-full">
                  <ProgressBar progress={goal.progress ?? 0} variant="goal" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canManageGTA && (
                  <>
                    <button
                      onClick={() => onEditGoal && onEditGoal(goal)}
                      className="p-2 text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md sm:block"
                      title={t("project.actions.edit") || "Edit"}
                      aria-label={(t("project.actions.edit") || "Edit") + (goal.title ? `: ${goal.title}` : "")}
                    >
                      <Edit className="h-5 w-5" />
                    </button>

                    <button
                      onClick={() => handleDeleteGoal && handleDeleteGoal(goal.id)}
                      className="p-2 text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md sm:block"
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
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="truncate">
              {formatDate(goal.startDate)} — {formatDate(goal.endDate)}
            </span>
          </div>
          <div>
            {t("project.fields.weight") || "Weight"}: <strong className="text-gray-800 dark:text-gray-100">{goal.weight ?? "-"}</strong>
          </div>
          <div className="flex items-center gap-3 md:hidden">
            <div className="flex-1 max-w-xs">
              <ProgressBar progress={goal.progress ?? 0} variant="goal" />
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-6 pl-0 sm:pl-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-sky-600" /> {t("project.sections.tasks") || "Tasks"}
              </h4>
              <div>
                {canManageGTA && (
                  <button
                    onClick={() => onCreateTask && onCreateTask(goal.id)}
                    className="px-2 py-1 bg-blue-500 text-white rounded text-xs flex items-center gap-1"
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
              // forward parent handlers directly (signatures expected: (goalId, taskId, ...) )
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
              // <-- pass canManageGTA down
              canManageGTA={canManageGTA}
            />
          </div>
        )}
      </div>
    </article>
  );
}

export default memo(GoalCard);
