import React from "react";

export default function ProgressBar({ progress = 0, variant = "normal" }) {
  const pct = Math.max(0, Math.min(100, Number(progress || 0)));
  const isGoal = variant === "goal";
  const heightClass = isGoal ? "h-5" : "h-4";
  const fillGradient = isGoal ? "bg-gradient-to-r from-indigo-500 to-indigo-600" : "bg-gradient-to-r from-sky-400 to-indigo-500";
  const labelInFill = pct >= 30;
  const labelClass = labelInFill ? "text-black dark:text-white font-medium text-xs" : "text-black dark:text-white font-medium text-xs";

  return (
    <div className={`relative ${heightClass} rounded-md overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Progress ${pct}%`}>
      <div className={`absolute left-0 top-0 bottom-0 ${fillGradient} transition-all duration-500 ease-out`} style={{ width: `${pct}%` }} />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-2">
        <span className={labelClass}>{pct}%</span>
      </div>
    </div>
  );
}
