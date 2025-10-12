import React from "react";

export default function SkeletonCard({ rows = 3 }) {
  return (
    <div className="animate-pulse w-full">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-100 dark:border-gray-700 shadow-sm mb-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded bg-gray-300 dark:bg-gray-700" />
          <div className="flex-1 space-y-3 py-1">
            <div className="h-5 w-2/3 bg-gray-300 dark:bg-gray-700 rounded" />
            <div className="h-4 w-1/3 bg-gray-300 dark:bg-gray-700 rounded" />
            <div className="flex gap-2 items-center">
              <div className="h-3 w-20 bg-gray-300 dark:bg-gray-700 rounded" />
              <div className="h-3 w-16 bg-gray-300 dark:bg-gray-700 rounded" />
              <div className="h-3 w-10 bg-gray-300 dark:bg-gray-700 rounded" />
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded bg-gray-300 dark:bg-gray-700" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 w-2/3 bg-gray-300 dark:bg-gray-700 rounded" />
                <div className="h-3 w-1/3 bg-gray-300 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
