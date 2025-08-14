// src/App.jsx
import React, { Suspense } from 'react';
import { Routes, Route, BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

import ProtectedRoute from './components/layout/PrivateRoute';
import MainLayout from './components/layout/MainLayout';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AccessDeniedPage from './pages/AccessDeniedPage';
import UserSettingsPage from './pages/UserSettingsPage'; // Import the new page
import Admin from './pages/AdminPage';


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
                                path="/admin"
                                element={
                                    <ProtectedRoute requiredPermission="manage_roles">
                                        <Admin />
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
