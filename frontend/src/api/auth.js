// src/api/auth.js

// Use Vite environment variable or fallback to production backend
const API_URL = import.meta.env.VITE_API_URL;

/**
 * General API request helper
 * @param {string} endpoint - API path starting with /
 * @param {string} method - HTTP method
 * @param {object|null} body - Request body
 * @returns {Promise<any>}
 */
export const api = async (endpoint, method = 'GET', body = null) => {
  const token = localStorage.getItem('authToken');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  // 🔹 Debug: print full URL and config
  console.log(`[API DEBUG] ${method} -> ${API_URL}${endpoint}`, config);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.message || `HTTP ${response.status} error: ${text.slice(0, 100)}`);
    }

    return data;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};


/**
 * Login function
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{token: string, user: object}>}
 */
export const loginUser = (username, password) => {
  // Make sure endpoint matches backend; likely /api/auth/login
  return api('/api/auth/login', 'POST', { username, password });
};

/**
 * Update role example
 * @param {number} id
 * @param {object} data
 * @returns {Promise<any>}
 */
export const updateRole = async (id, data) => {
  return api(`/api/roles/${id}`, 'PUT', data);
};

