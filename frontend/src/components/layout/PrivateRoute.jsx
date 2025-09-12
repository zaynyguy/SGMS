// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AccessDeniedPage from '../../pages/AccessDeniedPage';

/**
 * This component now checks for authentication AND authorization.
 * @param {string} requiredPermission - The permission required to access this route.
 */
const ProtectedRoute = ({ children, requiredPermission }) => {
    const { isAuthenticated, user } = useAuth();
    const location = useLocation();

    // 1. Check if the user is authenticated
    if (!isAuthenticated) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // 2. Check if a required permission is provided and if the user has it
    if (requiredPermission && !user?.permissions?.includes(requiredPermission)) {
        // User is logged in but doesn't have the necessary permission
        return <AccessDeniedPage />;
    }

    // If all checks pass, render the requested component
    return children;
};

export default ProtectedRoute;