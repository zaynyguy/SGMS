// src/api/auth.js
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

let _isRefreshing = false;
let _refreshPromise = null;

async function _tryRefresh() {
  // if already refreshing, return that promise so parallel callers wait
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
        // clear tokens on failed refresh
        if (typeof window !== "undefined") {
          window.__ACCESS_TOKEN = null;
          localStorage.removeItem("authToken");
          localStorage.removeItem("user");
        }
        _isRefreshing = false;
        return false;
      }
      const data = await resp.json().catch(() => null);
      if (data?.token) {
        if (typeof window !== "undefined") window.__ACCESS_TOKEN = data.token;
        localStorage.setItem("authToken", data.token);
      }
      if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));
      _isRefreshing = false;
      return true;
    } catch (err) {
      console.error("[api] refresh failed", err);
      if (typeof window !== "undefined") {
        window.__ACCESS_TOKEN = null;
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
      }
      _isRefreshing = false;
      return false;
    }
  })();
  return _refreshPromise;
}

// low-level fetch that automatically retries once on 401 by calling refresh endpoint
async function _doFetch(fullUrl, fetchOptions) {
  // ensure credentials included
  fetchOptions = { credentials: "include", ...fetchOptions };

  // ensure Authorization header uses in-memory token first
  const token =
    typeof window !== "undefined" && window.__ACCESS_TOKEN
      ? window.__ACCESS_TOKEN
      : localStorage.getItem("authToken");
  if (token) {
    fetchOptions.headers = {
      ...(fetchOptions.headers || {}),
      Authorization: `Bearer ${token}`,
    };
  }

  let res = await fetch(fullUrl, fetchOptions);

  if (res.status !== 401) return res;

  // If 401 -> attempt refresh and retry once
  const refreshed = await _tryRefresh();
  if (!refreshed) return res;

  // retry with new token (if available)
  const newToken =
    typeof window !== "undefined" && window.__ACCESS_TOKEN
      ? window.__ACCESS_TOKEN
      : localStorage.getItem("authToken");
  if (newToken) {
    fetchOptions.headers = {
      ...(fetchOptions.headers || {}),
      Authorization: `Bearer ${newToken}`,
    };
  } else {
    // nothing to retry with
    return res;
  }

  // second attempt
  res = await fetch(fullUrl, fetchOptions);
  return res;
}

/**
 * rawFetch: returns Response object (useful for blob/downloads)
 * - endpoint may be absolute (startsWith http) or relative (will be prefixed with API_URL)
 * - method string
 * - body may be FormData or JSON object
 * - options.isFormData boolean to force FormData handling
 */
export async function rawFetch(endpoint, method = "GET", body = null, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`;
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  const init = { method, headers };

  if (body != null) {
    const isFormData =
      Boolean(options.isFormData) || (typeof FormData !== "undefined" && body instanceof FormData);
    if (isFormData) {
      init.body = body;
      // do NOT set Content-Type so browser sets the multipart boundary
    } else {
      init.headers = { ...init.headers, "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
  }

  return _doFetch(url, init);
}

/**
 * api: JSON-aware helper. Uses rawFetch under the hood and returns parsed JSON (or text)
 * Throws an Error with .status and .response on non-OK responses.
 */
export async function api(endpoint, method = "GET", body = null, options = {}) {
  const res = await rawFetch(endpoint, method, body, options);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text || null;
  }

  if (!res.ok) {
    const err = new Error(data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.response = data;
    throw err;
  }
  return data;
}

/** convenience wrappers */
export const loginUser = (username, password) => api("/api/auth/login", "POST", { username, password });

export const refreshToken = async () => {
  // expose direct refresh call (returns parsed JSON)
  return api("/api/auth/refresh", "POST", null);
};

export const logoutUser = async () => {
  try {
    await api("/api/auth/logout", "POST", null);
  } catch (e) {
    // ignore network errors during logout
  } finally {
    if (typeof window !== "undefined") {
      window.__ACCESS_TOKEN = null;
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
    }
  }
};

export default { api, rawFetch, loginUser, refreshToken, logoutUser };
