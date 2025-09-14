// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AccessDeniedPage from "../../pages/AccessDeniedPage";


const ProtectedRoute = ({ children, requiredPermission }) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  // 1. Not authenticated -> redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // 2. If requiredPermission provided: allow if user has any of them
  if (requiredPermission) {
    const required = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const hasAny = Array.isArray(user?.permissions) && required.some((p) => user.permissions.includes(p));
    if (!hasAny) {
      return <AccessDeniedPage />;
    }
  }

  // 3. All good
  return children;
};

export default ProtectedRoute;
