// src/api/task.js
import { api } from './auth';

// -------------------- TASKS --------------------

// Get all tasks for a goal
export const fetchTasksByGoal = (goalId) =>
  api(`/api/goals/${goalId}/tasks`, 'GET');

// Create a new task under a goal
export const createTask = (goalId, data) =>
  api(`/api/goals/${goalId}/tasks`, 'POST', data);

// Update a task
export const updateTask = (taskId, data) =>
  api(`/api/tasks/${taskId}`, 'PUT', data);

// Delete a task
export const deleteTask = (taskId) =>
  api(`/api/tasks/${taskId}`, 'DELETE');