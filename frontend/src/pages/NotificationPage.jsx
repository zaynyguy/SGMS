// src/pages/NotificationsPage.jsx
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
        return <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 transition-all duration-300 hover:scale-110" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 transition-all duration-300 hover:scale-110" />;
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 transition-all duration-300 hover:scale-110" />;
      default:
        return <Info className="w-4 h-4 text-blue-500 flex-shrink-0 transition-all duration-300 hover:scale-110" />;
    }
  };

  // Apply filter
  const visible = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    if (filter === "read") return n.isRead;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 transition-all duration-500 ease-in-out">
      <div className="max-w-8xl mx-auto p-3 md:p-4">
        {/* Card-style Header */}
        <div className="mb-4 md:mb-5">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-5 transition-all duration-200">
            <div className="flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-2.5 rounded-lg bg-gray-200 dark:bg-gray-900 border border-sky-100 dark:border-sky-800/30">
                  <Bell className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                    <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                      {t("notifications.title")}
                    </h1>
                    <div className="flex items-center gap-2 mt-1 sm:mt-0">
                      <span className="hidden sm:inline text-gray-400 dark:text-gray-500">•</span>
                      <span className="text-xs text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 px-2 py-1 rounded-full font-medium">
                        {unread} {t("notifications.unread", { count: unread })}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed">
                    {t("settings.subtitle")}
                  </p>
                </div>
              </div>

              <div className="flex-shrink-0">
                <TopBar />
              </div>
            </div>
          </div>
        </div>

        {/* Filters with enhanced interactions */}
        <div className="flex flex-wrap gap-2 mb-4 justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mr-2">
            <div
              className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mr-2 transform transition-all duration-300 hover:scale-105"
              aria-hidden
            >
              <Filter size={14} className="transition-all duration-300 hover:rotate-12" />
              <span className="transition-all duration-300">{t("notifications.filter.label")}</span>
            </div>
            {["all", "unread", "read"].map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  // Add filter change animation
                  document.documentElement.style.setProperty('--filter-scale', '0.95');
                  setTimeout(() => {
                    document.documentElement.style.setProperty('--filter-scale', '1');
                  }, 150);
                }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                  filter === f
                    ? "bg-blue-600 text-white shadow scale-105"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:shadow"
                }`}
                style={{
                  transform: `scale(var(--filter-scale, 1))`
                }}
                aria-pressed={filter === f}
                aria-label={t("notifications.filter." + f)}
              >
                {t(`notifications.filter.${f}`)}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2">
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="w-full sm:w-auto px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-xs transition-all duration-300 transform hover:scale-105 active:scale-95 hover:shadow"
                aria-label={t("notifications.aria.markAll")}
              >
                {t("notifications.markAll")}
              </button>
            )}
          </div>
        </div>

        {/* Body with enhanced animations */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 transition-all duration-500 ease-in-out transform hover:shadow">
          {loading && notifications.length === 0 ? (
            <div className="p-4 flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 min-h-[80px] transform transition-all duration-500">
              <Loader className="h-4 w-4 animate-spin transition-all duration-1000" />
              <p className="mt-1.5 text-xs transform transition-all duration-700 ease-in-out">{t("notifications.loading")}</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-xs transform transition-all duration-700 ease-out">
              {t("notifications.noNotifications")}
            </div>
          ) : (
            visible.map((n, index) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-3 transition-all duration-500 ease-in-out transform ${
                  n.isRead
                    ? "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"
                    : "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                } ${
                  animatingNotifications.has(n.id) 
                    ? "scale-105 bg-green-50 dark:bg-green-900/20 shadow" 
                    : "hover:scale-[1.02] hover:shadow-sm"
                }`}
                style={{
                  animationDelay: isFirstLoad ? `${index * 0.1}s` : '0s',
                  transform: `translateY(${animatingNotifications.has(n.id) ? '-2px' : '0px'})`
                }}
              >
                {iconFor(n.level)}

                <div className="flex-1 min-w-0 transform transition-all duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5">
                    <p
                      className={`text-xs break-words transition-all duration-500 ease-in-out ${
                        n.isRead
                          ? "text-gray-600 dark:text-gray-300"
                          : "text-gray-900 dark:text-white font-medium"
                      } ${
                        animatingNotifications.has(n.id) ? "text-green-700 dark:text-green-300" : ""
                      }`}
                    >
                      {n.message}
                    </p>

                    <div className="flex flex-col sm:items-end gap-1.5 transform transition-all duration-300">
                      {!n.isRead && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="text-xs px-1.5 py-0.5 rounded text-gray-950 dark:text-white bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-300 transform hover:scale-105 active:scale-95 hover:shadow-sm"
                        >
                          {t("notifications.markAsRead")}
                        </button>
                      )}
                      <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap transition-all duration-500">
                        {t("notifications.timestamps.formatted", {
                          date: new Date(n.createdAt).toLocaleString(),
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Load more with enhanced animations */}
        <div className="mt-4 flex items-center justify-center transform transition-all duration-500">
          {error && (
            <div className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded transition-all duration-500 transform hover:scale-105 animate-pulse">
              {error}
            </div>
          )}

          {!loading && !loadingMore && notifications.length >= page * LIMIT && (
            <button
              onClick={handleLoadMore}
              className="px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-300 transform hover:scale-105 active:scale-95 hover:shadow text-xs"
              aria-label={t("notifications.aria.loadMore")}
            >
              {t("notifications.loadMore")}
            </button>
          )}

          {loadingMore && (
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 transform transition-all duration-500">
              <Loader className="h-3.5 w-3.5 animate-spin mr-1.5 transition-all duration-1000" />
              {t("notifications.loadingMore")}
            </div>
          )}
        </div>
      </div>

      {/* Toast UI */}
      {toast && <Toast message={toast.text} type={toast.type} onClose={handleToastClose} />}

      {/* CSS Variables for animations */}
      <style jsx>{`
        :root {
          --filter-scale: 1;
        }
        
        /* Custom animation for notification items */
        .notification-item {
          animation: slideInUp 0.6s ease-out both;
        }
        
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}