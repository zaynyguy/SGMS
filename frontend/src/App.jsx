// src/App.jsx
import React, { Suspense } from 'react';
import { Routes, Route, BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

import ProtectedRoute from './components/layout/PrivateRoute';
import MainLayout from './components/layout/MainLayout';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AccessDeniedPage from './pages/AccessDeniedPage';
import UserSettingsPage from './pages/SettingsPage';
import SystemSettingsPage from './pages/SystemSettingsPage'
import AuditLogPage from  './pages/AuditLogPage'
import ReportPage from './pages/ReportPage';
import AccessManagementPage from './pages/AccessManagementPage';
import ProjectManagement from './pages/ProjectManagementPage';
import AttachmentManager from './pages/AttachmentPage';
import NotificationsPanel from './pages/NotificationPage';


function App() {
    return (
        // Wrap with Suspense for i18next translations to load
        <Suspense fallback="Loading...">
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/" element={<LoginPage />} />
                        <Route path="/access-denied" element={<AccessDeniedPage />} />

                        {/* Protected Routes Layout */}
                        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                            {/* No special permissions needed */}
                            <Route path='/dashboard' element={<DashboardPage />} />
                            <Route path="/settings" element={<UserSettingsPage />} /> {/* Add settings route */}
                          

                            {/* Admin Routes with specific permissions */}
                            <Route
                                path="/systemsettings"
                                element={
                                    <ProtectedRoute requiredPermission="manage_settings">
                                        <SystemSettingsPage />
                                    </ProtectedRoute>
                                }
                            />
                           
                            <Route
                                path="/auditlog"
                                element={
                                    <ProtectedRoute requiredPermission="view_audit_logs">
                                        <AuditLogPage />
                                    </ProtectedRoute>
                                }
                            />
                            
                            <Route
                                path="/accessmanagement"
                                element={
                                    <ProtectedRoute requiredPermission="manage_access">
                                        <AccessManagementPage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/report"
                                element={
                                    <ProtectedRoute requiredPermission="manage_reports">
                                        <ReportPage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/project"
                                element={
                                    <ProtectedRoute requiredPermission="view_gta">
                                        <ProjectManagement />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/attachment"
                                element={
                                    <ProtectedRoute requiredPermission="manage_attachments">
                                        <AttachmentManager />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/notification"
                                element={
                                    <ProtectedRoute requiredPermission="manage_attachments">
                                        <NotificationsPanel />
                                    </ProtectedRoute>
                                }
                            />
                        </Route>
                        
                        {/* Add a 404 Not Found page here if you want */}
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </Suspense>
    );
}

export default App;
