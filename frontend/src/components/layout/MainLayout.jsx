// src/layouts/MainLayout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../layout/SideBar';

/**
 * This is the main layout for the authenticated part of the app.
 * It includes the sidebar and a content area where nested routes will be rendered.
 */
const MainLayout = () => {
    return (
        <div className="flex bg-gray-100 min-h-screen">
            <Sidebar />
            <main className="flex-1">
                {/* The Outlet component renders the active child route */}
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
