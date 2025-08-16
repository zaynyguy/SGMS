import React, { createContext, useState, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { loginUser } from '../api/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [loading, setLoading] = useState(true);
  const { i18n } = useTranslation();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        if (parsedUser?.language) i18n.changeLanguage(parsedUser.language);
      } catch {
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, [token, i18n]);

  const login = async (username, password) => {
    try {
      const response = await loginUser(username, password);
      const { token: newToken, user: loggedInUser } = response;

      localStorage.setItem('authToken', newToken);
      localStorage.setItem('user', JSON.stringify(loggedInUser));
      setToken(newToken);
      setUser(loggedInUser);

      if (loggedInUser?.language) await i18n.changeLanguage(loggedInUser.language);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const updateUserContext = (updatedUserData) => {
    setUser((prevUser) => {
      const newUser = { ...prevUser, ...updatedUserData };
      localStorage.setItem('user', JSON.stringify(newUser));
      if (updatedUserData?.language && updatedUserData.language !== i18n.language) {
        i18n.changeLanguage(updatedUserData.language);
      }
      return newUser;
    });
  };

  const value = { user, token, login, logout, updateUserContext, isAuthenticated: !!user };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
