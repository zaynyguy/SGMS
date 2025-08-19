import React, { createContext, useState, useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { loginUser as apiLoginUser } from "../api-endpoints/auth";
import { applyTheme } from "../uites/applyTheme";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("authToken"));
  const [loading, setLoading] = useState(true);
  const { i18n } = useTranslation();

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);

        // Apply language
        if (parsedUser?.language) {
          i18n.changeLanguage(parsedUser.language);
        }

        // Apply theme
        applyTheme(parsedUser?.darkMode ?? "system");
      } catch {
        localStorage.removeItem("user");
      }
    } else {
      applyTheme("system");
    }
    setLoading(false);
  }, [token, i18n]);

  const login = async (username, password) => {
    try {
      const response = await apiLoginUser(username, password);
      const { token: newToken, user: loggedInUser } = response;

      localStorage.setItem("authToken", newToken);
      localStorage.setItem("user", JSON.stringify(loggedInUser));
      setToken(newToken);
      setUser(loggedInUser);

      // Apply language and theme
      if (loggedInUser?.language) i18n.changeLanguage(loggedInUser.language);
      applyTheme(loggedInUser?.darkMode ?? "system");
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    applyTheme("system");
  };

  // ✅ Updated function for UserSettings changes
  const updateUser = (updatedUserData, newToken) => {
    setUser(updatedUserData);
    localStorage.setItem("user", JSON.stringify(updatedUserData));

    if (newToken) {
      setToken(newToken);
      localStorage.setItem("authToken", newToken);
    }

    // Apply language immediately after update
    if (updatedUserData?.language) {
      i18n.changeLanguage(updatedUserData.language);
    }

    // Apply theme
    applyTheme(updatedUserData?.darkMode ?? "system");
  };

  const value = {
    user,
    token,
    login,
    logout,
    updateUserContext: updateUser,
    updateUser,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
