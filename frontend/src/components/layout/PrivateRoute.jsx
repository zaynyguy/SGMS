import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import AccessDeniedPage from '../../pages/AccessDeniedPage';

const ProtectedRoute = ({ children, requiredPermission }) => {
  const { isAuthenticated, user } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && !user?.permissions?.includes(requiredPermission)) {
    return <AccessDeniedPage message={t('forbidden')} />;
  }

  return children;
};

export default ProtectedRoute

// u will this in the app.jsx
// <Route 
//   path="/admin" 
//   element={
//     <ProtectedRoute requiredPermission="manage_users">
//       <AdminDashboard />
//     </ProtectedRoute>
//   } 
// />