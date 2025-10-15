import React from 'react';

export default function QuickActionsPanel() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 h-full">
      <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
      <button className="w-full mb-2 py-2 rounded-lg text-white bg-gray-800 dark:text-gray-800 dark:bg-white">Generate New Report</button>
      <button className="w-full mb-2 py-2 rounded-lg text-white bg-gray-800 dark:text-gray-800 dark:bg-white">Merge Reports</button>
      <button className="w-full mb-2 py-2 rounded-lg text-white bg-gray-800 dark:text-gray-800 dark:bg-white">Create New Project</button>
      <button className="w-full mb-2 py-2 rounded-lg text-white bg-gray-800 dark:text-gray-800 dark:bg-white">Upload Attachment</button>
    </div>
  );
}