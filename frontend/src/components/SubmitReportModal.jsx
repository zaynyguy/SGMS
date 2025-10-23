// SubmitReportInline.jsx
import React, { useEffect, useState } from "react";
import { Loader, UploadCloud, Paperclip, X } from "lucide-react";

/**
* Props:
* - data: { goalId, taskId, activityId, targetMetric, currentMetric } // Now receives metrics
* - onClose: () => void
* - onSubmit: async (formState) => {}
* - loading: boolean
* - t: i18n function
*/
export default function SubmitReportInline({ data, onClose, onSubmit, loading, t }) {
  const { goalId, taskId, activityId, targetMetric, currentMetric } = data || {};
  const [narrative, setNarrative] = useState("");
  const [metricsArray, setMetricsArray] = useState([]); // Start empty, populate in useEffect
  const [newStatus, setNewStatus] = useState("");
  const [files, setFiles] = useState([]);
  const [localErr, setLocalErr] = useState(null);

  // Helper to generate a unique ID for React keys
  const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Helper to safely parse numbers
  const parseNum = (v, fallback = 0) => {
    const n = parseFloat(String(v));
    return Number.isNaN(n) ? fallback : n;
  };

  // This effect now populates the metric form from the 'data' prop
  useEffect(() => {
    setNarrative("");
    setNewStatus("");
    setFiles([]);
    setLocalErr(null);

    const targets = targetMetric || {};
    const currents = currentMetric || {};
    const targetKeys = Object.keys(targets);

    if (targetKeys.length > 0) {
      // Pre-populate metrics based on the activity's targetMetric
      const initialMetrics = targetKeys.map((key) => {
        const targetVal = parseNum(targets[key], null);
        const currentVal = parseNum(currents[key], 0);
        return {
          id: generateId(),
          key: key,
          value: "", // This is the 'amount to report' field, so it starts empty
          target: targetVal,
          current: currentVal,
          isPredefined: true, // Mark as predefined
        };
      });
      setMetricsArray(initialMetrics);
    } else {
      // If no target metrics, provide one blank, editable row
      setMetricsArray([{ id: generateId(), key: "", value: "", target: null, current: 0, isPredefined: false }]);
    }
  }, [activityId, targetMetric, currentMetric]); // Depend on metrics

  const onFileChange = (e) => setFiles(Array.from(e.target.files || []));

  const updateMetricRow = (idx, field, value) =>
    setMetricsArray((prev) => {
      const arr = [...prev];
      arr[idx] = { ...(arr[idx] || {}), [field]: value };
      return arr;
    });

  // Add a new, blank row for custom metric reporting
  const addMetricRow = () => setMetricsArray((p) => [...p, { id: generateId(), key: "", value: "", target: null, current: 0, isPredefined: false }]);

  // Remove a metric row
  const removeMetricRow = (idx) => setMetricsArray((p) => p.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLocalErr(null);

    // Validate: key is required if value is provided
    const hasInvalid = metricsArray.some((m) => m && String(m.key).trim() === "" && String(m.value).trim() !== "");
    if (hasInvalid) {
      setLocalErr(t("project.errors.metricKeyMissing") || "Metric name is required if a value is entered.");
      return;
    }

    // Validate: value must be a number
    const hasNaN = metricsArray.some((m) => m && String(m.value).trim() !== "" && isNaN(parseNum(m.value, NaN)));
    if (hasNaN) {
      setLocalErr(t("project.errors.metricValueNumeric") || "Metric value must be a number.");
      return;
    }

    await onSubmit({
      activityId,
      narrative,
      metricsArray, // Send the full array
      newStatus: newStatus || null,
      files,
      goalId,
      taskId,
    });
  };

  // --- RENDER ---
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      role="presentation"
      onClick={onClose} // Close on backdrop click
    >
      <form
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-report-title"
        onClick={(e) => e.stopPropagation()} // Prevent form click from closing modal
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <h3 id="submit-report-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("project.modal.submitReport") || "Submit Report"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("project.actions.close") || "Close"}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("project.labels.activity")}
            </label>
            <div className="mt-1 text-sm font-mono p-2 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-200">{activityId}</div>
          </div>

          <div>
            <label htmlFor="narrative" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("project.fields.narrative")}
            </label>
            <textarea
              id="narrative"
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              rows={4}
              className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Metrics Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("project.labels.metrics")}
            </label>
            <div className="mt-2 space-y-3">
              {metricsArray.map((m, idx) => {
                const remaining = m.target !== null ? m.target - m.current : null;
                return (
                <div key={m.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-md space-y-2">
                  <div className="flex gap-2 items-center">
                    <input
                      placeholder={t("project.placeholders.metricKey") || "Metric Key"}
                      value={m.key}
                      readOnly={m.isPredefined} // Key is read-only if it came from targetMetric
                      onChange={(e) => updateMetricRow(idx, "key", e.target.value)}
                      className={`flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white ${m.isPredefined ? 'bg-gray-100 dark:bg-gray-900' : 'bg-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'}`}
                    />
                    <input
                      type="number"
                      step="any"
                      min={0}
                      placeholder={t("project.placeholders.metricValueReport") || "Value to Report"}
                      value={m.value}
                      onChange={(e) => updateMetricRow(idx, "value", e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeMetricRow(idx)}
                      className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label={t("project.actions.removeShort") || "Remove"}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {/* Hint text for progress */}
                  {m.isPredefined && m.target !== null && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 pl-1">
                      {t("project.hints.metricRemaining", { current: m.current, target: m.target, remaining: remaining }) || `Current: ${m.current} / ${m.target} (Remaining: ${remaining})`}
                    </div>
                  )}
                </div>
              )})}
            </div>

            <button
              type="button"
              onClick={addMetricRow}
              className="mt-3 px-3 py-1 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              + {t("project.actions.addMetric") || "Add Metric"}
            </button>

            {localErr && <div className="text-xs text-red-500 mt-2">{localErr}</div>}
          </div>

          {/* FIXED: Status dropdown for Activities */}
          <div>
            <label htmlFor="newStatus" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("project.fields.newStatus")} {t("project.labels.optional", "(Optional)")}
            </label>
            <select
              id="newStatus"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">{t("project.noChange") || "(No Change)"}</option>
              <option value="To Do">{t("project.status.toDo") || "To Do"}</option>
              <option value="In Progress">{t("project.status.inProgress") || "In Progress"}</option>
              <option value="Done">{t("project.status.completed") || "Done"}</option>
            </select>
          </div>

          {/* File attachment UI */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("project.labels.attachments")}
            </label>
            <label
              htmlFor="file-upload"
              className="mt-2 flex justify-center items-center gap-2 px-6 py-4 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 bg-gray-50 dark:bg-gray-700/50"
            >
              <UploadCloud className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {t("project.actions.uploadFiles") || "Click to upload files"}
              </span>
            </label>
            <input id="file-upload" type="file" multiple onChange={onFileChange} className="hidden" />

            {files.length > 0 && (
              <div className="mt-3 space-y-1">
                <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400">Selected files:</h4>
                <ul className="text-xs text-gray-700 dark:text-gray-200 space-y-1">
                  {files.map((f) => (
                    <li key={`${f.name}-${f.size}`} className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-md">
                      <Paperclip className="h-3 w-3 flex-shrink-0" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-gray-500 dark:text-gray-400">({Math.round(f.size / 1024)} KB)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {t("project.actions.cancel") || "Cancel"}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-md border border-transparent shadow-sm bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
            {t("project.actions.submit") || "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}