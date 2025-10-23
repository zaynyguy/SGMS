// CalendarControls.jsx
import React, { useState, useEffect } from "react";

export const LOCALSTORAGE_KEY = "master_report_qstart";

export default function CalendarControls({ granularity = "quarterly", initial = {}, onChange }) {
  const [calendarSystem, setCalendarSystem] = useState(initial.calendarSystem || "gregorian");
  const [qStartMonth, setQStartMonth] = useState(initial.qStartMonth || 1);
  const [exportCalendar, setExportCalendar] = useState(initial.exportCalendar || "same");
  const [showPercent, setShowPercent] = useState(initial.showPercent || false);

  useEffect(() => {
    // persist qStartMonth to localStorage (only the qStart needed persistently per request)
    try {
      localStorage.setItem(LOCALSTORAGE_KEY, String(qStartMonth));
    } catch (e) {}
    if (onChange) {
      onChange({
        calendarSystem,
        qStartMonth,
        exportCalendar,
        showPercent,
      });
    }
  }, [calendarSystem, qStartMonth, exportCalendar, showPercent, onChange]);

  return (
    <div className="p-3 border rounded bg-white dark:bg-gray-900">
      <div className="flex items-center gap-2 mb-2">
        <label className="text-xs text-gray-600 dark:text-gray-300 w-24">Calendar</label>
        <select value={calendarSystem} onChange={(e) => setCalendarSystem(e.target.value)} className="px-2 py-1 rounded border bg-white dark:bg-gray-800 text-sm">
          <option value="gregorian">Gregorian</option>
          <option value="ethiopian">Ethiopian (EC)</option>
        </select>
      </div>

      {granularity === "quarterly" && (
        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs text-gray-600 dark:text-gray-300 w-24">Q1 starts</label>
          <select value={String(qStartMonth)} onChange={(e) => setQStartMonth(Number(e.target.value))} className="px-2 py-1 rounded border bg-white dark:bg-gray-800 text-sm">
            {/* months 1..12 (for EC months you can still use 1..13 when using Ethiopian calendar in normalization code) */}
            <option value="1">Month 1</option>
            <option value="2">Month 2</option>
            <option value="3">Month 3</option>
            <option value="4">Month 4</option>
            <option value="5">Month 5</option>
            <option value="6">Month 6</option>
            <option value="7">Month 7</option>
            <option value="8">Month 8</option>
            <option value="9">Month 9</option>
            <option value="10">Month 10</option>
            <option value="11">Month 11</option>
            <option value="12">Month 12</option>
            {/* If you want to support EC month 13 (Pagume), add option value="13" */}
          </select>
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <label className="text-xs text-gray-600 dark:text-gray-300 w-24">Export as</label>
        <select value={exportCalendar} onChange={(e) => setExportCalendar(e.target.value)} className="px-2 py-1 rounded border bg-white dark:bg-gray-800 text-sm">
          <option value="same">Same as UI</option>
          <option value="gregorian">Force Gregorian</option>
          <option value="ethiopian">Force Ethiopian (EC)</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-600 dark:text-gray-300 w-24">Show %</label>
        <input type="checkbox" checked={showPercent} onChange={(e) => setShowPercent(e.target.checked)} />
      </div>
    </div>
  );
}
