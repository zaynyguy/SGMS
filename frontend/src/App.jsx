// src/App.jsx
import React, { Suspense } from "react";
import { Routes, Route, BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SidebarProvider } from "./context/SidebarContext";

import ProtectedRoute from "./components/layout/PrivateRoute";
import MainLayout from "./components/layout/MainLayout";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AccessDeniedPage from "./pages/AccessDeniedPage";
import UserSettingsPage from "./pages/SettingsPage";
import SystemSettingsPage from "./pages/SystemSettingsPage";
import AuditLogPage from "./pages/AuditLogPage";
import UserManagementPage from "./pages/UsersManagementPage";
import RoleManagementPage from "./pages/RolesManagementPage";
import GroupManagementPage from "./pages/GroupsManagementPage";
import ReportReviewPage from "./pages/ReportReviewPage";
import MasterReportPage from "./pages/MasterReportPage";
import ProjectManagement from "./pages/ProjectManagementPage";
import AttachmentManager from "./pages/AttachmentPage";
import NotificationsPanel from "./pages/NotificationPage";
import ChatPage from "./pages/ChatPage";

function App() {
  return (
    // Wrap with Suspense for i18next translations to load
    <Suspense fallback="Loading...">
      <SidebarProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LoginPage />} />
              <Route path="/access-denied" element={<AccessDeniedPage />} />

              {/* Protected Routes Layout */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                {/* No special permissions needed */}
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/settings" element={<UserSettingsPage />} />
                <Route path="/chat" element={<ChatPage />} />
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
                  path="/accessmanagement/usermanagement"
                  element={
                    <ProtectedRoute requiredPermission="manage_access">
                      <UserManagementPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/accessmanagement/rolemanagement"
                  element={
                    <ProtectedRoute requiredPermission="manage_access">
                      <RoleManagementPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/accessmanagement/groupmanagement"
                  element={
                    <ProtectedRoute requiredPermission="manage_access">
                      <GroupManagementPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/report/review"
                  element={
                    <ProtectedRoute requiredPermission="manage_reports">
                      <ReportReviewPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/report/master"
                  element={
                    <ProtectedRoute requiredPermission="manage_reports">
                      <MasterReportPage />
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
                    <ProtectedRoute requiredPermission="manage_notifications">
                      <NotificationsPanel />
                    </ProtectedRoute>
                  }
                />
              </Route>
              

              {/* Add a 404 Not Found page here if you want */}
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </SidebarProvider>
    </Suspense>
  );
}

export default App;
