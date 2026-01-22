import React, { createContext, useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  loginUser as apiLoginUser,
  logoutUser as apiLogoutUser,
} from "../api/auth";
import { initSocket, disconnectSocket } from "../services/socketService";

const API_URL = import.meta.env.VITE_API_URL || "";
const AuthContext = createContext(null);

function normalizeStoredUserRaw() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistUserToStorage(userObj) {
  try {
    const existing = normalizeStoredUserRaw();
    const merged = { ...existing, ...userObj };
    // Never persist darkMode coming from server here — callers should not pass it.
    if (Object.prototype.hasOwnProperty.call(merged, "darkMode"))
      delete merged.darkMode;
    localStorage.setItem("user", JSON.stringify(merged));
  } catch (e) {
    // ignore storage errors
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(
    () => localStorage.getItem("authToken") || null
  );
  const [loading, setLoading] = useState(true);
  const { i18n } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  // Single shared promise used to serialize refresh attempts across callers
  const refreshPromiseRef = useRef(null);
  // Timer to proactively refresh access token before expiry
  const refreshTimerRef = useRef(null);
  // Track in-flight fetch controllers so we can abort them on logout
  const pendingControllersRef = useRef(new Set());

  useEffect(() => {
    if (user && user.id) {
      initSocket(user.id);
    }
    return () => disconnectSocket();
  }, [user]);

  useEffect(() => {
    const stored = normalizeStoredUserRaw();
    if (token && stored && Object.keys(stored).length) {
      setUser(stored);
      if (stored.language) i18n.changeLanguage(stored.language);
    }
    if (token) window.__ACCESS_TOKEN = token;
    setLoading(false);

    // schedule proactive refresh when token changes
    try {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (token) {
        const parts = String(token).split('.');
        if (parts.length === 3) {
          try {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            const exp = payload && payload.exp ? Number(payload.exp) : null;
            if (exp) {
              const nowSec = Math.floor(Date.now() / 1000);
              const buffer = Number(process.env.VITE_TOKEN_REFRESH_BUFFER_SEC || 60);
              const msUntil = (exp - nowSec - buffer) * 1000;
              if (msUntil > 0) {
                refreshTimerRef.current = setTimeout(() => {
                  // call tryRefresh but ignore result
                  tryRefresh();
                }, msUntil);
              }
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }, [token, i18n]);

  const fetchMe = useCallback(async (accessToken) => {
    try {
      const resp = await fetch(`${API_URL}/api/auth/me`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
      });
      if (!resp.ok) return null;
      const d = await resp.json();
      return d;
    } catch {
      return null;
    }
  }, []);

  const login = useCallback(
    async (username, password) => {
      const response = await apiLoginUser(username, password);
      const { token: newToken, user: loggedInUser } = response || {};

      let fullUser = loggedInUser;
      if (!fullUser || !Array.isArray(fullUser.permissions)) {
        const me = await fetchMe(newToken);
        if (me) fullUser = me;
      }

      // build safe user (strip darkMode if present)
      const safeUser = {
        id: fullUser?.id,
        username: fullUser?.username,
        name: fullUser?.name,
        role: fullUser?.role,
        permissions: Array.isArray(fullUser?.permissions)
          ? fullUser.permissions
          : [],
        language: fullUser?.language,
        profilePicture: fullUser?.profilePicture || fullUser?.profilePic || "",
      };

      window.__ACCESS_TOKEN = newToken;
      localStorage.setItem("authToken", newToken);
      persistUserToStorage(safeUser);
      setToken(newToken);
      setUser(safeUser);

      if (safeUser?.language) i18n.changeLanguage(safeUser.language);

      return { token: newToken, user: safeUser };
    },
    [fetchMe, i18n]
  );

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    window.__ACCESS_TOKEN = null;
    disconnectSocket(); // ADDED
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    if (refreshTimerRef.current) {
      try { clearTimeout(refreshTimerRef.current); } catch (_) {}
      refreshTimerRef.current = null;
    }
    // Abort any in-flight requests
    try {
      for (const c of Array.from(pendingControllersRef.current || [])) {
        try {
          c.abort();
        } catch (_) {}
      }
    } catch (_) {}
    pendingControllersRef.current = new Set();
    try {
      await apiLogoutUser();
    } catch (_) {}
  }, []);

  const tryRefresh = useCallback(async () => {
    // If another refresh is already running, await it
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    // Create a single promise for all callers
    refreshPromiseRef.current = (async () => {
      setRefreshing(true);
      try {
        const r = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!r.ok) {
          await logout();
          return false;
        }
        const data = await r.json();
        const newToken = data.token;
        let newUser = data.user;
        if (!newUser || !Array.isArray(newUser.permissions)) {
          const me = await fetchMe(newToken);
          if (me) newUser = me;
        }

        const safeUser = {
          id: newUser?.id,
          username: newUser?.username,
          name: newUser?.name,
          role: newUser?.role,
          permissions: Array.isArray(newUser?.permissions)
            ? newUser.permissions
            : [],
          language: newUser?.language,
          profilePicture: newUser?.profilePicture || "",
        };

        window.__ACCESS_TOKEN = newToken;
        try {
          localStorage.setItem("authToken", newToken);
        } catch (_) {}
        persistUserToStorage(safeUser);
        setToken(newToken);
        setUser(safeUser);
        if (safeUser?.language) i18n.changeLanguage(safeUser.language);

        return true;
      } catch (err) {
        console.error("Refresh failed", err);
        await logout();
        return false;
      } finally {
        setRefreshing(false);
        refreshPromiseRef.current = null;
        // reschedule proactive refresh based on new token
        try {
          if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
            refreshTimerRef.current = null;
          }
          const newToken = window.__ACCESS_TOKEN || localStorage.getItem("authToken");
          if (newToken) {
            const parts = String(newToken).split('.');
            if (parts.length === 3) {
              try {
                const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                const exp = payload && payload.exp ? Number(payload.exp) : null;
                if (exp) {
                  const nowSec = Math.floor(Date.now() / 1000);
                  const buffer = Number(process.env.VITE_TOKEN_REFRESH_BUFFER_SEC || 60);
                  const msUntil = (exp - nowSec - buffer) * 1000;
                  if (msUntil > 0) {
                    refreshTimerRef.current = setTimeout(() => {
                      tryRefresh();
                    }, msUntil);
                  }
                }
              } catch (e) {}
            }
          }
        } catch (e) {}
      }
    })();

    return refreshPromiseRef.current;
  }, [refreshing, logout, fetchMe, i18n]);

  const apiFetch = useCallback(
    async (url, options = {}) => {
      const headers = { ...(options.headers || {}) };
      const access = window.__ACCESS_TOKEN || localStorage.getItem("authToken");
      if (access) headers["Authorization"] = `Bearer ${access}`;
      // Create an AbortController for this request so we can cancel on logout
      const controller = new AbortController();
      pendingControllersRef.current.add(controller);
      let res;
      try {
        res = await fetch(url, {
          ...options,
          headers,
          credentials: "include",
          signal: controller.signal,
        });
      } catch (err) {
        // remove controller and rethrow
        pendingControllersRef.current.delete(controller);
        throw err;
      }

      // If unauthorized, attempt refresh (serialized)
      if (res && res.status === 401) {
        const ok = await (refreshPromiseRef.current || tryRefresh());
        if (!ok) {
          pendingControllersRef.current.delete(controller);
          return res;
        }
        // rebuild headers with new token and retry
        const newAccess = window.__ACCESS_TOKEN || localStorage.getItem("authToken");
        const retryHeaders = { ...(options.headers || {}) };
        if (newAccess) retryHeaders["Authorization"] = `Bearer ${newAccess}`;

        // Abort the original controller and remove it
        try { controller.abort(); } catch (_) {}
        pendingControllersRef.current.delete(controller);

        const retryController = new AbortController();
        pendingControllersRef.current.add(retryController);
        try {
          const retr = await fetch(url, {
            ...options,
            headers: retryHeaders,
            credentials: "include",
            signal: retryController.signal,
          });
          pendingControllersRef.current.delete(retryController);
          return retr;
        } catch (err) {
          pendingControllersRef.current.delete(retryController);
          throw err;
        }
      }

      pendingControllersRef.current.delete(controller);
      return res;
    },
    [tryRefresh]
  );

  const updateUser = useCallback(
    (updatedUserData, newToken) => {
      // Always ignore any 'darkMode' key coming from callers (we keep theme in ThemeContext/localStorage)
      const sanitized = { ...(updatedUserData || {}) };
      if (Object.prototype.hasOwnProperty.call(sanitized, "darkMode"))
        delete sanitized.darkMode;

      const merged = { ...normalizeStoredUserRaw(), ...sanitized };

      // Ensure merged contains no darkMode
      if (Object.prototype.hasOwnProperty.call(merged, "darkMode"))
        delete merged.darkMode;

      setUser(merged);
      persistUserToStorage(merged);

      if (newToken) {
        setToken(newToken);
        localStorage.setItem("authToken", newToken);
        window.__ACCESS_TOKEN = newToken;
      }

      if (merged?.language) i18n.changeLanguage(merged.language);
    },
    [i18n]
  );

  const value = {
    user,
    token,
    login,
    logout,
    apiFetch,
    tryRefresh,
    updateUserContext: updateUser,
    updateUser,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
export default AuthContext;
