// src/api/api.js
const API_URL = import.meta.env.VITE_API_URL || "";
const resolveApiBase = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `http://${url}`;
};
const EFFECTIVE_API_URL = resolveApiBase(API_URL || "");
const normalizeUrl = (url) => {
  if (!url) return "/";
  if (url.startsWith("http")) return url;
  return url.startsWith("/") ? url : `/${url}`;
};

export const api = async (url, method = "GET", data = null, options = {}) => {
  const token =
    typeof window !== "undefined" && window.__ACCESS_TOKEN
      ? window.__ACCESS_TOKEN
      : localStorage.getItem("authToken");

  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const fetchOptions = {
    method,
    headers,
    credentials: "include",
    ...(data && { body: JSON.stringify(data) }),
  };

  const full = url.startsWith("http")
    ? url
    : `${EFFECTIVE_API_URL}${normalizeUrl(url)}`;

  const res = await fetch(full, fetchOptions);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const err = new Error(error.message || `API Error ${res.status}`);
    err.status = res.status;
    err.response = error;
    throw err;
  }

  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text || null;
  }
};

export default { api, rawFetch, loginUser, refreshToken, logoutUser };
