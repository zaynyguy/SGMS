// src/api/auth.js

// This is a general-purpose API helper function.
// It simplifies making API requests by handling common settings.
const API_URL = '/api';

/**
 * A helper function to make API requests.
 * @param {string} endpoint - The API endpoint to call (e.g., '/auth/login').
 * @param {string} method - The HTTP method (e.g., 'GET', 'POST').
 * @param {object | null} body - The request body for 'POST', 'PUT', etc.
 * @returns {Promise<any>} - The JSON response from the server.
 */
export const api = async (endpoint, method = 'GET', body = null) => {
    const token = localStorage.getItem('authToken'); // Get token for authenticated requests
    const headers = {
        'Content-Type': 'application/json',
    };

    // If a token exists, add it to the Authorization header
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method,
        headers,
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);

        // If the response is not ok (e.g., 401, 404, 500), throw an error
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Something went wrong');
        }

        // If the response is successful, parse and return the JSON body
        return response.json();
    } catch (error) {
        console.error('API call failed:', error);
        // Re-throw the error so the calling function can handle it
        throw error;
    }
};

/**
 * Specific function to handle user login.
 * @param {string} username - The user's username.
 * @param {string} password - The user's password.
 * @returns {Promise<{token: string, user: object}>} - The login response.
 */
export const loginUser = (username, password) => {
    return api('/auth/login', 'POST', { username, password });
};

// In your frontend API service (auth.js or similar)
export const updateRole = async (id, data) => {
  try {
    const response = await fetch(`/api/roles/${id}`, {  // Remove trailing slash
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update role');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating role:', error);
    throw error;
  }
};