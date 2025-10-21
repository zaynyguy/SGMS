import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Loader, Edit, Trash2, CheckCircle } from "lucide-react";
import StatusBadge from "../ui/StatusBadge";
import MetricsList from "../ui/MetricsList";
import { formatDate } from "../../uites/projectUtils";

export default function ActivityList({
  goal,
  task,
  activities = [],
  activitiesLoading = false,
  onDeleteActivity,
  onEditActivity,
  openSubmitModal,
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

  const isCompleted = (activity) => {
    if (!activity) return false;
    const s = String(activity.status || "").trim().toLowerCase();
    return Boolean(activity.isDone) || s === "done" || s === "completed";
  };

  return (
    <div className="space-y-2">
      {activities.map((activity) => {
        // composite roll
        const compositeRoll =
          goal?.rollNo != null &&
          task?.rollNo != null &&
          activity?.rollNo != null
            ? `${String(goal.rollNo)}.${String(task.rollNo)}.${String(activity.rollNo)}`
            : activity?.rollNo != null
            ? String(activity.rollNo)
            : null;

        // normalize metrics
        const normalizedMetrics = (() => {
          if (!activity?.targetMetric) return null;
          if (Array.isArray(activity.targetMetric)) return activity.targetMetric;
          if (typeof activity.targetMetric === "object") {
            return Object.keys(activity.targetMetric).map((k) => ({ key: k, value: String(activity.targetMetric[k]) }));
          }
          return null;
        })();

        const completed = isCompleted(activity);

        const cardBase = "p-3 rounded-md flex flex-col sm:flex-row justify-between gap-3 relative overflow-hidden border";
        const cardVariant = completed
          ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 shadow-md"
          : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700";

        return (
          <div key={activity.id} className={`${cardBase} ${cardVariant}`}>
            {/* ribbon */}
            {completed && (
              <div
                className="absolute top-3 left-0 -translate-x-4 -rotate-12 bg-green-600 text-white text-xs font-bold px-3 py-0.5 rounded shadow z-10"
                title={t("project.status.completed", "Completed")}
              >
                DONE
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 break-words">
                {compositeRoll && <span className="text-sky-600 dark:text-sky-400 font-semibold">{compositeRoll}.</span>}
                <h3 className={`font-medium text-sm m-0 ${completed ? "text-green-800" : "text-gray-900 dark:text-white"}`}>{activity.title}</h3>
              </div>

              <div className={`mt-1 text-xs ${completed ? "text-green-700" : "text-gray-500 dark:text-gray-300"}`}> {activity.description || t("project.na") || "—"}</div>

              <div className="mt-2 text-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-gray-500 dark:text-gray-300">
                <div>
                  {t("project.fields.due") || t("project.fields.dueDate") || "Due"}: {formatDate(activity.dueDate) || "—"}
                </div>
                <div>
                  {t("project.fields.weight") || "Weight"}: {activity.weight ?? "-"}
                </div>
                <div className={`${completed ? "text-green-700" : ""}`}>
                  {activity.isDone ? (t("project.status.completed") || "Completed") : (t("project.status.open") || "Open")}
                </div>
              </div>

              {normalizedMetrics && (
                <div className="mt-2">
                  <div className={`text-xs p-2 rounded ${completed ? "bg-green-100 dark:bg-green-900/10" : "bg-gray-50 dark:bg-gray-900"} text-gray-800 dark:text-gray-100`}>
                    <div className="font-medium text-xs mb-1">{t("project.labels.targetMetrics") || "Target Metrics"}</div>
                    <MetricsList metrics={normalizedMetrics} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:items-end gap-2 mt-2 sm:mt-0">
              {/* status badge */}
              {completed ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-600 text-white">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {t("project.status.completed") || "Completed"}
                </span>
              ) : (
                <StatusBadge status={activity.status} />
              )}

              <div className="flex items-center gap-2">
                {canSubmitReport && reportingActive === true && (
                  <button
                    onClick={() => openSubmitModal && openSubmitModal(goal?.id, task?.id, activity.id)}
                    className={`px-2 py-1 rounded-md text-xs text-white ${completed ? "bg-green-600 hover:bg-green-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
                    title={t("project.actions.submitReport") || "Submit Report"}
                    aria-label={(t("project.actions.submitReport") || "Submit Report") + (activity.title ? `: ${activity.title}` : "")}
                  >
                    {t("project.actions.submitReport") || "Submit Report"}
                  </button>
                )}

                {canManageGTA && (
                  <>
                    <button
                      onClick={() => onEditActivity && onEditActivity(goal?.id, task?.id, activity)}
                      className={`p-2 hidden sm:block rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 ${completed ? "text-green-700" : "text-blue-600"}`}
                      title={t("project.actions.edit") || "Edit"}
                      aria-label={(t("project.actions.edit") || "Edit") + (activity.title ? `: ${activity.title}` : "")}
                    >
                      <Edit className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => onDeleteActivity && onDeleteActivity(goal?.id, task?.id, activity.id)}
                      className={`p-2 hidden sm:block rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 ${completed ? "text-red-700" : "text-red-600"}`}
                      title={t("project.actions.delete") || "Delete"}
                      aria-label={(t("project.actions.delete") || "Delete") + (activity.title ? `: ${activity.title}` : "")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

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
