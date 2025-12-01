// src/api/auth.js
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

let _isRefreshing = false;
let _refreshPromise = null;

async function _tryRefresh() {
  if (_isRefreshing) return _refreshPromise;
  _isRefreshing = true;
  _refreshPromise = (async () => {
    try {
      const resp = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!resp.ok) {
        // Clear tokens on refresh failure
        window.__ACCESS_TOKEN = null;
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
        _isRefreshing = false;
        return null; // ← return null instead of false for clarity
      }
      const data = await resp.json().catch(() => null);
      if (!data?.token) throw new Error("Missing token in refresh response");
      window.__ACCESS_TOKEN = data.token;
      localStorage.setItem("authToken", data.token);
      if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));
      _isRefreshing = false;
      return data;
    } catch (err) {
      console.error("[auth] refresh failed", err);
      window.__ACCESS_TOKEN = null;
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      _isRefreshing = false;
      return null;
    }
  })();
  return _refreshPromise;
}

async function _doFetch(fullUrl, fetchOptions) {
  fetchOptions = { credentials: "include", ...fetchOptions };
  const token = window.__ACCESS_TOKEN || localStorage.getItem("authToken");
  if (token) {
    fetchOptions.headers = { ...(fetchOptions.headers || {}), Authorization: `Bearer ${token}` };
  }
  let res = await fetch(fullUrl, fetchOptions);
  if (res.status !== 401) return res;

  const refreshData = await _tryRefresh();
  if (!refreshData) return res; // refresh failed → return original 401

  const newToken = window.__ACCESS_TOKEN || localStorage.getItem("authToken");
  if (newToken) {
    fetchOptions.headers.Authorization = `Bearer ${newToken}`;
  }
  return fetch(fullUrl, fetchOptions);
}

export async function api(endpoint, method = "GET", body = null, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`;
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  const init = { method, headers };
  if (body != null) {
    const isFormData = Boolean(options.isFormData) || (typeof FormData !== "undefined" && body instanceof FormData);
    if (isFormData) {
      init.body = body;
    } else {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
  }
  const res = await _doFetch(url, init);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }
  if (!res.ok) {
    const err = new Error((data?.message || data?.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.response = data;
    err.isAuthError = res.status === 401;
    if (err.isAuthError) {
      // Only clear on persistent auth failure (refresh also failed)
      window.__ACCESS_TOKEN = null;
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
    }
    throw err;
  }
  return data;
}

export async function rawFetch(endpoint, method = "GET", body = null, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`;
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  const init = { method, headers };
  if (body != null) {
    const isFormData = Boolean(options.isFormData) || (typeof FormData !== "undefined" && body instanceof FormData);
    if (isFormData) init.body = body;
    else {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
  }
  return _doFetch(url, init);
}

export const loginUser = (username, password) => api("/api/auth/login", "POST", { username, password });
export const refreshToken = () => api("/api/auth/refresh", "POST", null); // ✅ This is correct
export const logoutUser = async () => {
  try {
    await api("/api/auth/logout", "POST", null);
  } catch (_) {}
  window.__ACCESS_TOKEN = null;
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
};

export default { api, rawFetch, loginUser, refreshToken, logoutUser };