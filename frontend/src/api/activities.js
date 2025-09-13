// src/api/activities.js
import { api } from "./auth";

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
  if (!taskId || !activityId) throw new Error("ids required");
  return await api(`/api/tasks/${taskId}/activities/${activityId}`, "PUT", payload);
}

// Delete activity
export async function deleteActivity(taskId, activityId) {
  if (!taskId || !activityId) throw new Error("ids required");
  return await api(`/api/tasks/${taskId}/activities/${activityId}`, "DELETE");
}
