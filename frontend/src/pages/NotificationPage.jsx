import React, { useEffect, useState } from "react";
import {
  CheckCircle,
  Info,
  AlertTriangle,
  Loader,
  Filter,
  Bell,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../api/notifications";
import TopBar from "../components/layout/TopBar";
import Toast from "../components/common/Toast";

export default function NotificationsPage() {
  const { t } = useTranslation();

  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);

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

  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState("all"); // 'all' | 'unread' | 'read'
  const [page, setPage] = useState(1);
  const LIMIT = 25;

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Animation states
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [animatingNotifications, setAnimatingNotifications] = useState(new Set());

  // Toast state (uses your existing Toast component)
  const [toast, setToast] = useState(null);
  const showToast = (text, type = "read") => setToast({ text, type });
  const handleToastClose = () => setToast(null);

  // Initial load
  useEffect(() => {
    loadNotifications(1, false);
    fetchUnreadCount()
      .then((r) => setUnread(r?.unread ?? 0))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when filter changes
  useEffect(() => {
    loadNotifications(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const loadNotifications = async (newPage = 1, append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);

      const res = await fetchNotifications(newPage, LIMIT);
      const rows = res?.rows ?? [];

      setNotifications((prev) => {
        const newNotifications = append ? [...prev, ...rows] : rows;
        
        // Add animation for new notifications
        if (rows.length > 0) {
          setTimeout(() => {
            const newIds = new Set(rows.map(n => n.id));
            setAnimatingNotifications(prev => new Set([...prev, ...newIds]));
            
            // Clear animation after transition
            setTimeout(() => {
              setAnimatingNotifications(prev => {
                const updated = new Set(prev);
                newIds.forEach(id => updated.delete(id));
                return updated;
              });
            }, 500);
          }, 50);
        }
        
        return newNotifications;
      });
      
      setPage(newPage);

      // Update unread count
      try {
        const u = await fetchUnreadCount();
        setUnread(u?.unread ?? 0);
      } catch {}

      setError(null);
      setIsFirstLoad(false);
    } catch (e) {
      console.error("Failed to load notifications", e);
      setError(t("notifications.errors.loadFailed"));
      showToast(t("notifications.errors.loadFailed"), "error");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => loadNotifications(page + 1, true);

  const handleMarkRead = async (id) => {
    try {
      // Add read animation
      setAnimatingNotifications(prev => new Set([...prev, id]));
      
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnread((u) => Math.max(0, u - 1));
      
      // Clear animation after transition
      setTimeout(() => {
        setAnimatingNotifications(prev => {
          const updated = new Set(prev);
          updated.delete(id);
          return updated;
        });
      }, 300);
      
      showToast(t("notifications.toasts.markedRead") || t("notifications.markAsRead"), "read");
    } catch (e) {
      console.error("Failed to mark read", e);
      setAnimatingNotifications(prev => {
        const updated = new Set(prev);
        updated.delete(id);
        return updated;
      });
      showToast(t("notifications.errors.markReadFailed") || "Failed to mark read", "error");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      // Add animation for all unread notifications
      const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
      setAnimatingNotifications(prev => new Set([...prev, ...unreadIds]));
      
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
      
      // Clear animations after transition
      setTimeout(() => {
        setAnimatingNotifications(prev => {
          const updated = new Set(prev);
          unreadIds.forEach(id => updated.delete(id));
          return updated;
        });
      }, 500);
      
      showToast(t("notifications.toasts.markAllRead") || t("notifications.markAll"), "read");
    } catch (e) {
      console.error("Failed to mark all read", e);
      setAnimatingNotifications(prev => {
        const updated = new Set(prev);
        notifications.filter(n => !n.isRead).forEach(n => updated.delete(n.id));
        return updated;
      });
      showToast(t("notifications.errors.markAllFailed") || "Failed to mark all read", "error");
    }
  };

  const iconFor = (level) => {
    switch (level) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-[#1a9e75] dark:text-green-400 flex-shrink-0" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-[#944f01] dark:text-yellow-400 flex-shrink-0" />;
      case "error":
        return <AlertTriangle className="w-5 h-5 text-[#b3261e] dark:text-red-400 flex-shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-[#4a4458] dark:text-gray-400 flex-shrink-0" />;
    }
  };

  // Apply filter
  const visible = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    if (filter === "read") return n.isRead;
    return true;
  });

  return (
    <div className={`min-h-screen bg-[var(--background)] dark:bg-gray-900 font-sans`} style={{
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
    }}>
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
          "--surface-container-high": ${m3Colors.surfaceContainerHigh};
          "--surface-container-highest": ${m3Colors.surfaceContainerHighest};
        }
        
        @keyframes material-in {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      
      <div className="min-w-7xl mx-auto p-4">
        {/* Card-style Header with Material 3 elevation */}
        <div className="mb-6">
          <div className="bg-[var(--surface-container-low)] dark:bg-gray-800 rounded-xl border border-[var(--outline-variant)] dark:border-gray-700 shadow-xl p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center justify-center gap-4 min-w-0 flex-1">
                <div className="p-3 rounded-xl bg-[var(--primary-container)] dark:bg-green-900">
                  <Bell className="h-6 w-6 text-[var(--on-primary-container)] dark:text-green-200" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-row gap-2">
                    <h1 className="text-2xl font-bold text-[var(--on-surface)] dark:text-white">
                      {t("notifications.title")}
                    </h1>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400">•</span>
                      <span className="text-sm text-[var(--primary)] dark:text-green-400 bg-[var(--primary-container)] dark:bg-green-900 px-3 py-1 rounded-full font-medium">
                        {unread} {t("notifications.unread", { count: unread })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <TopBar />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters with Material 3 design */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)] dark:text-gray-400 mb-2 md:mb-0">
              <Filter size={18} className="text-[var(--on-surface-variant)] dark:text-gray-400" />
              <span>{t("notifications.filter.label")}</span>
            </div>
            {["all", "unread", "read"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  filter === f
                    ? "bg-[var(--primary)] dark:bg-green-700 text-[var(--on-primary)] dark:text-white shadow-[0_2px_6px_rgba(16,185,129,0.3)] dark:shadow-[0_2px_6px_rgba(16,185,129,0.4)] scale-105"
                    : "bg-[var(--surface-container)] dark:bg-gray-700 text-[var(--on-surface-variant)] dark:text-gray-400 hover:bg-[var(--surface-container-high)] dark:hover:bg-gray-600 hover:text-[var(--on-surface)] dark:hover:text-white"
                }`}
                aria-pressed={filter === f}
                aria-label={t("notifications.filter." + f)}
              >
                {t(`notifications.filter.${f}`)}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-end">
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="px-4 py-2.5 rounded-full bg-[var(--primary)] dark:bg-green-700 hover:bg-[var(--primary-container)] dark:hover:bg-green-600 transition-all duration-200 text-[var(--on-primary)] dark:text-white font-medium shadow-[0_2px_6px_rgba(16,185,129,0.3)] dark:shadow-[0_2px_6px_rgba(16,185,129,0.4)] hover:shadow-[0_3px_8px_rgba(16,185,129,0.4)] dark:hover:shadow-[0_3px_8px_rgba(16,185,129,0.5)]"
                aria-label={t("notifications.aria.markAll")}
              >
                {t("notifications.markAll")}
              </button>
            )}
          </div>
        </div>

        {/* Body with Material 3 elevation and containers */}
        <div className="bg-[var(--surface-container-low)] dark:bg-gray-800 rounded-xl border border-[var(--outline-variant)] dark:border-gray-700 shadow-xl overflow-hidden">
          {loading && notifications.length === 0 ? (
            <div className="p-6 flex flex-col items-center justify-center text-center text-[var(--on-surface-variant)] dark:text-gray-400 min-h-[120px]">
              <Loader className="h-6 w-6 animate-spin text-[var(--primary)] dark:text-green-400" />
              <p className="mt-2 text-base font-medium">{t("notifications.loading")}</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="p-6 text-center text-[var(--on-surface-variant)] dark:text-gray-400 text-base">
              {t("notifications.noNotifications")}
            </div>
          ) : (
            <div className="divide-y divide-[var(--outline-variant)] dark:divide-gray-700">
              {visible.map((n, index) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 p-5 transition-all duration-300 ${
                    n.isRead
                      ? "bg-[var(--surface-container-low)] dark:bg-gray-800 hover:bg-[var(--surface-container)] dark:hover:bg-gray-700"
                      : "bg-[var(--primary-container)]/[0.15] dark:bg-green-900/[0.3] hover:bg-[var(--primary-container)]/[0.2] dark:hover:bg-green-900/[0.5]"
                  } ${
                    animatingNotifications.has(n.id) 
                      ? "scale-[1.01] bg-[var(--tertiary-container)] dark:bg-purple-900/[0.3] shadow-[0_0_12px_rgba(125,82,96,0.2)] dark:shadow-[0_0_12px_rgba(125,82,96,0.3)]" 
                      : "hover:shadow-[0_2px_6px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_2px_6px_rgba(0,0,0,0.2)]"
                  }`}
                  style={{
                    animation: isFirstLoad ? `material-in 0.4s ease-out forwards` : 'none',
                    animationDelay: isFirstLoad ? `${index * 0.05}s` : '0s',
                  }}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {iconFor(n.level)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <p className={`text-base break-words transition-colors ${
                        n.isRead
                          ? "text-[var(--on-surface-variant)] dark:text-gray-400"
                          : "text-[var(--on-surface)] dark:text-white font-medium"
                      } ${
                        animatingNotifications.has(n.id) ? "text-[var(--on-tertiary-container)] dark:text-purple-200" : ""
                      }`}>
                        {n.message}
                      </p>

                      <div className="flex flex-col md:items-end gap-2 min-w-[140px]">
                        {!n.isRead && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkRead(n.id);
                            }}
                            className="px-3 py-1.5 rounded-full text-sm font-medium bg-[var(--surface-container-high)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white hover:bg-[var(--surface-container-highest)] dark:hover:bg-gray-600 transition-colors border border-[var(--outline-variant)] dark:border-gray-600"
                          >
                            {t("notifications.markAsRead")}
                          </button>
                        )}
                        <span className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400 whitespace-nowrap min-w-max">
                          {t("notifications.timestamps.formatted", {
                            date: new Date(n.createdAt).toLocaleString(),
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Load more with Material 3 design */}
        <div className="mt-6 flex items-center justify-center">
          {error && (
            <div className="text-sm text-[var(--error)] dark:text-red-400 bg-[var(--error-container)] dark:bg-red-900 px-4 py-2 rounded-full transition-all duration-200">
              {error}
            </div>
          )}

          {!loading && !loadingMore && notifications.length >= page * LIMIT && (
            <button
              onClick={handleLoadMore}
              className="px-5 py-2.5 rounded-full bg-[var(--surface-container)] dark:bg-gray-700 text-[var(--on-surface-variant)] dark:text-gray-400 hover:bg-[var(--surface-container-high)] dark:hover:bg-gray-600 transition-all duration-200 font-medium shadow-[0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)] hover:shadow-[0_2px_5px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_2px_5px_rgba(0,0,0,0.3)] text-base"
              aria-label={t("notifications.aria.loadMore")}
            >
              {t("notifications.loadMore")}
            </button>
          )}

          {loadingMore && (
            <div className="flex items-center text-sm text-[var(--on-surface-variant)] dark:text-gray-400">
              <Loader className="h-5 w-5 animate-spin mr-2 text-[var(--primary)] dark:text-green-400" />
              {t("notifications.loadingMore")}
            </div>
          )}
        </div>
      </div>

      {/* Toast UI */}
      {toast && <Toast message={toast.text} type={toast.type} onClose={handleToastClose} />}
    </div>
  );
}