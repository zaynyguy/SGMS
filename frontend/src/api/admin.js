// src/api/admin.js
import { api } from './auth'; // Generic API helper

// ======================
// USER MANAGEMENT API
// ======================
export const fetchUsers = () => api('/api/users/', 'GET');

// Create user (supports JSON + FormData)
export const createUser = (userData, isFormData = false) =>
  api('/api/users/', 'POST', userData, isFormData);

// Update user (supports JSON + FormData)
export const updateUser = (id, userData, isFormData = false) =>
  api(`/api/users/${id}/`, 'PUT', userData, isFormData);

// Delete user
export const deleteUser = (id) => api(`/api/users/${id}/`, 'DELETE');

// ======================
// ROLE MANAGEMENT API
// ======================
export const fetchRoles = () => api('/api/roles/', 'GET');

// Create role (supports JSON + FormData)
export const createRole = (roleData, isFormData = false) =>
  api('/api/roles/', 'POST', roleData, isFormData);

// Update role (supports JSON + FormData)
export const updateRole = (id, roleData, isFormData = false) =>
  api(`/api/roles/${id}/`, 'PUT', roleData, isFormData);

// Delete role
export const deleteRole = (id) => api(`/api/roles/${id}/`, 'DELETE');

// ======================
// PERMISSION MANAGEMENT
// ======================
export const fetchPermissions = () => api('/api/permissions/', 'GET');

// ======================
// USER STATUS MANAGEMENT
// ======================
export const updateUserStatus = (id, status) =>
  api(`/api/users/${id}/status/`, 'PATCH', { status });

// ======================
// UTILITY FUNCTIONS
// ======================
export const fetchRolePermissions = (roleId) =>
  api(`/api/roles/${roleId}/permissions/`, 'GET');
