import React, { createContext, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { loginUser as apiLoginUser, logoutUser } from "../api/auth";
import { applyTheme } from "../uites/applyTheme";

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
    // Keep stored user but do NOT overwrite theme (localStorage.theme) unless the caller explicitly provided darkMode
    const existing = normalizeStoredUserRaw();
    const merged = { ...existing, ...userObj };
    // Remove darkMode key unless the merged object explicitly included it (we preserve whatever caller passed)
    // However, we will keep any darkMode if provided intentionally by the caller.
    localStorage.setItem("user", JSON.stringify(merged));
  } catch (e) {
    // ignore storage errors
  }
}

function resolvedThemeFromStorageOrIncoming(incoming) {
  const ls = localStorage.getItem("theme");
  if (ls === "dark" || ls === "light") return ls;
  // if incoming explicitly provided darkMode boolean, map it
  if (incoming && Object.prototype.hasOwnProperty.call(incoming, "darkMode")) {
    return incoming.darkMode ? "dark" : "light";
  }
  return "system";
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("authToken") || null);
  const [loading, setLoading] = useState(true);
  const { i18n } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const storedUserRaw = localStorage.getItem("user");
    if (token && storedUserRaw) {
      try {
        const parsedUser = JSON.parse(storedUserRaw);
        setUser(parsedUser);
        if (parsedUser?.language) i18n.changeLanguage(parsedUser.language);
      } catch {
        localStorage.removeItem("user");
      }
    }
    // apply theme from localStorage if set, otherwise system
    const lsTheme = localStorage.getItem("theme");
    if (lsTheme === "dark" || lsTheme === "light") {
      applyTheme(lsTheme);
    } else {
      applyTheme("system");
    }
    if (token) window.__ACCESS_TOKEN = token;
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, i18n]);

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

  const login = useCallback(
    async (username, password) => {
      try {
        const response = await apiLoginUser(username, password);
        const { token: newToken, user: loggedInUser } = response || {};

        let fullUser = loggedInUser;
        if (!fullUser || !Array.isArray(fullUser.permissions)) {
          const me = await fetchMe(newToken);
          if (me) fullUser = me;
        }

        const safeUser = {
          id: fullUser?.id,
          username: fullUser?.username,
          name: fullUser?.name,
          role: fullUser?.role,
          permissions: Array.isArray(fullUser?.permissions) ? fullUser.permissions : [],
          language: fullUser?.language,
          // intentionally DO NOT trust server darkMode by default — remove storing darkMode here
          profilePicture: fullUser?.profilePicture || fullUser?.profilePic || "",
        };

        localStorage.setItem("authToken", newToken);
        persistUserToStorage(safeUser);
        setToken(newToken);
        setUser(safeUser);
        window.__ACCESS_TOKEN = newToken;

        if (safeUser?.language) i18n.changeLanguage(safeUser.language);

        // Apply theme from localStorage if present, otherwise keep system
        const theme = resolvedThemeFromStorageOrIncoming(null);
        applyTheme(theme);

        return { token: newToken, user: safeUser };
      } catch (error) {
        console.error("Login failed:", error);
        throw error;
      }
    },
    [fetchMe, i18n]
  );

  const logout = useCallback(async () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    window.__ACCESS_TOKEN = null;
    applyTheme("system");
    try {
      await logoutUser();
    } catch (_) {}
  }, []);

  const tryRefresh = useCallback(async () => {
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

      // preserve theme from localStorage unless server intentionally provided darkMode (we ignore by default)
      const theme = resolvedThemeFromStorageOrIncoming(null);
      applyTheme(theme);

      setRefreshing(false);
      return true;
    } catch (err) {
      console.error("Refresh failed", err);
      setRefreshing(false);
      await logout();
      return false;
    }
  }, [refreshing, logout, fetchMe]);

  const apiFetch = useCallback(
    async (url, options = {}) => {
      const headers = { ...(options.headers || {}) };
      const access = window.__ACCESS_TOKEN || localStorage.getItem("authToken");
      if (access) headers["Authorization"] = `Bearer ${access}`;

      const res = await fetch(url, {
        ...options,
        headers,
        credentials: "include",
      });

      if (res.status === 401) {
        const ok = await tryRefresh();
        if (!ok) return res;
        const retriedHeaders = { ...(options.headers || {}) };
        const newAccess = window.__ACCESS_TOKEN || localStorage.getItem("authToken");
        if (newAccess) retriedHeaders["Authorization"] = `Bearer ${newAccess}`;
        return fetch(url, {
          ...options,
          headers: retriedHeaders,
          credentials: "include",
        });
      }
      return res;
    },
    [tryRefresh]
  );

  const updateUser = useCallback(
    (updatedUserData, newToken) => {
      const existing = normalizeStoredUserRaw();
      // Merge values but DO NOT overwrite theme unless caller explicitly included darkMode key
      const merged = { ...existing, ...updatedUserData };

      // If incoming data explicitly contains darkMode, respect it and write theme
      if (Object.prototype.hasOwnProperty.call(updatedUserData || {}, "darkMode")) {
        const theme = updatedUserData.darkMode ? "dark" : "light";
        applyTheme(theme);
        localStorage.setItem("theme", theme);
        merged.darkMode = updatedUserData.darkMode;
      } else {
        // preserve existing theme and don't write darkMode onto stored user
        const ls = localStorage.getItem("theme");
        if (ls === "dark" || ls === "light") {
          // keep theme in storage as-is; do not set merged.darkMode based on server
          delete merged.darkMode;
        } else {
          delete merged.darkMode;
        }
        // ensure UI theme remains whatever localStorage currently says
        const theme = resolvedThemeFromStorageOrIncoming(null);
        applyTheme(theme);
      }

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

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export default AuthContext;
