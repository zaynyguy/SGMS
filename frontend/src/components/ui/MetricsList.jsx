// src/components/ui/MetricsList.jsx
import React from "react";
import PropTypes from "prop-types";

/**
 * Renders metrics that may be:
 * - object { key: value }
 * - JSON string
 * - array of { key, value }
 */
export default function MetricsList({ metrics }) {
  if (!metrics) return <div className="text-xs text-gray-400">—</div>;

  let obj = null;
  try {
    if (typeof metrics === "string") {
      obj = metrics.trim() === "" ? null : JSON.parse(metrics);
    } else if (Array.isArray(metrics)) {
      // convert to object for uniform rendering
      obj = metrics.reduce((acc, m) => {
        if (m && m.key) acc[m.key] = m.value;
        return acc;
      }, {});
    } else {
      obj = metrics;
    }
  } catch (err) {
    // fallback: show the raw string inside monospace
    return (
      <div className="text-xs font-mono break-words p-2 bg-white dark:bg-gray-900 rounded border text-gray-800 dark:text-gray-100">
        {String(metrics)}
      </div>
    );
  }

  if (!obj || typeof obj !== "object") {
    return <div className="text-xs text-gray-400">—</div>;
  }

  const keys = Object.keys(obj);
  if (keys.length === 0) return <div className="text-xs text-gray-400">—</div>;

  return (
    <div className="space-y-1">
      {keys.map((k) => (
        <div
          key={k}
          className="flex items-center justify-between bg-white dark:bg-gray-900 rounded px-2 py-1 border dark:border-gray-700"
        >
          <div className="text-xs text-gray-600 dark:text-gray-300">{k}</div>
          <div className="text-xs font-medium text-gray-900 dark:text-gray-100 break-words">{String(obj[k])}</div>
        </div>
      ))}
    </div>
  );
}

MetricsList.propTypes = {
  metrics: PropTypes.oneOfType([PropTypes.object, PropTypes.string, PropTypes.array]),
};
