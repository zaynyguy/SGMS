import React, { createContext, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { loginUser as apiLoginUser } from "../api/auth";
import { applyTheme } from "../uites/applyTheme";

const API_URL = import.meta.env.VITE_API_URL || "";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // keep token in state for compatibility; we also put short-lived token on window.__ACCESS_TOKEN
  const [token, setToken] = useState(localStorage.getItem("authToken") || null);
  const [loading, setLoading] = useState(true);
  const { i18n } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);

        if (parsedUser?.language) i18n.changeLanguage(parsedUser.language);
        applyTheme(parsedUser?.darkMode ?? "system");
      } catch {
        localStorage.removeItem("user");
      }
    } else {
      applyTheme("system");
    }
    // set window global for api helper to pick up
    if (token) window.__ACCESS_TOKEN = token;
    setLoading(false);
  }, [token, i18n]);

  // helper: fetch canonical /api/auth/me (returns user) — used only as a fallback
  const fetchMe = useCallback(
    async (accessToken) => {
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
      } catch (e) {
        return null;
      }
    },
    [API_URL]
  );

  // call the backend login endpoint (apiLoginUser) and handle tokens/cookies
  const login = useCallback(
    async (username, password) => {
      try {
        const response = await apiLoginUser(username, password);
        // backend usually returns { token, user }
        const { token: newToken, user: loggedInUser } = response || {};

        // if user is partial (e.g. only { profilePicture: ... }) try to fetch canonical /me
        let fullUser = loggedInUser;
        if (!fullUser || !Array.isArray(fullUser.permissions)) {
          const me = await fetchMe(newToken);
          if (me) fullUser = me;
        }

        // create a safe user object to persist (avoid storing unexpected fields)
        const safeUser = {
          id: fullUser?.id,
          username: fullUser?.username,
          name: fullUser?.name,
          role: fullUser?.role,
          permissions: Array.isArray(fullUser?.permissions) ? fullUser.permissions : [],
          language: fullUser?.language,
          darkMode: fullUser?.darkMode,
          profilePicture: fullUser?.profilePicture || fullUser?.profilePic || "",
        };

        // keep localStorage for compatibility with code that expects it
        localStorage.setItem("authToken", newToken);
        localStorage.setItem("user", JSON.stringify(safeUser));
        setToken(newToken);
        setUser(safeUser);

        // set in-memory access token (preferred by api layer)
        window.__ACCESS_TOKEN = newToken;

        if (safeUser?.language) i18n.changeLanguage(safeUser.language);
        applyTheme(safeUser?.darkMode ?? "system");
        return { token: newToken, user: safeUser };
      } catch (error) {
        console.error("Login failed:", error);
        throw error;
      }
    },
    [fetchMe, i18n]
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    } catch (_) {}
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    window.__ACCESS_TOKEN = null;
    applyTheme("system");
  }, []);

  // Trying to refresh access token using the refresh cookie
  const tryRefresh = useCallback(
    async () => {
      // guarding to prevent concurrent refreshes
      if (refreshing) return false;
      setRefreshing(true);
      try {
        const r = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include", // sends httpOnly refresh cookie
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

        // If server returned a partial user, try to fetch canonical /me
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
          darkMode: newUser?.darkMode,
          profilePicture: newUser?.profilePicture || "",
        };

        // updates both in-memory and localStorage for compatibility
        window.__ACCESS_TOKEN = newToken;
        localStorage.setItem("authToken", newToken);
        localStorage.setItem("user", JSON.stringify(safeUser));
        setToken(newToken);
        setUser(safeUser);
        setRefreshing(false);
        return true;
      } catch (err) {
        console.error("Refresh failed", err);
        setRefreshing(false);
        await logout();
        return false;
      }
    },
    [refreshing, logout, fetchMe]
  );

  // Low-level fetch wrapper: adds Authorization header and attempts one refresh on 401
  const apiFetch = useCallback(
    async (url, options = {}) => {
      const headers = { ...(options.headers || {}) };
      const access = window.__ACCESS_TOKEN || localStorage.getItem("authToken");
      if (access) headers["Authorization"] = `Bearer ${access}`;

      const res = await fetch(url, { ...options, headers, credentials: "include" });

      if (res.status === 401) {
        const ok = await tryRefresh();
        if (!ok) return res;
        const retriedHeaders = { ...(options.headers || {}) };
        const newAccess = window.__ACCESS_TOKEN || localStorage.getItem("authToken");
        if (newAccess) retriedHeaders["Authorization"] = `Bearer ${newAccess}`;
        return fetch(url, { ...options, headers: retriedHeaders, credentials: "include" });
      }
      return res;
    },
    [tryRefresh]
  );

  const updateUser = useCallback((updatedUserData, newToken) => {
    // updatedUserData might be a full user or a partial patch. We persist what is passed.
    setUser(updatedUserData);
    localStorage.setItem("user", JSON.stringify(updatedUserData));
    if (newToken) {
      setToken(newToken);
      localStorage.setItem("authToken", newToken);
      window.__ACCESS_TOKEN = newToken;
    }
    if (updatedUserData?.language) i18n.changeLanguage(updatedUserData.language);
    applyTheme(updatedUserData?.darkMode ?? "system");
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
