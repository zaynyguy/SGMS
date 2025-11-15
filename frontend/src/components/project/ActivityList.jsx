import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import {
  Edit,
  Trash2,
  Calendar,
  FileText,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { formatDate } from "../../uites/projectUtils"; // <-- fixed path from user file

// ----------------------------------------------------------------
// MODIFICATION: Created a new collapsible ActivityCard component
// (typography reduced: text-sm -> text-xs, text-xs -> text-[11px])
// ----------------------------------------------------------------
function ActivityCard({
  activity,
  goal,
  task,
  onEditActivity,
  onDeleteActivity,
  openSubmitModal,
  canSubmitReport,
  reportingActive,
  canManageGTA,
  t,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t: translate } = useTranslation(); // Use hook directly if t prop not passed

  // Use the passed 't' prop, or fallback to the hook
  const tr = t || translate;

  const compositeRoll =
    goal?.rollNo != null && task?.rollNo != null && activity?.rollNo != null
      ? `${String(goal.rollNo)}.${String(task.rollNo)}.${String(
          activity.rollNo
        )}`
      : activity?.rollNo != null
      ? String(activity.rollNo)
      : null;

  const isDone =
    (activity.status || "").toString().toLowerCase() === "done" ||
    activity.isDone;

  const getStatusText = (status) => {
    const st = ((status || "") + "").toString().toLowerCase();
    if (st === "done" || st === "completed")
      return tr("project.status.completed") || "Completed";
    if (st.includes("progress") || st === "in progress")
      return tr("project.status.inProgress") || "In Progress";
    return tr("project.status.notStarted") || "Not started";
  };

  const normalizeMetric = (m) => {
    if (m == null) return null;
    if (typeof m === "object") return m;
    if (typeof m === "string") {
      const s = m.trim();
      if (!s) return null;
      try {
        const parsed = JSON.parse(s);
        return typeof parsed === "object" ? parsed : { value: parsed };
      } catch {
        return { value: s };
      }
    }
    return { value: String(m) };
  };

  const renderMetricSummary = (rawMetric, label) => {
    const m = normalizeMetric(rawMetric);
    if (!m || (typeof m === "object" && Object.keys(m).length === 0)) {
      return (
        <div className="text-[11px]">
          <span className="font-semibold mr-1 bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded">
            {label}:
          </span>
          <span className="truncate text-gray-400 dark:text-gray-500">—</span>
        </div>
      );
    }
    try {
      const pairs = Object.entries(m)
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${String(v)}`);
      let summary = pairs.join(", ");
      if (Object.keys(m).length > 3)
        summary += ` …(+${Object.keys(m).length - 3})`;

      return (
        <div className="text-[11px]">
          <span
            className={`font-semibold mr-1 px-1.5 py-0.5 rounded ${
              label === tr("project.fields.previous", "Previous")
                ? "bg-purple-50 dark:bg-purple-900/20"
                : label === tr("project.fields.target", "Target")
                ? "bg-orange-50 dark:bg-orange-900/20"
                : "bg-green-50 dark:bg-green-900/20"
            }`}
          >
            {label}:
          </span>
          <span className="truncate">{summary}</span>
        </div>
      );
    } catch {
      const s = JSON.stringify(m);
      return (
        <div className="text-[11px]">
          <span className="font-semibold mr-1 bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded">
            {label}:
          </span>
          <span className="truncate">
            {s.length > 80 ? s.slice(0, 77) + "…" : s}
          </span>
        </div>
      );
    }
  };

  const renderQuarterlyGoals = (goals) => {
    const qGoals = goals || {};
    const hasGoals = ["q1", "q2", "q3", "q4"].some(
      (q) => qGoals[q] != null && qGoals[q] !== ""
    );

    if (!hasGoals) {
      return (
        <div className="text-[11px] text-gray-400 dark:text-gray-500 italic">
          {tr("project.empty.noQuarterlyGoals", "No quarterly goals defined.")}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {["q1", "q2", "q3", "q4"].map((q) => (
          <div key={q} className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg">
            <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">
              {q}
            </div>
            <div className="text-xs font-medium text-gray-900 dark:text-white mt-0.5">
              {qGoals[q] ?? (
                <span className="text-gray-400 dark:text-gray-500">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 group">
      {/* Activity Header Row */}
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setIsExpanded((e) => !e)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 flex-shrink-0"
            title={
              isExpanded
                ? tr("project.actions.collapse", "Collapse")
                : tr("project.actions.expand", "Expand")
            }
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="font-medium text-xs text-gray-900 dark:text-white break-words flex items-center gap-2">
              {compositeRoll && (
                <span className="text-sky-600 dark:text-sky-400 font-semibold bg-sky-50 dark:bg-sky-900/20 px-2 py-1 rounded-full text-[11px]">
                  {compositeRoll}.
                </span>
              )}
              <span>{activity.title}</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span
                className={`text-[11px] font-medium px-2 py-1 rounded-full transition-all duration-300 transform ${
                  isDone
                    ? "status-completed bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                }`}
              >
                {getStatusText(activity.status)}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                <Calendar className="h-3 w-3" />
                {formatDate(activity.dueDate) || tr("project.na")}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {tr("project.fields.weight") || "Weight"}:{" "}
                <strong>{activity.weight ?? "-"}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-1">
          {canManageGTA && (
            <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
              <button
                type="button"
                onClick={() => onEditActivity && onEditActivity(activity)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
                title={tr("project.actions.edit") || "Edit activity"}
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  onDeleteActivity && onDeleteActivity(activity.id)
                }
                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                title={tr("project.actions.delete") || "Delete activity"}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
          {reportingActive && (
            <button
              type="button"
              onClick={() => openSubmitModal && openSubmitModal(activity.id)}
              disabled={!canSubmitReport}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-[11px] hover:bg-indigo-600 disabled:opacity-50 transition-all duration-300"
            >
              <FileText className="h-3 w-3" />
              <span className="hidden sm:inline">
                {tr("project.actions.submitReport") || "Submit Report"}
              </span>
              {canSubmitReport && (
                <div className="ml-1 h-1 w-1 bg-white rounded-full animate-pulse" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Content */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? "max-h-[1000px]" : "max-h-0"
        }`}
      >
        <div className="px-3 pb-3 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-3">
          {/* Description */}
          <div>
            <h4 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              {tr("project.fields.description", "Description")}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-300 break-words">
              {activity.description || (
                <span className="italic text-gray-400 dark:text-gray-500">
                  {tr(
                    "project.empty.noDescription",
                    "No description provided."
                  )}
                </span>
              )}
            </p>
          </div>

          {/* Metrics Grid */}
          <div>
            <h4 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {tr("project.fields.metrics", "Metrics")}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 p-4 md:p-6 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700">
              {renderMetricSummary(
                activity.previousMetric,
                tr("project.fields.previous", "Previous")
              )}
              {renderMetricSummary(
                activity.targetMetric,
                tr("project.fields.target", "Target")
              )}
              {renderMetricSummary(
                activity.currentMetric,
                tr("project.fields.current", "Current")
              )}
            </div>
          </div>

          {/* Quarterly Goals */}
          <div>
            <h4 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {tr("project.fields.quarterlyGoals", "Quarterly Goals")}
            </h4>
            {renderQuarterlyGoals(activity.quarterlyGoals)}
          </div>
        </div>
      </div>

      {isDone && (
        <div className="absolute top-2 right-2 p-1 bg-white dark:bg-gray-800 rounded-full">
          <Check className="h-4 w-4 text-green-500" />
        </div>
      )}
    </div>
  );
}
// ----------------------------------------------------------------
// MODIFICATION END
// ----------------------------------------------------------------

function ActivityList({
  goal,
  task,
  activities = [],
  activitiesLoading = false,
  onEditActivity,
  onDeleteActivity,
  openSubmitModal,
  canSubmitReport = false,
  reportingActive = false,
  canManageGTA = false,
}) {
  const { t } = useTranslation();
  const [visibleActivities, setVisibleActivities] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const loadTimerRef = useRef(null);

  // keep timers cleaned up
  useEffect(() => {
    return () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    };
  }, []);

  // Manage visibleActivities: initial staggered entrance, then immediate updates
  useEffect(() => {
    if (activitiesLoading) {
      setVisibleActivities([]);
      return;
    }

    if (isInitialLoad && activities.length > 0) {
      // small delay so entrance animations feel natural
      loadTimerRef.current = setTimeout(() => {
        setVisibleActivities(activities);
        setIsInitialLoad(false);
        loadTimerRef.current = null;
      }, 100);
      return () => {
        if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
      };
    }

    // subsequent updates: show immediately (no stagger)
    setVisibleActivities(activities);
  }, [activities, activitiesLoading, isInitialLoad]);

  if (activitiesLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="p-2 text-[11px] text-gray-500 transition-all duration-300"
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
          <div
            className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"
            style={{ animationDelay: "0.2s" }}
          />
          <div
            className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"
            style={{ animationDelay: "0.4s" }}
          />
          <span>{t("project.loadingActivities") || "Loading activities…"}</span>
        </div>
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="p-4 text-[11px] text-gray-500 text-center transition-all duration-300 transform hover:scale-105">
        <div className="opacity-60 transition-opacity duration-300">
          {t("project.empty.noActivities") || "No activities for this task."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes slideInUp { from { opacity:0; transform: translateY(20px) scale(.95); } to { opacity:1; transform: translateY(0) scale(1);} }
        @keyframes slideOutDown { to { opacity:0; transform: translateY(20px) scale(.95); } }
        @keyframes pulseGlow { 0%,100% { box-shadow:0 0 0 0 rgba(59,130,246,.4) } 50% { box-shadow:0 0 0 4px rgba(59,130,246,0) } }
        @keyframes bounceIn { 0%{opacity:0;transform:scale(.3);}50%{opacity:1;transform:scale(1.05);}70%{transform:scale(.9);}100%{transform:scale(1);} }
        .activity-enter { animation: slideInUp .4s ease-out both; }
        .activity-exit { animation: slideOutDown .3s ease-in both; }
        .status-completed { animation: bounceIn .6s ease-out both; }
      `}</style>

      {/* ---------------------------------------------------------------- */}
      {/* MODIFICATION: Map over activities and render ActivityCard */}
      {/* ---------------------------------------------------------------- */}
      {visibleActivities.map((activity, index) => (
        <div
          key={activity.id}
          className="activity-enter"
          style={{
            animationDelay: `${index * 80}ms`,
            animationFillMode: "both",
          }}
        >
          <ActivityCard
            activity={activity}
            goal={goal}
            task={task}
            onEditActivity={onEditActivity}
            onDeleteActivity={onDeleteActivity}
            openSubmitModal={openSubmitModal}
            canSubmitReport={canSubmitReport}
            reportingActive={reportingActive}
            canManageGTA={canManageGTA}
            t={t}
          />
        </div>
      ))}
      {/* ---------------------------------------------------------------- */}
      {/* MODIFICATION END */}
      {/* ---------------------------------------------------------------- */}
    </div>
  );
}

ActivityList.propTypes = {
  goal: PropTypes.object,
  task: PropTypes.object,
  activities: PropTypes.array,
  activitiesLoading: PropTypes.bool,
  onEditActivity: PropTypes.func,
  onDeleteActivity: PropTypes.func,
  openSubmitModal: PropTypes.func,
  canSubmitReport: PropTypes.bool,
  reportingActive: PropTypes.bool,
  canManageGTA: PropTypes.bool,
};

ActivityList.defaultProps = {
  activities: [],
  activitiesLoading: false,
  canSubmitReport: false,
  reportingActive: false,
  canManageGTA: false,
};

export default React.memo(ActivityList);
