// src/App.jsx
import React, { Suspense } from 'react';
import { Routes, Route, BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

import ProtectedRoute from './components/layout/PrivateRoute';
import MainLayout from './components/layout/MainLayout';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AccessDeniedPage from './pages/AccessDeniedPage';
import UserSettingsPage from './pages/UserSettingsPage';
import GroupsManagementPage from './pages/GroupsManagementPage'
import GoalsManagementPage from './pages/GoalsManagement'
import SystemSettingsPage from './pages/SystemSettingsPage'
import UsersManagementPage from './pages/UsersManagementPage';
import RoleManagementPage from './pages/RolesManagementPage';
import AuditLogPage from  './pages/AuditLogPage'
import TasksManagementPage from './pages/TasksManagementPage'
import ActivityPage from './pages/ActivityPage'
import ReportPage from './pages/ReportPage';

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
                            <Route path="/GoalsManagement" element={<GoalsManagementPage />} /> {/* Add settings route */}
                            <Route path="/GroupsManagement" element={<GroupsManagementPage />} /> {/* Add settings route */}

                            {/* Admin Routes with specific permissions */}
                            <Route
                                path="/systemsettings"
                                element={
                                    <ProtectedRoute requiredPermission="manage_roles">
                                        <SystemSettingsPage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/usersmanagement"
                                element={
                                    <ProtectedRoute requiredPermission="manage_roles">
                                        <UsersManagementPage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/rolesmanagement"
                                element={
                                    <ProtectedRoute requiredPermission="manage_roles">
                                        <RoleManagementPage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/auditlog"
                                element={
                                    <ProtectedRoute requiredPermission="manage_roles">
                                        <AuditLogPage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/tasksmanagement"
                                element={
                                    <ProtectedRoute requiredPermission="manage_roles">
                                        <TasksManagementPage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/activity"
                                element={
                                    <ProtectedRoute requiredPermission="manage_roles">
                                        <ActivityPage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/report"
                                element={
                                    <ProtectedRoute requiredPermission="manage_roles">
                                        <ReportPage />
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
