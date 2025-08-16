// src/api/admin.js
import { api } from './auth'; // Your generic API helper

// ======================
// USER MANAGEMENT API
// ======================
export const fetchUsers = () => api('/users/', 'GET');

export const createUser = (userData) => api('/users/', 'POST', {
  username: userData.username,
  name: userData.name,
  password: userData.password,
  roleId: userData.roleId
});

export const updateUser = (id, userData) => api(`/users/${id}/`, 'PUT', {
  username: userData.username,
  name: userData.name,
  ...(userData.password && { password: userData.password }), // Only include if provided
  roleId: userData.roleId
});

export const deleteUser = (id) => api(`/users/${id}/`, 'DELETE');

// ======================
// ROLE MANAGEMENT API
// ======================
export const fetchRoles = () => api('/roles/', 'GET');

export const createRole = (roleData) => api('/roles/', 'POST', {
  name: roleData.name,
  permissions: roleData.permissions
});

export const updateRole = (id, roleData) => api(`/roles/${id}/`, 'PUT', {
  name: roleData.name,
  permissions: roleData.permissions
});

export const deleteRole = (id) => api(`/roles/${id}/`, 'DELETE');

// ======================
// PERMISSION MANAGEMENT
// ======================
export const fetchPermissions = () => api('/permissions/', 'GET');

// ======================
// USER STATUS MANAGEMENT
// ======================
export const updateUserStatus = (id, status) => api(`/users/${id}/status/`, 'PATCH', {
  status: status
});

// ======================
// UTILITY FUNCTIONS
// ======================
export const fetchRolePermissions = (roleId) => api(`/roles/${roleId}/permissions/`, 'GET');


