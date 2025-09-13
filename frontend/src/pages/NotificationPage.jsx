import React, { useEffect, useState } from "react";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../api/notifications";
import { CheckCircle, Info, AlertTriangle } from "lucide-react";

function NotificationsCenter() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchNotifications(1, 50).then((res) => setNotifications(res.rows || []));
    fetchUnreadCount().then((res) => setUnread(res.unread));
  }, []);

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleMarkRead = async (id) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnread((prev) => Math.max(prev - 1, 0));
  };

  const getIcon = (level) => {
    switch (level) {
      case "success":
        return <CheckCircle className="text-green-500 w-5 h-5" />;
      case "warning":
        return <AlertTriangle className="text-yellow-500 w-5 h-5" />;
      case "error":
        return <AlertTriangle className="text-red-500 w-5 h-5" />;
      default:
        return <Info className="text-blue-500 w-5 h-5" />;
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    if (filter === "read") return n.isRead;
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">
          Notifications ({unread} unread)
        </h2>
        {unread > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Mark all as read
          </button>
        )}
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
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl shadow border divide-y">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            No notifications to display
          </div>
        )}
        {filtered.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-3 p-4 cursor-pointer ${
              n.isRead ? "bg-white" : "bg-blue-50"
            } hover:bg-gray-50`}
            onClick={() => handleMarkRead(n.id)}
          >
            {getIcon(n.level)}
            <div className="flex-1">
              <p
                className={`text-sm ${
                  n.isRead ? "text-gray-600" : "text-gray-900 font-medium"
                }`}
              >
                {n.message}
              </p>
              <span className="text-xs text-gray-400">
                {new Date(n.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default NotificationsCenter;
