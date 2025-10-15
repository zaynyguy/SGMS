import { api } from "./auth"; // your existing API helper (fetch wrapper)
import { io } from "socket.io-client";

let socket;

/**
 * Initialize socket.io client and join the user room
 */
export function initNotificationsSocket(userId, onNewNotification) {
  if (!userId) return;

  if (!socket) {
    socket = io("http://localhost:5000", {
      withCredentials: true,
    });
  }

  // Join the user-specific room
  socket.emit("join", userId);

  // Listen for new notifications
  socket.on("notification:new", (notification) => {
    console.log("🔔 New notification received:", notification);
    if (onNewNotification) onNewNotification(notification);
  });
}

/**
 * Disconnect the socket (cleanup, e.g. on logout)
 */
export function disconnectNotificationsSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Fetch paginated notifications
 */
export const fetchNotifications = (page = 1, pageSize = 20) =>
  api(`/api/notifications?page=${page}&pageSize=${pageSize}`, "GET");

/**
 * Fetch count of unread notifications
 */
export const fetchUnreadCount = () =>
  api("/api/notifications/unread-count", "GET");

/**
 * Mark a specific notification as read
 */
export const markNotificationRead = (id) =>
  api(`/api/notifications/${id}/read`, "PUT");

/**
 * Mark all notifications as read
 */
export const markAllNotificationsRead = () =>
  api("/api/notifications/read-all", "PUT");

/**
 * Create a new notification (requires permissions)
 */
export const createNotification = (notificationData) =>
  api("/api/notifications", "POST", notificationData);
