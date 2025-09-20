// src/pages/NotificationsPage.jsx
import React, { useEffect, useState } from "react";
import { CheckCircle, Info, AlertTriangle } from "lucide-react";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../api/notifications";
import TopBar from "../components/layout/TopBar";

export default function NotificationsPage() {
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
    fetchUnreadCount().then((r) => setUnread(r?.unread ?? 0)).catch(() => {});
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
      setError("Failed to load notifications");
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
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    } catch (e) {
      console.error("Failed to mark all read", e);
    }
  };

  const iconFor = (level) => {
    switch (level) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "error":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  // Apply filter
  const visible = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    if (filter === "read") return n.isRead;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-end mb-6">
        <div className="justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500">{unread} unread</p>
        </div>
        <div>
          {unread > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              Mark all as read
            </button>
          )}
        </div>
      <TopBar/>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        {["all", "unread", "read"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1 rounded-lg text-sm font-medium ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="bg-white rounded-xl shadow border divide-y">
        {loading && notifications.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            Loading notifications…
          </div>
        ) : visible.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No notifications to display
          </div>
        ) : (
          visible.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 p-4 ${
                n.isRead ? "bg-white" : "bg-blue-50"
              } hover:bg-gray-50`}
            >
              <div className="flex-shrink-0 mt-0.5">{iconFor(n.level)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p
                    className={`text-sm ${
                      n.isRead
                        ? "text-gray-600"
                        : "text-gray-900 font-medium"
                    }`}
                  >
                    {n.message}
                  </p>
                  <div className="flex-shrink-0 ml-3 flex flex-col items-end gap-2">
                    {!n.isRead && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="text-xs px-2 py-1 rounded bg-white border hover:bg-gray-100"
                      >
                        Mark
                      </button>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load more */}
      <div className="mt-4 flex items-center justify-center">
        {error && <div className="text-sm text-red-500">{error}</div>}
        {!loading &&
          !loadingMore &&
          notifications.length >= page * LIMIT && (
            <button
              onClick={handleLoadMore}
              className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
            >
              Load more
            </button>
          )}
        {loadingMore && (
          <div className="text-sm text-gray-600">Loading more…</div>
        )}
      </div>
    </div>
  );
}
