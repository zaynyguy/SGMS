import { api } from "./auth";

// Fetch paginated notifications
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

// NOTE: socket client is handled in src/services/notificationsSocket.js
