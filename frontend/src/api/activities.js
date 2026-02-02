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

// ================================================================
// ACTIVITY RECORDS API
// ================================================================

/**
 * Get records for a specific activity
 * @param {number} taskId - Task ID (for route structure)
 * @param {number} activityId - Activity ID
 * @param {object} options - Query options { fiscalYear, quarter, granularity }
 */
export async function fetchActivityRecords(taskId, activityId, options = {}) {
  if (!taskId || !activityId) throw new Error("taskId and activityId required");

  const params = new URLSearchParams();
  if (options.fiscalYear) params.append("fiscalYear", options.fiscalYear);
  if (options.quarter) params.append("quarter", options.quarter);
  if (options.granularity) params.append("granularity", options.granularity);

  const queryString = params.toString();
  const url = `/api/tasks/${taskId}/activities/${activityId}/records${queryString ? `?${queryString}` : ''}`;

  return await api(url, "GET");
}

/**
 * Update/create records for an activity
 * @param {number} taskId - Task ID
 * @param {number} activityId - Activity ID  
 * @param {array} records - Array of { fiscalYear, quarter?, month?, metricKey, value }
 */
export async function upsertActivityRecords(taskId, activityId, records) {
  if (!taskId || !activityId) throw new Error("taskId and activityId required");
  if (!Array.isArray(records)) throw new Error("records must be an array");

  return await api(`/api/tasks/${taskId}/activities/${activityId}/records`, "PUT", { records });
}

/**
 * Delete a specific record
 * @param {number} taskId - Task ID
 * @param {number} activityId - Activity ID
 * @param {number} recordId - Record ID to delete
 */
export async function deleteActivityRecord(taskId, activityId, recordId) {
  if (!taskId || !activityId || !recordId) throw new Error("taskId, activityId, and recordId required");

  return await api(`/api/tasks/${taskId}/activities/${activityId}/records/${recordId}`, "DELETE");
}

/**
 * Get aggregated records for master report display
 * @param {object} options - { groupId, fiscalYear, granularity }
 */
export async function fetchAggregatedRecords(options = {}) {
  const params = new URLSearchParams();
  if (options.groupId) params.append("groupId", options.groupId);
  if (options.fiscalYear) params.append("fiscalYear", options.fiscalYear);
  if (options.granularity) params.append("granularity", options.granularity);

  const queryString = params.toString();
  const url = `/api/records/aggregated${queryString ? `?${queryString}` : ''}`;

  return await api(url, "GET");
}