import { api } from "./auth"; // Adjust this import path

// Fetch tasks
export const fetchTasksByGoal = (goalId, quarter = 0) => {
  let url = `/api/goals/${goalId}/tasks`;
 
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