const API_URL = import.meta.env.VITE_API_URL;

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
