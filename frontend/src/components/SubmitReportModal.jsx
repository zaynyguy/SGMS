// src/components/SubmitReportModal.jsx
import React, { useEffect, useState } from "react";
import { submitReport } from "../api/reports";

export default function SubmitReportModal({ initialActivityId = "", onClose = () => {} }) {
  const [activityId, setActivityId] = useState(initialActivityId || "");
  const [narrative, setNarrative] = useState("");
  const [metrics, setMetrics] = useState([{ id: 1, key: "", value: "" }]);
  const [newStatus, setNewStatus] = useState("");
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setActivityId(initialActivityId || "");
  }, [initialActivityId]);

  function addMetric() {
    setMetrics((m) => [...m, { id: Date.now(), key: "", value: "" }]);
  }

  function updateMetric(id, field, value) {
    setMetrics((m) => m.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  }

  function removeMetric(id) {
    setMetrics((m) => m.filter((x) => x.id !== id));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);
    if (!activityId) return setMessage({ type: "error", text: "Activity ID required" });

    const form = new FormData();
    form.append("narrative", narrative);
    const metricsObj = metrics.reduce((acc, cur) => {
      if (cur.key) acc[cur.key] = cur.value;
      return acc;
    }, {});
    if (Object.keys(metricsObj).length) form.append("metrics_data", JSON.stringify(metricsObj));
    if (newStatus) form.append("new_status", newStatus);

    setSubmitting(true);
    try {
      const data = await submitReport(activityId, form);
      // assume API returns { id, ... } on success
      setMessage({ type: "success", text: `Report submitted successfully (ID: ${data?.id ?? "unknown"})` });
      setActivityId("");
      setNarrative("");
      setMetrics([{ id: 1, key: "", value: "" }]);
      setNewStatus("");
      // close modal after short delay so user sees success (adjust if you prefer immediate close)
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      console.error("submit report error:", err);
      setMessage({ type: "error", text: err?.message || "Failed to submit report" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Submit Report</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 text-2xl">
            &times;
          </button>
        </div>

        <form className="px-6 py-4" onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Activity ID</label>
            <input
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Enter activity ID"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Narrative</label>
            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Provide a detailed narrative of your report"
            />
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Metrics</label>
              <button
                type="button"
                onClick={addMetric}
                className="flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Metric
              </button>
            </div>

            <div className="space-y-3">
              {metrics.map((m) => (
                <div key={m.id} className="flex gap-2 items-start">
                  <input
                    placeholder="Metric name"
                    value={m.key}
                    onChange={(e) => updateMetric(m.id, "key", e.target.value)}
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  <input
                    placeholder="Value"
                    value={m.value}
                    onChange={(e) => updateMetric(m.id, "value", e.target.value)}
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => removeMetric(m.id)}
                    className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Status (optional)</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            >
              <option value="">(no change)</option>
              <option>Not Started</option>
              <option>In Progress</option>
              <option>Done</option>
              <option>Blocked</option>
            </select>
          </div>

          <div className="pt-4 flex items-center gap-3">
            <button
              disabled={submitting}
              type="submit"
              className="flex-1 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {submitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </span>
              ) : (
                "Submit Report"
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>

          {message && (
            <div className={`p-4 rounded-lg ${message.type === "error" ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800" : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"}`} >
              <div className="flex items-start">
                {message.type === "error" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                <span>{message.text}</span>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
