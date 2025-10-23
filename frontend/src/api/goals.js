// This file assumes you have a generic `api` helper function
// in a file like './auth.js' or './apiClient.js'
import { api } from "./auth"; // Adjust this import path

/**
 * API functions for Goals.
 */

// List goals (with pagination)
export const fetchGoals = (page = 1, pageSize = 20) =>
  api(`/api/goals?page=${page}&pageSize=${pageSize}`, "GET");

// Create a goal
export const createGoal = (goalData) =>
  api("/api/goals", "POST", goalData);

// Update a goal
export const updateGoal = (goalId, goalData) =>
  api(`/api/goals/${goalId}`, "PUT", goalData);

// Delete a goal
export const deleteGoal = (goalId) =>
  api(`/api/goals/${goalId}`, "DELETE");

// List tasks for a goal
// This is defined here but `useProjectApi` imports it from `tasks.js`
// We'll keep the one in `tasks.js` as the primary one.
// export const fetchGoalTasks = (goalId, page = 1, pageSize = 20) =>
//   api(`/api/goals/${goalId}/tasks?page=${page}&pageSize=${pageSize}`, "GET");
