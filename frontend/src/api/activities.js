import { api } from './auth';

export async function fetchActivitiesByTask(taskId) {
  if (!taskId) throw new Error('taskId required');
  return await api(`/api/tasks/${taskId}/activities`, 'GET');
}

export async function createActivity(taskId, payload = {}) {
  if (!taskId) throw new Error('taskId required');
  return await api(`/api/tasks/${taskId}/activities`, 'POST', payload);
}

export async function updateActivity(taskId, activityId, payload = {}) {
  if (!taskId || !activityId) throw new Error('ids required');
  return await api(`/api/tasks/${taskId}/activities/${activityId}`, 'PUT', payload);
}

export async function deleteActivity(taskId, activityId) {
  if (!taskId || !activityId) throw new Error('ids required');
  return await api(`/api/tasks/${taskId}/activities/${activityId}`, 'DELETE');
}

