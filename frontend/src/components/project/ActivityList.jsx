import React from "react";
import { useTranslation } from "react-i18next";
import { Edit, Trash2, Calendar, FileText, Check } from "lucide-react";
// Assuming 'utils' are in 'src/utils'
import { formatDate } from "../../uites/projectUtils";

export default function ActivityList({
  goal,
  task,
  activities = [],
  activitiesLoading = false,

  // Handlers from parent (TaskList)
  onEditActivity,
  onDeleteActivity,
  openSubmitModal,

  canSubmitReport,
  reportingActive,
  canManageGTA,
}) {
  const { t } = useTranslation();

  if (activitiesLoading) {
    return (
      <div className="p-2 text-xs text-gray-500">
        {t("project.loadingActivities") || "Loading activities…"}
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="p-2 text-xs text-gray-500">
        {t("project.empty.noActivities") || "No activities for this task."}
      </div>
    );
  }

  // Helper to get a simple status text
  const getStatusText = (status) => {
    if (status === "Done" || status === "completed")
      return t("project.status.completed");
    if (status === "In Progress") return t("project.status.inProgress");
    return t("project.status.notStarted");
  };

  return (
    <div className="space-y-2">
      {activities.map((activity) => {
        // compute composite roll
        const compositeRoll =
          goal?.rollNo !== undefined &&
          task?.rollNo !== undefined &&
          activity?.rollNo !== undefined
            ? `${String(goal.rollNo)}.${String(task.rollNo)}.${String(
                activity.rollNo
              )}`
            : activity?.rollNo !== undefined
            ? String(activity.rollNo)
            : null;

        const isDone = activity.status === "done" || activity.isDone;

        return (
          <div
            key={activity.id}
            className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-gray-900 dark:text-white break-words flex items-center gap-2">
                  {compositeRoll && (
                    <span className="text-sky-600 dark:text-sky-400 font-semibold">
                      {compositeRoll}.
                    </span>
                  )}
                  <span>{activity.title}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words">
                  {activity.description || t("project.na") || "—"}
                </div>
              </div>

              <div className="flex-shrink-0 flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    isDone
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                  }`}
                >
                  {getStatusText(activity.status)}
                </span>

                {canManageGTA && (
                  <>
                    <button
                      onClick={() => onEditActivity && onEditActivity(activity)}
                      className="p-1 text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                      title={t("project.actions.edit") || "Edit activity"}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() =>
                        onDeleteActivity && onDeleteActivity(activity.id)
                      }
                      className="p-1 text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                      title={t("project.actions.delete") || "Delete activity"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(activity.dueDate) || t("project.na")}
                </span>
                <span>
                  {t("project.fields.weight") || "Weight"}:{" "}
                  <strong>{activity.weight ?? "-"}</strong>
                </span>
              </div>

              {reportingActive && (
                <button
                  onClick={() =>
                    openSubmitModal && openSubmitModal(activity.id)
                  }
                  disabled={!canSubmitReport}
                  className="flex items-center gap-1 px-2 py-1 bg-indigo-500 text-white rounded text-xs hover:bg-indigo-600 disabled:opacity-50"
                >
                  <FileText className="h-3 w-3" />
                  {t("project.actions.submitReport") || "Submit Report"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
