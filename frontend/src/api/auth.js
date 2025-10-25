// This file is unchanged from what you provided, but it's
// included here because its `rawFetch` function is essential
// for the new `AuthenticatedImage` component to work.

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

let _isRefreshing = false;
let _refreshPromise = null;

async function _tryRefresh() {
  if (_isRefreshing) return _refreshPromise;
  _isRefreshing = true;

  _refreshPromise = (async () => {
    try {
      const resp = await fetch(`${API_URL}/api/auth/refresh`, { method: "POST", credentials: "include", headers: { Accept: "application/json" } });
      if (!resp.ok) {
        window.__ACCESS_TOKEN = null;
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
        _isRefreshing = false;
        return false;
      }
      const data = await resp.json().catch(() => null);
      if (data?.token) {
        window.__ACCESS_TOKEN = data.token;
        localStorage.setItem("authToken", data.token);
      }
      if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));
      _isRefreshing = false;
      return true;
    } catch (err) {
      console.error("[api] refresh failed", err);
      window.__ACCESS_TOKEN = null;
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      _isRefreshing = false;
      return false;
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

  // If not unauthorized, return immediately
  if (res.status !== 401) return res;

  // Try refresh silently
  const refreshed = await _tryRefresh();
  if (!refreshed) return res; // if refresh fails, return original 401

  // Retry with new token
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
  try { data = text ? JSON.parse(text) : null; } catch { data = text || null; }

  if (!res.ok) {
    // Only treat it as an auth error if refresh ALSO failed
    const err = new Error((data?.message || data?.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.response = data;
    err.isAuthError = res.status === 401;

    if (err.isAuthError) {
      // Clear auth only when refresh + retry truly failed
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
export const refreshToken = () => api("/api/auth/refresh", "POST", null);
export const logoutUser = async () => { 
  try { await api("/api/auth/logout", "POST", null); } catch (_) {}
  window.__ACCESS_TOKEN = null;
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
};

export default { api, rawFetch, loginUser, refreshToken, logoutUser };
