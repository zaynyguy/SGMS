// src/pages/NotificationsPage.jsx
import React, { useEffect, useState } from "react";
import { CheckCircle, Info, AlertTriangle, Loader, Filter, Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../api/notifications";
import TopBar from "../components/layout/TopBar";

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

      setNotifications((prev) => (append ? [...prev, ...rows] : rows));
      setPage(newPage);

      // Update unread count
      try {
        const u = await fetchUnreadCount();
        setUnread(u?.unread ?? 0);
      } catch {}

      setError(null);
    } catch (e) {
      console.error("Failed to load notifications", e);
      setError(t("notifications.errors.loadFailed"));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => loadNotifications(page + 1, true);

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnread((u) => Math.max(0, u - 1));
    } catch (e) {
      console.error("Failed to mark read", e);
      // optional: show a localized error - currently just logs
      // alert(t("notifications.errors.markReadFailed"));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    } catch (e) {
      console.error("Failed to mark all read", e);
      // optional: show localized error
      // alert(t("notifications.errors.markAllFailed"));
    }
  };

  const iconFor = (level) => {
    switch (level) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />;
      case "error":
        return <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />;
    }
  };

  // Apply filter
  const visible = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    if (filter === "read") return n.isRead;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 transition-colors duration-200">
      <div className="max-w-8xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center min-w-0 gap-4">
            <div className="p-3 rounded-lg bg-white dark:bg-gray-800">
                        <Bell className="h-6 w-6 text-sky-600 dark:text-sky-300" />
                      </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
              {t("notifications.title")}
            </h1>
            <p className="mt-1 text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-2xl">
                {t("settings.subtitle")}
              </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("notifications.unreadCount", { count: unread })}
            </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm transition-colors duration-200"
                aria-label={t("notifications.aria.markAll")}
              >
                {t("notifications.markAll")}
              </button>
            )}
            <TopBar />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mr-2" aria-hidden>
            <Filter size={16} />
            <span>{t("notifications.filter.label")}</span>
          </div>
          {["all", "unread", "read"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              aria-pressed={filter === f}
              aria-label={t("notifications.filter." + f)}
            >
              {t(`notifications.filter.${f}`)}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 transition-colors duration-200">
          {loading && notifications.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <div className="flex justify-center">
                <Loader className="h-5 w-5 animate-spin" />
              </div>
              <p className="mt-2">{t("notifications.loading")}</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              {t("notifications.noNotifications")}
            </div>
          ) : (
            visible.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-4 transition-colors duration-200 ${
                  n.isRead
                    ? "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"
                    : "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                }`}
              >
                {iconFor(n.level)}

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <p
                      className={`text-sm break-words ${
                        n.isRead ? "text-gray-600 dark:text-gray-300" : "text-gray-900 dark:text-white font-medium"
                      }`}
                    >
                      {n.message}
                    </p>

                    <div className="flex flex-col sm:items-end gap-2">
                      {!n.isRead && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="text-xs px-2 py-1 rounded-md text-gray-950 dark:text-white bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200 self-start sm:self-auto"
                        >
                          {t("notifications.markAsRead")}
                        </button>
                      )}
                      <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                        {t("notifications.timestamps.formatted", { date: new Date(n.createdAt).toLocaleString() })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Load more */}
        <div className="mt-6 flex items-center justify-center">
          {error && (
            <div className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-md">
              {error}
            </div>
          )}

          {!loading && !loadingMore && notifications.length >= page * LIMIT && (
            <button
              onClick={handleLoadMore}
              className="px-4 py-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
              aria-label={t("notifications.aria.loadMore")}
            >
              {t("notifications.loadMore")}
            </button>
          )}

          {loadingMore && (
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <Loader className="h-4 w-4 animate-spin mr-2" />
              {t("notifications.loadingMore")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
