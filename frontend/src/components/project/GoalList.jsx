import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import ProgressBar from "../ui/ProgressBar";
import StatusBadge from "../ui/StatusBadge";
import SkeletonCard from "../ui/SkeletonCard";

function GoalList({ goals = [], isLoading = false, onToggleGoal, onCreate, onUpdate, onDelete, searchTerm = "" }) {
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
    surfaceContainerLow: "#F5F9F2",
    surfaceContainer: "#F0F5ED",
    surfaceContainerHigh: "#EBF1E9",
    surfaceContainerHighest: "#E5ECE3",
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

  const animTimer = useRef(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => setMounted(false);
  }, []);

  // derived filtered list
  const filteredGoals = useMemo(() => {
    if (isLoading) return [];
    const q = String(searchTerm || "").trim().toLowerCase();
    if (!q) return goals;
    return goals.filter((g) => {
      const title = String(g.title || "").toLowerCase();
      const desc = String(g.description || "").toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }, [goals, isLoading, searchTerm]);

  useEffect(() => {
    if (!isLoading) {
      setIsAnimating(true);
      clearTimeout(animTimer.current);
      animTimer.current = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(animTimer.current);
    }
    return undefined;
  }, [filteredGoals, isLoading]);

  useEffect(() => () => clearTimeout(animTimer.current), []);

  if (isLoading) return <SkeletonCard rows={3} />;

  if (!filteredGoals.length) {
    return (
      <div className="goal-list-empty goal-fade-in bg-gray-50 dark:bg-gray-900">
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
        <div className="p-8 text-center goal-empty-state">
          <div className="text-[var(--on-surface-variant)] dark:text-gray-400 text-lg mb-2">
            {t("project.empty.noGoals") || "No goals found"}
          </div>
          {searchTerm && <p className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400">No results for "{searchTerm}"</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 goal-list-container bg-gray-50 dark:bg-gray-900 ${mounted ? 'animate-fade-in' : ''}`}>
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
      {filteredGoals.map((g, i) => (
        <div
          key={g.id}
          className="bg-[var(--surface-container-low)] dark:bg-gray-800 p-4 rounded-xl surface-elevation-1 border border-[var(--outline-variant)] dark:border-gray-700"
          style={{ 
            animationDelay: `${i * 80}ms`, 
            transitionDelay: `${i * 20}ms`,
            animation: `slideInUp 0.4s ease-out forwards`,
            animationDelay: `${i * 50}ms`
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  {g?.rollNo != null && <span className="text-[var(--primary)] dark:text-cyan-400">{String(g.rollNo)}.</span>}
                  <span className="text-[var(--on-surface)] dark:text-white">{g.title}</span>
                </h3>
                <StatusBadge status={g.status} />
              </div>

              <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400 mt-1">{g.description || t("project.na") || "—"}</div>

              <div className="mt-3 max-w-xs">
                <ProgressBar progress={g.progress ?? 0} variant="goal" />
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400">{g.startDate || t("na") || "—"}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onToggleGoal && onToggleGoal(g)}
                  aria-label={t("project.actions.toggleGoal") || "Toggle"}
                  className="px-3 py-1.5 text-sm bg-[var(--surface-container)] dark:bg-gray-700 rounded-full border border-[var(--outline-variant)] dark:border-gray-600 text-[var(--on-surface)] dark:text-white hover:bg-[var(--surface-container-high)] dark:hover:bg-gray-600 transition-all duration-200"
                >
                  {t("project.actions.toggleGoal") || "Toggle"}
                </button>
                <button 
                  type="button" 
                  onClick={() => onUpdate && onUpdate(g.id, g)} 
                  className="px-3 py-1.5 text-sm bg-[var(--primary)] dark:bg-cyan-700 hover:bg-[var(--primary-container)] dark:hover:bg-indigo-600 text-[var(--on-primary)] dark:text-white rounded-full transition-all duration-200 shadow-sm"
                >
                  {t("project.actions.edit") || "Edit"}
                </button>
                <button 
                  type="button" 
                  onClick={() => onDelete && onDelete(g.id)} 
                  className="px-3 py-1.5 text-sm bg-[var(--error)] dark:bg-red-700 hover:bg-[var(--error-container)] dark:hover:bg-red-600 text-[var(--on-error)] dark:text-white rounded-full transition-all duration-200 shadow-sm"
                >
                  {t("project.actions.delete") || "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

GoalList.propTypes = {
  goals: PropTypes.array,
  isLoading: PropTypes.bool,
  onToggleGoal: PropTypes.func.isRequired,
  onCreate: PropTypes.func,
  onUpdate: PropTypes.func,
  onDelete: PropTypes.func,
  searchTerm: PropTypes.string,
};

export default React.memo(GoalList);