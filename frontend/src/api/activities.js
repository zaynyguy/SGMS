// src/api/activities.js
import { api } from './auth';

// -------------------- ACTIVITIES --------------------

// Get all activities for a task
export const fetchActivitiesByTask = (taskId) =>
  api(`/api/tasks/${taskId}/activities`);

// Create a new activity under a task
export const createActivity = (taskId, data) =>
  api(`/api/tasks/${taskId}/activities`, 'POST', data);

// Update an activity
export const updateActivity = (id, activityData) =>
  api(`/api/activities/${id}/`, 'PUT', activityData);

// Delete an activity
export const deleteActivity = (activityId) =>
  api(`/api/activities/${activityId}/`, 'DELETE');