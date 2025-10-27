import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Edit, Trash2, Calendar, FileText, Check } from "lucide-react";
// Assuming 'utils' are in 'src/utils' (kept your path)
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
  const [visibleActivities, setVisibleActivities] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Animation management for activities
  useEffect(() => {
    if (activitiesLoading) {
      setVisibleActivities([]);
      return;
    }

    if (isInitialLoad && activities.length > 0) {
      // Initial load - animate all items in sequence
      const timer = setTimeout(() => {
        setVisibleActivities(activities);
        setIsInitialLoad(false);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Subsequent updates - animate new items
      setVisibleActivities(activities);
    }
  }, [activities, activitiesLoading, isInitialLoad]);

  if (activitiesLoading) {
    return (
      <div className="p-2 text-xs text-gray-500 transition-all duration-300">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
          <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          {t("project.loadingActivities") || "Loading activities…"}
        </div>
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="p-4 text-xs text-gray-500 text-center transition-all duration-300 transform hover:scale-105">
        <div className="opacity-60 transition-opacity duration-300">
          {t("project.empty.noActivities") || "No activities for this task."}
        </div>
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

  // Safely parse metric value (object, JSON string, or raw)
  const normalizeMetric = (m) => {
    if (m === null || m === undefined) return null;
    if (typeof m === "object") return m;
    if (typeof m === "string") {
      const s = m.trim();
      if (s === "") return null;
      try {
        const parsed = JSON.parse(s);
        return typeof parsed === "object" ? parsed : { value: parsed };
      } catch {
        // not JSON — return as single value under key 'value'
        return { value: s };
      }
    }
    return { value: String(m) };
  };

  // Render metric object into compact string; limit length to avoid layout break
  const renderMetricSummary = (rawMetric) => {
    const m = normalizeMetric(rawMetric);
    if (!m || (typeof m === "object" && Object.keys(m).length === 0)) return "—";

    // create key:value list (max 3 pairs)
    try {
      const pairs = Object.entries(m)
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${String(v)}`);

      let summary = pairs.join(", ");
      // if there are more keys, indicate
      if (Object.keys(m).length > 3) summary += ` …(+${Object.keys(m).length - 3})`;

      // cap length
      const MAX_LEN = 80;
      if (summary.length > MAX_LEN) {
        return summary.slice(0, MAX_LEN - 1) + "…";
      }
      return summary;
    } catch {
      // fallback
      const s = JSON.stringify(m);
      return s.length > 80 ? s.slice(0, 77) + "…" : s;
    }
  };

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes slideOutDown {
          to {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
        }
        @keyframes pulseGlow {
          0%, 100% { 
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
          }
          50% { 
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0);
          }
        }
        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .activity-enter {
          animation: slideInUp 0.4s ease-out forwards;
        }
        .activity-exit {
          animation: slideOutDown 0.3s ease-in forwards;
        }
        .status-completed {
          animation: bounceIn 0.6s ease-out;
        }
        .metric-fadein {
          animation: slideInUp 0.3s ease-out;
        }
      `}</style>

      {visibleActivities.map((activity, index) => {
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
            className="activity-enter p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02] group"
            style={{
              animationDelay: `${index * 100}ms`,
              animationFillMode: 'both',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-gray-900 dark:text-white break-words flex items-center gap-2 transition-all duration-200">
                  {compositeRoll && (
                    <span className="text-sky-600 dark:text-sky-400 font-semibold bg-sky-50 dark:bg-sky-900/20 px-2 py-1 rounded-full text-xs transition-all duration-300 transform group-hover:scale-105">
                      {compositeRoll}.
                    </span>
                  )}
                  <span className="transition-colors duration-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {activity.title}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words transition-all duration-200 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                  {activity.description || t("project.na") || "—"}
                </div>
              </div>

              <div className="flex-shrink-0 flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full transition-all duration-300 transform hover:scale-110 ${
                    isDone
                      ? "status-completed bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {getStatusText(activity.status)}
                </span>

                {canManageGTA && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                    <button
                      onClick={() => onEditActivity && onEditActivity(activity)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200 transform hover:scale-110 active:scale-95"
                      title={t("project.actions.edit") || "Edit activity"}
                    >
                      <Edit className="h-4 w-4 transition-transform duration-200 hover:rotate-12" />
                    </button>
                    <button
                      onClick={() =>
                        onDeleteActivity && onDeleteActivity(activity.id)
                      }
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 transform hover:scale-110 active:scale-95"
                      title={t("project.actions.delete") || "Delete activity"}
                    >
                      <Trash2 className="h-4 w-4 transition-transform duration-200 hover:shake" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400 transition-all duration-200 group-hover:border-gray-300 dark:group-hover:border-gray-600">
              <div className="flex items-center gap-4 min-w-0">
                <span className="flex items-center gap-1 transition-all duration-200 hover:text-gray-700 dark:hover:text-gray-300">
                  <Calendar className="h-3 w-3 transition-transform duration-200 group-hover:scale-110" />
                  {formatDate(activity.dueDate) || t("project.na")}
                </span>

                <span className="whitespace-nowrap transition-all duration-200 hover:text-gray-700 dark:hover:text-gray-300">
                  {t("project.fields.weight") || "Weight"}:{" "}
                  <strong className="transition-all duration-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {activity.weight ?? "-"}
                  </strong>
                </span>

                {/* MODIFIED: Added "Previous" metric and reordered to Previous, Target, Current */}
                <div className="flex items-center gap-3 min-w-0 metric-fadein">
                  {/* PREVIOUS */}
                  <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 min-w-0 transition-all duration-200 hover:text-gray-800 dark:hover:text-gray-200">
                    <span className="font-semibold mr-1 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded transition-colors duration-200 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30">
                      {t("project.fields.previous", "Previous")}:
                    </span>
                    <span className="truncate transition-all duration-200 group-hover:font-medium" style={{ maxWidth: 220 }}>
                      {renderMetricSummary(activity.previousMetric)}
                    </span>
                  </div>

                  {/* TARGET */}
                  <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 min-w-0 transition-all duration-200 hover:text-gray-800 dark:hover:text-gray-200">
                    <span className="font-semibold mr-1 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded transition-colors duration-200 group-hover:bg-orange-100 dark:group-hover:bg-orange-900/30">
                      {t("project.fields.target", "Target")}:
                    </span>
                    <span className="truncate transition-all duration-200 group-hover:font-medium" style={{ maxWidth: 220 }}>
                      {renderMetricSummary(activity.targetMetric)}
                    </span>
                  </div>

                  {/* CURRENT */}
                  <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 min-w-0 transition-all duration-200 hover:text-gray-800 dark:hover:text-gray-200">
                    <span className="font-semibold mr-1 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded transition-colors duration-200 group-hover:bg-green-100 dark:group-hover:bg-green-900/30">
                      {t("project.fields.current", "Current")}:
                    </span>
                    <span className="truncate transition-all duration-200 group-hover:font-medium" style={{ maxWidth: 220 }}>
                      {renderMetricSummary(activity.currentMetric)}
                    </span>
                  </div>
                </div>
              </div>

              {reportingActive && (
                <button
                  onClick={() =>
                    openSubmitModal && openSubmitModal(activity.id)
                  }
                  disabled={!canSubmitReport}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs hover:bg-indigo-600 disabled:opacity-50 transition-all duration-300 transform hover:scale-105 active:scale-95 hover:shadow-lg disabled:transform-none disabled:hover:shadow-none group/report"
                >
                  <FileText className="h-3 w-3 transition-transform duration-200 group-hover/report:scale-110" />
                  {t("project.actions.submitReport") || "Submit Report"}
                  {canSubmitReport && (
                    <div className="ml-1 h-1 w-1 bg-white rounded-full animate-pulse"></div>
                  )}
                </button>
              )}
            </div>

            {/* Progress indicator for in-progress activities */}
            {activity.status === "In Progress" && (
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: '60%',
                    animation: 'pulseGlow 2s infinite'
                  }}
                ></div>
              </div>
            )}

            {/* Completion indicator */}
            {isDone && (
              <div className="absolute top-2 right-2">
                <Check className="h-4 w-4 text-green-500 animate-bounce" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}