// src/api/tasks.js
import { api } from "./auth"; // your generic fetch wrapper

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

// Fetch activities for a task
export const fetchActivitiesByTask = (goalId, taskId) =>
  api(`/api/goals/${goalId}/tasks/${taskId}/activities`, "GET");

// Create an activity under a task
export const createActivity = (goalId, taskId, activityData) =>
  api(`/api/goals/${goalId}/tasks/${taskId}/activities`, "POST", activityData);
