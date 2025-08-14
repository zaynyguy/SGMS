// src/pages/AccessDeniedPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const AccessDeniedPage = () => {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100 text-center">
            <h1 className="text-6xl font-bold text-red-600">403</h1>
            <h2 className="text-3xl font-semibold text-gray-800 mt-4">Access Denied</h2>
            <p className="text-gray-600 mt-2">
                Sorry, you do not have the required permissions to view this page.
            </p>
            <Link to="/" className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Go to Dashboard
            </Link>
        </div>
    );
};

export default AccessDeniedPage;
