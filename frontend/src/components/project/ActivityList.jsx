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
import { formatDate } from "../../uites/projectUtils";

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
  const { t: translate } = useTranslation();

  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);
  
  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Material Design 3 color system - light theme
  const lightColors = {
    primary: "#10B981", // Green 40
    onPrimary: "#FFFFFF",
    primaryContainer: "#BBF7D0", // Light green container
    onPrimaryContainer: "#047857", // Dark green text on container
    secondary: "#4F7AE6",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#DBE6FD",
    onSecondaryContainer: "#0B2962",
    tertiary: "#9333EA",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#E9D7FD",
    onTertiaryContainer: "#381E72",
    error: "#B3261E",
    onError: "#FFFFFF",
    errorContainer: "#F9DEDC",
    onErrorContainer: "#410E0B",
    background: "#FFFFFF",
    onBackground: "#111827",
    surface: "#FFFFFF",
    onSurface: "#111827",
    surfaceVariant: "#EEF2F7",
    onSurfaceVariant: "#444C45",
    outline: "#737B73",
    outlineVariant: "#C2C9C2",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#313033",
    inverseOnSurface: "#F4EFF4",
    inversePrimary: "#99F6E4",
    surfaceContainerLowest: "#FFFFFF",
    surfaceContainerLow: "#F8FAFB",
    surfaceContainer: "#F4F6F8",
    surfaceContainerHigh: "#EEF2F7",
    surfaceContainerHighest: "#EEF2F7",
  };

  // Material Design 3 color system - dark theme
  const darkColors = {
    primary: "#4ADE80", // Lighter green for dark mode
    onPrimary: "#002115",
    primaryContainer: "#003925",
    onPrimaryContainer: "#BBF7D0",
    secondary: "#B6C9FF",
    onSecondary: "#1E307D",
    secondaryContainer: "#354796",
    onSecondaryContainer: "#DBE6FD",
    tertiary: "#D0BCFF",
    onTertiary: "#4F308B",
    tertiaryContainer: "#6745A3",
    onTertiaryContainer: "#E9D7FD",
    error: "#FFB4AB",
    onError: "#690005",
    errorContainer: "#93000A",
    onErrorContainer: "#FFDAD6",
    background: "#1A1C19",
    onBackground: "#E1E3DD",
    surface: "#1A1C19",
    onSurface: "#E1E3DD",
    surfaceVariant: "#444C45",
    onSurfaceVariant: "#C2C9C2",
    outline: "#8C948D",
    outlineVariant: "#444C45",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#E1E3DD",
    inverseOnSurface: "#1A1C19",
    inversePrimary: "#006D5B",
    surfaceContainerLowest: "#222421",
    surfaceContainerLow: "#2D2F2C",
    surfaceContainer: "#313330",
    surfaceContainerHigh: "#3B3D3A",
    surfaceContainerHighest: "#454744",
  };

  // Select colors based on dark mode
  const m3Colors = darkMode ? darkColors : lightColors;

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
          <span className="font-semibold mr-1 bg-[var(--surface-container)] dark:bg-gray-700 px-1.5 py-0.5 rounded text-[var(--on-surface)] dark:text-white">
            {label}:
          </span>
          <span className="truncate text-[var(--on-surface-variant)] dark:text-gray-400">—</span>
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
            className={`font-semibold mr-1 px-1.5 py-0.5 rounded text-white ${
              label === tr("project.fields.previous", "Previous")
                ? "bg-[var(--tertiary-container)] dark:bg-purple-900 text-[var(--on-tertiary-container)] dark:text-purple-200"
                : label === tr("project.fields.target", "Target")
                ? "bg-[var(--primary-container)] dark:bg-green-900 text-[var(--on-primary-container)] dark:text-green-200"
                : "bg-[var(--secondary-container)] dark:bg-blue-900 text-[var(--on-secondary-container)] dark:text-blue-200"
            }`}
          >
            {label}:
          </span>
          <span className="truncate text-[var(--on-surface)] dark:text-white">{summary}</span>
        </div>
      );
    } catch {
      const s = JSON.stringify(m);
      return (
        <div className="text-[11px]">
          <span className="font-semibold mr-1 bg-[var(--surface-container)] dark:bg-gray-700 px-1.5 py-0.5 rounded text-[var(--on-surface)] dark:text-white">
            {label}:
          </span>
          <span className="truncate text-[var(--on-surface)] dark:text-white">
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
        <div className="text-[11px] text-[var(--on-surface-variant)] dark:text-gray-400 italic">
          {tr("project.empty.noQuarterlyGoals", "No quarterly goals defined.")}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {["q1", "q2", "q3", "q4"].map((q) => (
          <div key={q} className="bg-[var(--surface-container)] dark:bg-gray-700 p-2 rounded-lg">
            <div className="text-[11px] font-semibold text-[var(--on-surface-variant)] dark:text-gray-400 uppercase">
              {q}
            </div>
            <div className="text-xs font-medium text-[var(--on-surface)] dark:text-white mt-0.5">
              {qGoals[q] ?? (
                <span className="text-[var(--on-surface-variant)] dark:text-gray-400">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className={`relative bg-[var(--surface-container-lowest)] dark:bg-gray-800 rounded-xl border border-[var(--outline-variant)] dark:border-gray-700 surface-elevation-1 transition-all duration-300 transform hover:-translate-y-0.5 group ${isExpanded ? 'shadow-md' : ''}`}
      onClick={(e) => { e.stopPropagation(); setIsExpanded((v) => !v); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setIsExpanded((v) => !v); } }}
    >
      {/* Activity Header Row */}
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsExpanded((v) => !v); }}
            className="p-1.5 text-[var(--on-surface-variant)] dark:text-gray-400 hover:text-[var(--on-surface)] dark:hover:text-white rounded-full hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 transition-all duration-200 flex-shrink-0"
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
                      <div className="
            font-medium text-sm text-[var(--on-surface)] dark:text-white break-words
            flex flex-col sm:flex-row sm:items-center gap-2
          ">
            {compositeRoll && (
              <span className="
                text-[var(--primary)] dark:text-indigo-900
                font-semibold bg-[var(--primary-container)] dark:bg-indigo-400
                px-2 py-1 rounded-full text-xs
                w-fit
              ">
                {compositeRoll}.
              </span>
            )}
            <span>{activity.title}</span>
          </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full transition-all duration-300 transform ${
                  isDone
                    ? "status-completed bg-[var(--primary-container)] dark:bg-green-900 text-[var(--on-primary-container)] dark:text-green-200"
                    : "bg-[var(--surface-container)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white"
                }`}
              >
                {getStatusText(activity.status)}
              </span>
              <span className="flex items-center gap-1 text-xs text-[var(--on-surface-variant)] dark:text-gray-400">
                <Calendar className="h-3 w-3" />
                {formatDate(activity.dueDate) || tr("project.na")}
              </span>
              <span className="text-xs text-[var(--on-surface-variant)] dark:text-gray-400 whitespace-nowrap">
                {tr("project.fields.weight") || "Weight"}:{" "}
                <strong className="text-[var(--on-surface)] dark:text-white">{activity.weight ?? "-"}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-1">
          {canManageGTA && (
            <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEditActivity && onEditActivity(activity); }}
                className="p-1.5 text-blue-600 hover:bg-blue-600/30 rounded-full transition-all duration-200"
                title={tr("project.actions.edit") || "Edit activity"}
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteActivity && onDeleteActivity(activity.id); }}
                className="p-1.5 text-[var(--error)] dark:text-red-400 hover:bg-[var(--error-container)]/[0.1] dark:hover:bg-red-900/[0.3] rounded-full transition-all duration-200"
                title={tr("project.actions.delete") || "Delete activity"}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
          {reportingActive && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openSubmitModal && openSubmitModal(activity.id); }}
              disabled={!canSubmitReport}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-[var(--on-primary)] dark:text-white rounded-full text-xs hover:bg-[var(--primary-container)] dark:hover:bg-green-600 disabled:opacity-50 transition-all duration-300"
            >
              <FileText className="h-3 w-3" />
              <span className="hidden sm:inline">
                {tr("project.actions.submitReport") || "Submit Report"}
              </span>
              {canSubmitReport && (
                <div className="ml-1 h-1 w-1 bg-[var(--on-primary)] dark:bg-white rounded-full animate-pulse" />
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
        <div className="px-3 pb-3 pt-2 border-t border-[var(--outline-variant)] dark:border-gray-700 space-y-3">
          {/* Description */}
          <div>
            <h4 className="text-xs font-semibold text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wide mb-1">
              {tr("project.fields.description", "Description")}
            </h4>
            <p className="text-sm text-[var(--on-surface)] dark:text-white break-words">
              {activity.description || (
                <span className="italic text-[var(--on-surface-variant)] dark:text-gray-400">
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
            <h4 className="text-xs font-semibold text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wide mb-2">
              {tr("project.fields.metrics", "Metrics")}
            </h4>
            <div className="flex items-center justify-between mb-2">
              <div />
              <div className="text-xs text-[var(--on-surface-variant)] dark:text-gray-400">
                {tr("project.labels.metricType", "Metric Type")}: 
                <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-[var(--surface-container)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white text-xs font-medium">
                  {activity.metricType || activity.metric_type || 'Plus'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 p-4 bg-[var(--surface-container)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white rounded-xl border border-[var(--outline-variant)] dark:border-gray-600">
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
            <h4 className="text-xs font-semibold text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wide mb-2">
              {tr("project.fields.quarterlyGoals", "Quarterly Goals")}
            </h4>
            {renderQuarterlyGoals(activity.quarterlyGoals)}
          </div>
        </div>
      </div>

      {isDone && (
        <div className="absolute top-2 right-2 p-1 bg-[var(--surface-container-lowest)] dark:bg-gray-800 rounded-full">
          <Check className="h-4 w-4 text-[var(--primary)] dark:text-green-400" />
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
  
  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);
  
  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Material Design 3 color system - light theme
  const lightColors = {
    primary: "#10B981", // Green 40
    onPrimary: "#FFFFFF",
    primaryContainer: "#BBF7D0", // Light green container
    onPrimaryContainer: "#047857", // Dark green text on container
    secondary: "#4F7AE6",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#DBE6FD",
    onSecondaryContainer: "#0B2962",
    tertiary: "#9333EA",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#E9D7FD",
    onTertiaryContainer: "#381E72",
    error: "#B3261E",
    onError: "#FFFFFF",
    errorContainer: "#F9DEDC",
    onErrorContainer: "#410E0B",
    background: "#FFFFFF",
    onBackground: "#111827",
    surface: "#FFFFFF",
    onSurface: "#111827",
    surfaceVariant: "#EEF2F7",
    onSurfaceVariant: "#444C45",
    outline: "#737B73",
    outlineVariant: "#C2C9C2",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#313033",
    inverseOnSurface: "#F4EFF4",
    inversePrimary: "#99F6E4",
    surfaceContainerLowest: "#FFFFFF",
    surfaceContainerLow: "#F8FAFB",
    surfaceContainer: "#F4F6F8",
    surfaceContainerHigh: "#EEF2F7",
    surfaceContainerHighest: "#EEF2F7",
  };

  // Material Design 3 color system - dark theme
  const darkColors = {
    primary: "#4ADE80", // Lighter green for dark mode
    onPrimary: "#002115",
    primaryContainer: "#003925",
    onPrimaryContainer: "#BBF7D0",
    secondary: "#B6C9FF",
    onSecondary: "#1E307D",
    secondaryContainer: "#354796",
    onSecondaryContainer: "#DBE6FD",
    tertiary: "#D0BCFF",
    onTertiary: "#4F308B",
    tertiaryContainer: "#6745A3",
    onTertiaryContainer: "#E9D7FD",
    error: "#FFB4AB",
    onError: "#690005",
    errorContainer: "#93000A",
    onErrorContainer: "#FFDAD6",
    background: "#1A1C19",
    onBackground: "#E1E3DD",
    surface: "#1A1C19",
    onSurface: "#E1E3DD",
    surfaceVariant: "#444C45",
    onSurfaceVariant: "#C2C9C2",
    outline: "#8C948D",
    outlineVariant: "#444C45",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#E1E3DD",
    inverseOnSurface: "#1A1C19",
    inversePrimary: "#006D5B",
    surfaceContainerLowest: "#222421",
    surfaceContainerLow: "#2D2F2C",
    surfaceContainer: "#313330",
    surfaceContainerHigh: "#3B3D3A",
    surfaceContainerHighest: "#454744",
  };

  // Select colors based on dark mode
  const m3Colors = darkMode ? darkColors : lightColors;

  const [visibleActivities, setVisibleActivities] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [mounted, setMounted] = useState(false);
  const loadTimerRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => setMounted(false);
  }, []);

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
        className="p-2 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-300"
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 bg-[var(--primary)] dark:bg-green-400 rounded-full animate-pulse" />
          <div
            className="h-2 w-2 bg-[var(--primary)] dark:bg-green-400 rounded-full animate-pulse"
            style={{ animationDelay: "0.2s" }}
          />
          <div
            className="h-2 w-2 bg-[var(--primary)] dark:bg-green-400 rounded-full animate-pulse"
            style={{ animationDelay: "0.4s" }}
          />
          <span>{t("project.loadingActivities") || "Loading activities…"}</span>
        </div>
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="p-4 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 text-center transition-all duration-300 transform hover:scale-105">
        <div className="opacity-60 transition-opacity duration-300">
          {t("project.empty.noActivities") || "No activities for this task."}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 px-3 py-3 border-l border-r border-[var(--outline-variant)] dark:border-gray-700 bg-gray-100 dark:bg-gray-700 ${mounted ? 'animate-fade-in' : ''}`}>
      <style>{`
        :root {
          --primary: ${m3Colors.primary};
          --on-primary: ${m3Colors.onPrimary};
          --primary-container: ${m3Colors.primaryContainer};
          --on-primary-container: ${m3Colors.onPrimaryContainer};
          --secondary: ${m3Colors.secondary};
          --on-secondary: ${m3Colors.onSecondary};
          --secondary-container: ${m3Colors.secondaryContainer};
          --on-secondary-container: ${m3Colors.onSecondaryContainer};
          --tertiary: ${m3Colors.tertiary};
          --on-tertiary: ${m3Colors.onTertiary};
          --tertiary-container: ${m3Colors.tertiaryContainer};
          --on-tertiary-container: ${m3Colors.onTertiaryContainer};
          --error: ${m3Colors.error};
          --on-error: ${m3Colors.onError};
          --error-container: ${m3Colors.errorContainer};
          --on-error-container: ${m3Colors.onErrorContainer};
          --background: ${m3Colors.background};
          --on-background: ${m3Colors.onBackground};
          --surface: ${m3Colors.surface};
          --on-surface: ${m3Colors.onSurface};
          --surface-variant: ${m3Colors.surfaceVariant};
          --on-surface-variant: ${m3Colors.onSurfaceVariant};
          --outline: ${m3Colors.outline};
          --outline-variant: ${m3Colors.outlineVariant};
          --shadow: ${m3Colors.shadow};
          --scrim: ${m3Colors.scrim};
          --inverse-surface: ${m3Colors.inverseSurface};
          --inverse-on-surface: ${m3Colors.inverseOnSurface};
          --inverse-primary: ${m3Colors.inversePrimary};
          --surface-container-lowest: ${m3Colors.surfaceContainerLowest};
          --surface-container-low: ${m3Colors.surfaceContainerLow};
          --surface-container: ${m3Colors.surfaceContainer};
          --surface-container-high: ${m3Colors.surfaceContainerHigh};
          --surface-container-highest: ${m3Colors.surfaceContainerHighest};
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        @keyframes slideInUp { from { opacity:0; transform: translateY(20px) scale(.95); } to { opacity:1; transform: translateY(0) scale(1);} }
        @keyframes slideOutDown { to { opacity:0; transform: translateY(20px) scale(.95); } }
        @keyframes pulseGlow { 0%,100% { box-shadow:0 0 0 0 rgba(59,130,246,.4) } 50% { box-shadow:0 0 0 4px rgba(59,130,246,0) } }
        @keyframes bounceIn { 0%{opacity:0;transform:scale(.3);}50%{opacity:1;transform:scale(1.05);}70%{transform:scale(.9);}100%{transform:scale(1);} }
        .activity-enter { animation: slideInUp .4s ease-out both; }
        .activity-exit { animation: slideOutDown .3s ease-in both; }
        .status-completed { animation: bounceIn .6s ease-out both; }
        
        .surface-elevation-1 { 
          box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04); 
          border: 1px solid var(--outline-variant);
        }
        .surface-elevation-2 { 
          box-shadow: 0 2px 6px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06); 
          border: 1px solid var(--outline-variant);
        }
        .surface-elevation-3 { 
          box-shadow: 0 4px 12px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08); 
          border: 1px solid var(--outline-variant);
        }
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