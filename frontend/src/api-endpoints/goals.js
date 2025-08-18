// src/api/goal.js
import { api } from './auth';

// Goals
export const fetchGoals = () => api('/api/goals/', 'GET');
export const createGoal = (data) => api('/api/goals/', 'POST', data);
export const updateGoal = (id, data) => api(`/api/goals/${id}/`, 'PUT', data);
export const deleteGoal = (id) => api(`/api/goals/${id}/`, 'DELETE');

// Groups (needed for form)
export const fetchGroups = () => api('/api/groups/', 'GET');
