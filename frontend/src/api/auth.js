const API_URL = import.meta.env.VITE_API_URL || 'https://sgms-production.up.railway.app';

/**
 * General API helper
 */
export const api = async (endpoint, method = 'GET', body = null) => {
  const token = localStorage.getItem('authToken');
  const headers = { 'Content-Type': 'application/json' };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);

    // If response is not ok, try to parse JSON error
    if (!response.ok) {
      let errorMessage = 'Something went wrong';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {}
      throw new Error(errorMessage);
    }

    // Parse JSON if any
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

/**
 * Login user
 */
export const loginUser = (username, password) => {
  return api('/auth/login', 'POST', { username, password });
};

/**
 * Update role example
 */
export const updateRole = (id, data) => {
  return api(`/roles/${id}`, 'PUT', data);
};
