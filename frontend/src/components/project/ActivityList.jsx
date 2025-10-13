import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Loader, Edit, Trash2 } from "lucide-react";
import StatusBadge from "../ui/StatusBadge";
import MetricsList from "../ui/MetricsList";
import { formatDate } from "../../uites/projectUtils";

export default function ActivityList({
  goal,
  task,
  activities = [],
  activitiesLoading = false,
  onDeleteActivity, // signature: (goalId, taskId, activityId)
  onEditActivity, // signature: (goalId, taskId, activity)
  openSubmitModal, // signature: (goalId, taskId, activityId)
  canSubmitReport,
  reportingActive,
  canManageGTA,
}) {
  const { t } = useTranslation();

  if (activitiesLoading) {
    return (
      <div className="p-2">
        <Loader className="h-5 w-5 animate-spin text-sky-600" />
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    const emptyText = t("project.empty.noActivities") || t("project.noActivities") || t("project.na") || "No activities";
    return <div className="p-2 text-sm text-center text-gray-500 dark:text-gray-400">{emptyText}</div>;
  }

  return (
    <div className="space-y-2">
      {activities.map((activity) => {
        // compute composite roll: goal.rollNo.task.rollNo.activity.rollNo (if available)
        const compositeRoll =
          goal?.rollNo !== undefined &&
          goal?.rollNo !== null &&
          task?.rollNo !== undefined &&
          task?.rollNo !== null &&
          activity?.rollNo !== undefined &&
          activity?.rollNo !== null
            ? `${String(goal.rollNo)}.${String(task.rollNo)}.${String(activity.rollNo)}`
            : activity?.rollNo !== undefined && activity?.rollNo !== null
            ? String(activity.rollNo)
            : null;

        // Accept targetMetric as either an object map {k: v} or an array [{key,value}]
        const normalizedMetrics = (() => {
          if (!activity?.targetMetric) return null;
          if (Array.isArray(activity.targetMetric)) {
            return activity.targetMetric;
          }
          if (typeof activity.targetMetric === "object") {
            return Object.keys(activity.targetMetric).map((k) => ({ key: k, value: String(activity.targetMetric[k]) }));
          }
          return null;
        })();

        return (
          <div
            key={activity.id}
            className="p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium text-gray-900 dark:text-white break-words flex items-center gap-2">
                {compositeRoll && <span className="text-sky-600 dark:text-sky-400 font-semibold">{compositeRoll}.</span>}
                <span>{activity.title}</span>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-300 mt-1 break-words">
                {activity.description || t("project.na") || "—"}
              </div>

              <div className="mt-2 text-xs text-gray-500 dark:text-gray-300 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                <div>
                  {t("project.fields.due") || t("project.fields.dueDate") || "Due"}: {formatDate(activity.dueDate)}
                </div>
                <div>
                  {t("project.fields.weight") || "Weight"}: {activity.weight ?? "-"}
                </div>
                <div>{activity.isDone ? t("project.status.completed") || "Completed" : t("project.status.open") || "Open"}</div>
              </div>

              {normalizedMetrics ? (
                <div className="mt-2">
                  <div className="text-xs p-2 rounded bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
                    <div className="font-medium text-xs mb-1">{t("project.labels.targetMetrics") || "Target Metrics"}</div>
                    <MetricsList metrics={normalizedMetrics} />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col sm:items-end gap-2 mt-2 sm:mt-0">
              <StatusBadge status={activity.status} />

              <div className="flex items-center gap-2">
                {canSubmitReport && reportingActive === true && (
                  <button
                    onClick={() => openSubmitModal && openSubmitModal(goal?.id, task?.id, activity.id)}
                    className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs"
                    title={t("project.actions.submitReport") || "Submit Report"}
                    aria-label={(t("project.actions.submitReport") || "Submit Report") + (activity.title ? `: ${activity.title}` : "")}
                  >
                    {t("project.actions.submitReport") || "Submit Report"}
                  </button>
                )}

                {canManageGTA && (
                  <>
                    {/* Icon buttons for larger screens (matches Goal/Task sections) */}
                    <button
                      onClick={() => onEditActivity && onEditActivity(goal?.id, task?.id, activity)}
                      className="p-2 text-blue-600 hidden sm:block rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                      title={t("project.actions.edit") || "Edit"}
                      aria-label={(t("project.actions.edit") || "Edit") + (activity.title ? `: ${activity.title}` : "")}
                    >
                      <Edit className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => onDeleteActivity && onDeleteActivity(goal?.id, task?.id, activity.id)}
                      className="p-2 text-red-600 hidden sm:block rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                      title={t("project.actions.delete") || "Delete"}
                      aria-label={(t("project.actions.delete") || "Delete") + (activity.title ? `: ${activity.title}` : "")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    {/* Compact mobile buttons (text + icon) */}
                    <div className="inline-flex sm:hidden items-center gap-1">
                      <button
                        onClick={() => onEditActivity && onEditActivity(goal?.id, task?.id, activity)}
                        className="flex-shrink-0 inline-flex items-center gap-2 px-2 py-1 border rounded-md text-sm"
                        title={t("project.actions.edit") || "Edit"}
                        aria-label={(t("project.actions.edit") || "Edit") + (activity.title ? `: ${activity.title}` : "")}
                      >
                        <Edit className="h-4 w-4" /> {t("project.actions.edit") || "Edit"}
                      </button>
                      <button
                        onClick={() => onDeleteActivity && onDeleteActivity(goal?.id, task?.id, activity.id)}
                        className="flex-shrink-0 inline-flex items-center gap-2 px-2 py-1 border text-red-600 rounded-md text-sm"
                        title={t("project.actions.delete") || "Delete"}
                        aria-label={(t("project.actions.delete") || "Delete") + (activity.title ? `: ${activity.title}` : "")}
                      >
                        <Trash2 className="h-4 w-4" /> {t("project.actions.delete") || "Delete"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

ActivityList.propTypes = {
  goal: PropTypes.object,
  task: PropTypes.object,
  activities: PropTypes.array,
  activitiesLoading: PropTypes.bool,
  onDeleteActivity: PropTypes.func,
  onEditActivity: PropTypes.func,
  openSubmitModal: PropTypes.func,
  canSubmitReport: PropTypes.bool,
  reportingActive: PropTypes.bool,
  canManageGTA: PropTypes.bool,
};
