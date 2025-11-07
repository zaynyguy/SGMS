// This file assumes you have a generic `api` helper function
// in a file like './auth.js' or './apiClient.js'
import { api } from "./auth"; // Adjust this import path

/**
 * API functions for Tasks.
 */

// Get all tasks under a goal
export const fetchTasksByGoal = (goalId, quarter = 0) => {
  if (!goalId) throw new Error("goalId required");

  let url = `/api/goals/${goalId}/tasks`;

  // If a specific quarter is requested (and not "All"),
  // append it as a query parameter.
  // The backend should use this to return only tasks
  // that have activities assigned to that quarter.
  if (quarter > 0) {
    url += `?quarter=${quarter}`;
  }
  
  return api(url, "GET");
}

// Create a new task under a goal
export const createTask = (goalId, taskData) =>
  api(`/api/goals/${goalId}/tasks`, "POST", taskData);

// Update a task
export const updateTask = (goalId, taskId, taskData) =>
  api(`/api/goals/${goalId}/tasks/${taskId}`, "PUT", taskData);

// Delete a task
export const deleteTask = (goalId, taskId) =>
  api(`/api/goals/${goalId}/tasks/${taskId}`, "DELETE");