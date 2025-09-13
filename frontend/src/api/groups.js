// src/api/groups.js
import { api } from "./auth";

// GET all groups — always returns an array
export const fetchGroups = async () => {
  const res = await api("/api/groups", "GET");
  // normalize: if API returns rows or { rows } shape, or array, convert to array
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.rows)) return res.rows;
  // fallback to empty array
  return [];
};

// other helpers unchanged
export const fetchGroupDetails = (id) => api(`/api/groups/${id}`, "GET");
export const createGroup = (groupData) => api("/api/groups", "POST", groupData);
export const updateGroup = (id, groupData) => api(`/api/groups/${id}`, "PUT", groupData);
export const deleteGroup = (id) => api(`/api/groups/${id}`, "DELETE");
