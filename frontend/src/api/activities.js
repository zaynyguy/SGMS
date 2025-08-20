// src/api/activity.js
import { api } from './auth';

// -------------------- ACTIVITIES --------------------

// Get all activities for a task
export const fetchActivitiesByTask = (taskId) =>
  api(`/api/tasks/${taskId}/activities`, 'GET');

// Create a new activity under a task
export const createActivity = (taskId, data) =>
  api(`/api/tasks/${taskId}/activities`, 'POST', data);

// Update an activity
export const updateActivity = async (id, data) => {
  try {
    // Ensure metrics is always an object
    const payload = {
      ...data,
      metrics: typeof data.metrics === 'string' ? JSON.parse(data.metrics || '{}') : data.metrics || {}
    };

    const response = await api(`api/activities/${id}`, 'PUT', payload);
    return response;
  } catch (error) {
    console.error('Failed to update activity:', error);
    throw error;
  }
};

// Delete an activity
export const deleteActivity = (activityId) =>
  api(`/api/activities/${activityId}/`, 'DELETE');
