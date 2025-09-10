import { api } from "./auth"; // your existing api helper

// GET notifications (with pagination)
export const fetchNotifications = (page = 1, pageSize = 20) =>
  api(`/api/notifications?page=${page}&pageSize=${pageSize}`, "GET");

// GET unread notification count
export const fetchUnreadCount = () =>
  api("/api/notifications/unread-count", "GET");

// Mark a single notification as read
export const markNotificationRead = (id) =>
  api(`/api/notifications/${id}/read`, "PUT");

// Mark all notifications as read
export const markAllNotificationsRead = () =>
  api("/api/notifications/read-all", "PUT");

// Create a new notification (admin-only or with permission)
export const createNotification = (notificationData) =>
  api("/api/notifications", "POST", notificationData);
