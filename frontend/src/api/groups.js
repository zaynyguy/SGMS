// src/api/groups.js
import { api } from './auth'; // Your generic API helper

// ======================
// GROUP MANAGEMENT API
// ======================
export const fetchGroups = () => api('/api/groups/', 'GET');

export const createGroup = (groupData) => api('/api/groups/', 'POST', {
  name: groupData.name,
  description: groupData.description
});

export const updateGroup = (id, groupData) => api(`/api/groups/${id}/`, 'PUT', {
  name: groupData.name,
  description: groupData.description
});

export const deleteGroup = (id) => api(`/api/groups/${id}/`, 'DELETE');

// ===============================
// GROUP MEMBERS MANAGEMENT API
// ===============================

// Get all users in a group
export const fetchGroupUsers = (groupId) =>
  api(`/api/groups/${groupId}/users`, 'GET');

// Add user to group
export const addUserToGroup = (data) =>
  api('/api/groups/addUser', 'POST', data);

// Remove user from group
export const removeUserFromGroup = (data) =>
  api('/api/groups/removeUser', 'DELETE', data);