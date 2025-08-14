const API_URL = 'https://sgms-production.up.railway.app' || 'http://localhost:5000/api';

export const api = async (endpoint, method = 'GET', body = null) => {
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(API_URL + endpoint, config);

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  return response.json();
};
