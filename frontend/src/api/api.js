// src/api/api.js
const API_URL = import.meta.env.VITE_API_URL || 'https://sgms-production.up.railway.app';

// Helper to get tokens from localStorage
const getToken = () => localStorage.getItem('authToken');

// API helper with auto-refresh logic
export const api = async (endpoint, method = 'GET', body = null, retry = true) => {
  let token = getToken();

  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = { method, headers };
  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);

    // Handle unauthorized → attempt refresh
    if (response.status === 401 && retry) {
      console.warn(`Token expired, trying to refresh...`);
      const refreshed = await refreshAuthToken();
      if (refreshed) {
        // Retry original request once with new token
        return api(endpoint, method, body, false);
      } else {
        throw new Error('Unauthorized - refresh failed');
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'API request failed');
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error(`API Error on ${method} ${endpoint}:`, error);
    throw error;
  }
};

// 🔄 Token refresh helper (uses refreshToken stored in localStorage)
export const refreshAuthToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) throw new Error('Refresh request failed');

    const data = await res.json();

    if (data.token) {
      localStorage.setItem('authToken', data.token);
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }
      return data.token;
    }
    return null;
  } catch (err) {
    console.error('Token refresh failed:', err);
    // Optional: force logout if refresh fails
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    return null;
  }
};
