// src/components/project/ActivityList.jsx
import React from "react";
import PropTypes from "prop-types";
import { Loader } from "lucide-react";
import StatusBadge from "../ui/StatusBadge";
import MetricsList from "../ui/MetricsList";
import { formatDate } from "../../uites/projectUtils";

export default function ActivityList({
  goal,
  task,
  activities = [],
  activitiesLoading = false,
  handleDeleteActivity,
  openSubmitModal,
  canSubmitReport,
  reportingActive,
  canManageGTA,
}) {
  if (activitiesLoading) {
    return (
      <div className="p-2">
        <Loader className="h-5 w-5 animate-spin text-sky-600" />
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return <div className="p-2 text-sm text-center text-gray-500 dark:text-gray-400">No activities</div>;
  }

  return (
    <div className="space-y-2">
      {activities.map((activity) => (
        <div key={activity.id} className="p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-gray-900 dark:text-white break-words">{activity.title}</div>
            <div className="text-xs text-gray-500 dark:text-gray-300 mt-1 break-words">{activity.description || "—"}</div>

            <div className="mt-2 text-xs text-gray-500 dark:text-gray-300 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              <div>Due: {formatDate(activity.dueDate)}</div>
              <div>Weight: {activity.weight ?? "-"}</div>
              <div>{activity.isDone ? "Completed" : "Open"}</div>
            </div>

            {activity.targetMetric ? (
              <div className="mt-2">
                <div className="text-xs p-2 rounded bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
                  <div className="font-medium text-xs mb-1">Target metrics</div>
                  <MetricsList metrics={activity.targetMetric} />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col sm:items-end gap-2 mt-2 sm:mt-0">
            <StatusBadge status={activity.status} />

            <div className="flex items-center gap-2">
              {canSubmitReport && reportingActive === true && (
                <button onClick={() => openSubmitModal(goal?.id, task?.id, activity.id)} className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs">
                  Submit report
                </button>
              )}

              {canManageGTA && (
                <>
                  <button onClick={() => {/* parent should open edit modal */}} className="p-2 text-blue-600 hidden sm:block">
                    Edit
                  </button>
                  <button onClick={() => handleDeleteActivity(goal?.id, task?.id, activity.id)} className="p-2 text-red-600 hidden sm:block">
                    Delete
                  </button>

                  <div className="inline-flex sm:hidden items-center gap-1">
                    <button onClick={() => {/* parent open edit */}} className="flex-shrink-0 inline-flex items-center gap-2 px-2 py-1 border rounded-md text-sm">Edit</button>
                    <button onClick={() => handleDeleteActivity(goal?.id, task?.id, activity.id)} className="flex-shrink-0 inline-flex items-center gap-2 px-2 py-1 border text-red-600 rounded-md text-sm">Delete</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

ActivityList.propTypes = {
  goal: PropTypes.object,
  task: PropTypes.object,
  activities: PropTypes.array,
  activitiesLoading: PropTypes.bool,
  handleDeleteActivity: PropTypes.func,
  openSubmitModal: PropTypes.func,
  canSubmitReport: PropTypes.bool,
  reportingActive: PropTypes.bool,
  canManageGTA: PropTypes.bool,
};
