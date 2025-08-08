// src/auth/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null); // store full user object

  useEffect(() => {
    // Rehydrate auth state from localStorage
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken) setToken(storedToken);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('user');
      }
    }
  }, []);

  const saveAuth = ({ token, user }) => {
    setToken(token);
    setUser(user);
    localStorage.setItem('token', token);
    // Persist full user object
    localStorage.setItem('user', JSON.stringify(user));
  };

  const clearAuth = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // Derive role and permissions from user object
  const role = user?.role || null;
  const permissions = user?.permissions || [];

  return (
    <AuthContext.Provider value={{ token, user, role, permissions, saveAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthProvider