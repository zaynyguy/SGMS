import React from "react";

export default function StatusBadge({ status }) {
  const normalized = (status || "").toString().toLowerCase().replace(/\s+/g, "-");
  const statusClasses = {
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    "in-progress": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    "not-started": "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  };
  const cls = statusClasses[normalized] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls} whitespace-nowrap`}>{status ? String(status).replace(/-/g, " ") : "N/A"}</span>
  );
}
