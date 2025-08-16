// src/api/admin.js
import { api } from './auth';

// --- User Management ---
export const fetchUsers = () => api('/api/users/');
export const createUser = (userData) => api('/api/users/', 'POST', userData);
export const updateUser = (id, userData) => api(`api/users/${id}/`, 'PUT', userData);
export const deleteUser = (id) => api(`/api/users/${id}/`, 'DELETE');

// --- Role Management ---
export const fetchRoles = () => api('/api/roles/');
export const createRole = (roleData) => api('/api/roles/', 'POST', roleData);
export const updateRole = (id, roleData) => api(`api//roles/${id}/`, 'PUT', roleData);
export const deleteRole = (id) => api(`/api/roles/${id}/`, 'DELETE');

// --- Permissions ---
export const fetchPermissions = () => api('/api/permissions/');

// Note: The backend code provided does not include an endpoint for fetchRolePermissions or updateUserStatus.
// These would need to be added to your backend routes and controllers to function.
