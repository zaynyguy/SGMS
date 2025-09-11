import { api } from "./auth";  // use auth.js api wrapper

// GET all groups
export const fetchGroups = () => api("/api/groups", "GET");

// GET single group
export const fetchGroupDetails = (id) => api(`/api/groups/${id}`, "GET");

// CREATE group
export const createGroup = (groupData) => api("/api/groups", "POST", groupData);

// UPDATE group
export const updateGroup = (id, groupData) => api(`/api/groups/${id}`, "PUT", groupData);

// DELETE group
export const deleteGroup = (id) => api(`/api/groups/${id}`, "DELETE");

