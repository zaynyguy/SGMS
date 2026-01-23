import React, { memo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, Edit, Trash2, Calendar, ListChecks, Plus as PlusIcon, Trophy } from "lucide-react";
import ProgressBar from "../ui/ProgressBar";
import StatusBadge from "../ui/StatusBadge";
import TaskList from "./TaskList";
import { formatDate } from "../../uites/projectUtils";

/**
 * Renders a single Goal card with Material Design 3 styling.
 * Manages its own expanded state to show/hide the TaskList.
 * Delegates all actions (edit/delete goal, create/edit/delete task) to props.
 */
function GoalCard({
  goal,
  expandedGoal,
  toggleGoal,
  setSelectedGoal,
  canManageGTA,
  handleDeleteGoal,

  // props forwarded from parent
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

  const isExpanded = expandedGoal === goal.id;
  const [isAnimating, setIsAnimating] = useState(false);
  const [renderContent, setRenderContent] = useState(false);
  const contentRef = useRef(null);
  const timeoutRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isExpanded) {
      setRenderContent(true);
      // Small delay to ensure DOM is updated before animation starts
      timeoutRef.current = setTimeout(() => {
        setIsAnimating(true);
      }, 10);
    } else {
      setIsAnimating(false);
      // Wait for collapse animation to complete before removing content
      timeoutRef.current = setTimeout(() => {
        setRenderContent(false);
      }, 300);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isExpanded]);
  
  const handleToggleGoal = (goal) => {
    setIsAnimating(true);
    toggleGoal(goal);
  };
  
  return (
    <article
    key={goal.id}
    className={`bg-white dark:bg-gray-800 border border-[var(--outline-variant)] dark:border-gray-700 rounded-2xl mb-5 overflow-hidden transition-all duration-300 shadow-2xl hover:shadow-md ${
      mounted ? 'animate-fade-in' : ''
    }`}
      role="region"
      aria-labelledby={`goal-${goal.id}-title`}
      style={{
        "--primary": m3Colors.primary,
        "--on-primary": m3Colors.onPrimary,
        "--primary-container": m3Colors.primaryContainer,
        "--on-primary-container": m3Colors.onPrimaryContainer,
        "--secondary": m3Colors.secondary,
        "--on-secondary": m3Colors.onSecondary,
        "--secondary-container": m3Colors.secondaryContainer,
        "--on-secondary-container": m3Colors.onSecondaryContainer,
        "--tertiary": m3Colors.tertiary,
        "--on-tertiary": m3Colors.onTertiary,
        "--tertiary-container": m3Colors.tertiaryContainer,
        "--on-tertiary-container": m3Colors.onTertiaryContainer,
        "--error": m3Colors.error,
        "--on-error": m3Colors.onError,
        "--error-container": m3Colors.errorContainer,
        "--on-error-container": m3Colors.onErrorContainer,
        "--background": m3Colors.background,
        "--on-background": m3Colors.onBackground,
        "--surface": m3Colors.surface,
        "--on-surface": m3Colors.onSurface,
        "--surface-variant": m3Colors.surfaceVariant,
        "--on-surface-variant": m3Colors.onSurfaceVariant,
        "--outline": m3Colors.outline,
        "--outline-variant": m3Colors.outlineVariant,
        "--shadow": m3Colors.shadow,
        "--scrim": m3Colors.scrim,
        "--inverse-surface": m3Colors.inverseSurface,
        "--inverse-on-surface": m3Colors.inverseOnSurface,
        "--inverse-primary": m3Colors.inversePrimary,
        "--surface-container-lowest": m3Colors.surfaceContainerLowest,
        "--surface-container-low": m3Colors.surfaceContainerLow,
        "--surface-container": m3Colors.surfaceContainer,
        "--surface-container-high": m3Colors.surfaceContainerHigh,
        "--surface-container-highest": m3Colors.surfaceContainerHighest,
      }}
    >
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
          "--surface-container-low": ${m3Colors.surfaceContainerLow};
          "--surface-container": ${m3Colors.surfaceContainer};
          "--surface-container-high": ${m3Colors.surfaceContainerHigh};
          "--surface-container-highest": ${m3Colors.surfaceContainerHighest};
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
          
          @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
          }
        .animate-slide-in-up {
          animation: slideInUp 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          
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
      <div className="flex mt-2 ml-4 md:ml-5 pt-4 border-b border-[var(--outline-variant)] dark:border-gray-700">
        <h4 className="text-base font-semibold text-[var(--on-surface)] dark:text-white flex items-center gap-2">
          <Trophy className="h-5 w-5 text-green-800 dark:text-indigo-600" /> {t("project.sections.goals") || "Goals"}
        </h4>
        <p className="border-t border-[var(--outline-variant)] dark:border-gray-700"></p>
      </div>
      <div className="p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <button
              onClick={() => handleToggleGoal(goal)}
              className="p-2 rounded-full text-[var(--on-surface-variant)] dark:text-gray-400 hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 transition-all duration-200"
              aria-label={t("project.actions.toggleGoal") || "Toggle"}
              title={t("project.actions.toggleGoal") || "Toggle"}
            >
              {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>

            <div 
              className="min-w-0 flex-1 cursor-pointer"
              onClick={() => {
                setSelectedGoal && setSelectedGoal(goal);
                handleToggleGoal(goal);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedGoal && setSelectedGoal(goal); handleToggleGoal(goal); } }}
            >
              <div className="flex items-start justify-between">
                <h3 id={`goal-${goal.id}-title`} className="text-xl font-bold text-[var(--on-surface)] dark:text-white break-words flex items-center gap-2">
                  {goal?.rollNo !== undefined && goal?.rollNo !== null ? (
                    <span className="text-[var(--primary)] dark:text-indigo-600 font-semibold">{String(goal.rollNo)}.</span>
                  ) : null}
                  <span>{goal.title}</span>
                </h3>
              </div>

              <p className="text-base text-[var(--on-surface-variant)] dark:text-gray-400 mt-2 break-words">
                {goal.description || t("project.na") || "—"}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-200">
                <span className="whitespace-nowrap">
                  {t("project.fields.group") || "Group"}:{" "}
                  <strong className="text-[var(--on-surface)] dark:text-white">{goal.groupName || t("project.unassigned")}</strong>
                </span>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <StatusBadge status={goal.status} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <div className="flex flex-col md:flex-row md:items-center items-end gap-2 ml-2">
              {/* <div className="md:hidden">
                <button
                  onClick={() => handleToggleGoal(goal)}
                  className="p-1.5 rounded-full text-[var(--on-surface-variant)] dark:text-gray-400 hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 transition-all duration-200"
                  aria-label={isExpanded ? (t("project.actions.close") || "Close") : (t("project.actions.open") || "Open")}
                >
                  {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>
              </div> */}

              <div className="hidden md:flex flex-col items-end text-sm text-[var(--on-surface-variant)] dark:text-gray-400 mr-3 w-36">
                <div className="w-full">
                  <ProgressBar progress={goal.progress ?? 0} variant="goal" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canManageGTA && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent card click
                        onEditGoal && onEditGoal(goal);
                      }}
                      className="p-2.5 rounded-full text-blue-400/100 hover:bg-blue-200 dark:hover:bg-blue-900 transition-all duration-200"
                      title={t("project.actions.edit") || "Edit"}
                      aria-label={(t("project.actions.edit") || "Edit") + (goal.title ? `: ${goal.title}` : "")}
                    >
                      <Edit className="h-5 w-5" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent card click
                        handleDeleteGoal && handleDeleteGoal(goal.id);
                      }}
                      className="p-2.5 rounded-full text-[var(--error)] dark:text-red-400 hover:bg-[var(--error-container)] dark:hover:bg-red-900 transition-all duration-200"
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

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-base text-[var(--on-surface-variant)] dark:text-gray-400">
          <div className="flex items-center gap-2 transition-all duration-200">
            <Calendar className="h-4 w-4 text-[var(--on-surface-variant)] dark:text-gray-400" />
            <span className="truncate">
              {formatDate(goal.startDate)} — {formatDate(goal.endDate)}
            </span>
          </div>
          <div className="transition-all duration-200">
            {t("project.fields.weight") || "Weight"}: <strong className="text-[var(--on-surface)] dark:text-white">{goal.weight ?? "-"}</strong>
          </div>
          <div className="flex items-center gap-3 md:hidden transition-all duration-200">
            <div className="flex-1 max-w-xs">
              <ProgressBar progress={goal.progress ?? 0} variant="goal" />
            </div>
          </div>
        </div>

        {/* Smooth Expand/Collapse Container */}
        <div 
          ref={contentRef}
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isExpanded ? 'max-h-[5000px]' : 'max-h-0'
          }`}
        >
          {(renderContent || isExpanded) && (
            <div className="mt-6 pt-4 border-t border-l border-r border-[var(--outline-variant)] dark:border-gray-700 rounded-xl bg-gray-100 dark:bg-gray-700">
              <div className="flex items-center justify-between mb-2 px-4">
                <h4 className="text-base font-semibold text-[var(--on-surface)] dark:text-white flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-green-800 dark:text-indigo-600" /> {t("project.sections.tasks") || "Tasks"}
                </h4>
                <div>
                  {canManageGTA && (
                    <button
                      onClick={(e) => {
                         e.stopPropagation();
                         onCreateTask && onCreateTask(goal.id);
                      }}
                      className="px-4 py-2 rounded-full bg-green-800 dark:bg-indigo-700 text-[var(--on-primary)] dark:text-white text-sm font-medium flex items-center gap-2 hover:bg-[var(--primary-container)] dark:hover:bg-indigo-600 transition-all duration-200 shadow-sm"
                      title={t("project.actions.addTask") || "Add Task"}
                    >
                      <PlusIcon className="h-4 w-4" /> {t("project.actions.addTask") || "Add Task"}
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
                // forward parent handlers directly
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
                canManageGTA={canManageGTA} // Pass permission down
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default memo(GoalCard);