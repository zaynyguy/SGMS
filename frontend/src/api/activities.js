import { api } from "./auth"; // Adjust this import path



export async function fetchActivitiesByTask(taskId, quarter = 0) {
  if (!taskId) throw new Error("taskId required");
  
  let url = `/api/tasks/${taskId}/activities`;

  if (quarter > 0) {
    url += `?quarter=${quarter}`;
  }
  return await api(url, "GET");
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