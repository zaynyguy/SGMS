// src/api/auth.js
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const api = async (endpoint, method = "GET", body = null, options = {}) => {
  const token = localStorage.getItem("authToken");
  const headers = { Accept: "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const fetchOptions = { method, headers };

  if (body != null) {
    const isFormData = Boolean(options.isFormData) || (typeof FormData !== "undefined" && body instanceof FormData);
    if (isFormData) {
      fetchOptions.body = body;
      // do NOT set Content-Type — browser will add multipart boundary
    } else {
      headers["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(body);
    }
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`;

  const response = await fetch(url, fetchOptions);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text || null;
  }

  if (!response.ok) {
    const err = new Error(data?.message || `HTTP ${response.status}`);
    err.status = response.status;
    err.response = data;
    throw err;
  }

  return data;
};

export const loginUser = (username, password) => {
  return api("/api/auth/login", "POST", { username, password });
};

export const updateRole = async (id, data) => {
  return api(`/api/roles/${id}`, "PUT", data);
};
