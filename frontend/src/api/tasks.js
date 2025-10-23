// This file assumes you have a generic `api` helper function
// in a file like './auth.js' or './apiClient.js'
import { api } from "./auth"; // Adjust this import path

/**
 * API functions for Tasks.
 *
 * REFACTORED: Removed Activity-related functions.
 * Those now live in `api/activities.js` and use the `/api/tasks/{taskId}/...` route,
 * which matches the `useProjectApi` hook.
 */

// Get all tasks under a goal
export const fetchTasksByGoal = (goalId) =>
  api(`/api/goals/${goalId}/tasks`, "GET");

// Create a new task under a goal
export const createTask = (goalId, taskData) =>
  api(`/api/goals/${goalId}/tasks`, "POST", taskData);

// Update a task
export const updateTask = (goalId, taskId, taskData) =>
  api(`/api/goals/${goalId}/tasks/${taskId}`, "PUT", taskData);

// Delete a task
export const deleteTask = (goalId, taskId) =>
  api(`/api/goals/${goalId}/tasks/${taskId}`, "DELETE");
