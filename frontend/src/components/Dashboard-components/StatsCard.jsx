import React from "react";

export default function StatsCard({ title, value, iconClass, icon, trend, trendColor, }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center">
      <div className="w-12 h-12 rounded-lg flex items-center justify-center mr-4 bg-gray-100 dark:bg-gray-700">
        {/* If icon element is passed, render it; otherwise use iconClass */}
        {icon ? (
          icon
        ) : (
          <div className={`${iconClass}`} />
        )}
      </div>
      <div>
        <h3 className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          {title}
        </h3>
        <p className="text-2xl font-bold text-gray-800 dark:text-white">
          {value}
        </p>
        {trend && (
          <p className={`text-sm ${trendColor} mt-1`}>
            {trend}
          </p>
        )}
      </div>
    </div>
  );
}
