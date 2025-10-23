// This file assumes you have a generic `api` helper function
// in a file like './auth.js' or './apiClient.js'
import { api } from "./auth"; // Adjust this import path

/**
 * API functions for Activities.
 * These routes are based on `taskId`, not `goalId`.
 */

// List activities for a task
export async function fetchActivitiesByTask(taskId) {
  if (!taskId) throw new Error("taskId required");
  return await api(`/api/tasks/${taskId}/activities`, "GET");
}

// Create activity under a task
export async function createActivity(taskId, payload = {}) {
  if (!taskId) throw new Error("taskId required");
  return await api(`/api/tasks/${taskId}/activities`, "POST", payload);
}

// Update activity under a task
export async function updateActivity(taskId, activityId, payload = {}) {
  if (!taskId || !activityId) throw new Error("taskId and activityId required");
  return await api(`/api/tasks/${taskId}/activities/${activityId}`, "PUT", payload);
}

// Delete activity
export async function deleteActivity(taskId, activityId) {
  if (!taskId || !activityId) throw new Error("taskId and activityId required");
  return await api(`/api/tasks/${taskId}/activities/${activityId}`, "DELETE");
}
