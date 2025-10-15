import { api } from "./auth"; // your shared API helper

// GET all system settings
export const fetchSystemSettings = () => api("/api/system-settings", "GET");

// UPDATE system settings
export const updateSystemSettings = (settings) =>
  api("/api/system-settings", "PUT", settings);
