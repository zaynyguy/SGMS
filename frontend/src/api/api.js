const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const api = async (url, method = "GET", data = null) => {
  const token = localStorage.getItem("authToken"); // ✅ match AuthContext key
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(data && { body: JSON.stringify(data) }),
  };

  const res = await fetch(url, options);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "API Error");
  }
  return res.json();
};

