import React, { createContext, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { loginUser as apiLoginUser, logoutUser as apiLogoutUser } from "../api/auth";

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
    if (Object.prototype.hasOwnProperty.call(merged, "darkMode")) delete merged.darkMode;
    localStorage.setItem("user", JSON.stringify(merged));
  } catch (e) {
    // ignore storage errors
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("authToken") || null);
  const [loading, setLoading] = useState(true);
  const { i18n } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const stored = normalizeStoredUserRaw();
    if (token && stored && Object.keys(stored).length) {
      setUser(stored);
      if (stored.language) i18n.changeLanguage(stored.language);
    }
    // Do NOT apply any theme here — ThemeProvider is the single source of truth.
    if (token) window.__ACCESS_TOKEN = token;
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchMe = useCallback(async (accessToken) => {
    try {
      const resp = await fetch(`${API_URL}/api/auth/me`, {
        method: "GET",
        headers: { Accept: "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
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
        permissions: Array.isArray(fullUser?.permissions) ? fullUser.permissions : [],
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
    try {
      await apiLogoutUser();
    } catch (_) {
      // ignore
    }
  }, []);

  const tryRefresh = useCallback(
    async () => {
      if (refreshing) return false;
      setRefreshing(true);
      try {
        const r = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!r.ok) {
          setRefreshing(false);
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
          permissions: Array.isArray(newUser?.permissions) ? newUser.permissions : [],
          language: newUser?.language,
          profilePicture: newUser?.profilePicture || "",
        };

        window.__ACCESS_TOKEN = newToken;
        localStorage.setItem("authToken", newToken);
        persistUserToStorage(safeUser);
        setToken(newToken);
        setUser(safeUser);
        if (safeUser?.language) i18n.changeLanguage(safeUser.language);

        setRefreshing(false);
        return true;
      } catch (err) {
        console.error("Refresh failed", err);
        setRefreshing(false);
        await logout();
        return false;
      }
    },
    [refreshing, logout, fetchMe, i18n]
  );

  const apiFetch = useCallback(
    async (url, options = {}) => {
      const headers = { ...(options.headers || {}) };
      const access = window.__ACCESS_TOKEN || localStorage.getItem("authToken");
      if (access) headers["Authorization"] = `Bearer ${access}`;

      let res = await fetch(url, {
        ...options,
        headers,
        credentials: "include",
      });

      if (res.status === 401) {
        const ok = await tryRefresh();
        if (!ok) return res;
        const newAccess = window.__ACCESS_TOKEN || localStorage.getItem("authToken");
        if (newAccess) headers["Authorization"] = `Bearer ${newAccess}`;
        return fetch(url, {
          ...options,
          headers,
          credentials: "include",
        });
      }
      return res;
    },
    [tryRefresh]
  );

  const updateUser = useCallback((updatedUserData, newToken) => {
    // Always ignore any 'darkMode' key coming from callers (we keep theme in ThemeContext/localStorage)
    const sanitized = { ...(updatedUserData || {}) };
    if (Object.prototype.hasOwnProperty.call(sanitized, "darkMode")) delete sanitized.darkMode;

    const merged = { ...normalizeStoredUserRaw(), ...sanitized };

    // Ensure merged contains no darkMode
    if (Object.prototype.hasOwnProperty.call(merged, "darkMode")) delete merged.darkMode;

    setUser(merged);
    persistUserToStorage(merged);

    if (newToken) {
      setToken(newToken);
      localStorage.setItem("authToken", newToken);
      window.__ACCESS_TOKEN = newToken;
    }

    if (merged?.language) i18n.changeLanguage(merged.language);
  }, [i18n]);

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

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
export default AuthContext;
