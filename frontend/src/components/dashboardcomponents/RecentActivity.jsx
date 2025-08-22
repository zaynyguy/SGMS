import React from 'react';

export default function RecentActivityList() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 h-full">
      <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
      <div className="overflow-y-auto h-64">
        <p className="text-gray-500 dark:text-gray-400">Recent activities table/list goes here.</p>
      </div>
    </div>
  );
}