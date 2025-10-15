// src/api/goals.js
import { api } from "./auth"; // your existing API helper

// List goals (with pagination)
// src/api/goals.js
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
export const fetchGoalTasks = (goalId, page = 1, pageSize = 20) =>
  api(`/api/goals/${goalId}/tasks?page=${page}&pageSize=${pageSize}`, "GET");

// Create a task under a goal
export const createGoalTask = (goalId, taskData) =>
  api(`/api/goals/${goalId}/tasks`, "POST", taskData);
