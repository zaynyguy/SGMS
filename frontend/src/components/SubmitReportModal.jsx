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
  const [files, setFiles] = useState([]); // [{ id, file }]
  const [localErr, setLocalErr] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const backdropRef = React.useRef(null);
  const modalRef = React.useRef(null);

  // Animation management
  useEffect(() => {
    if (data) {
      setIsVisible(true);
      setIsAnimating(true);
      // Small delay to ensure DOM is updated before animation starts
      requestAnimationFrame(() => {
        if (backdropRef.current && modalRef.current) {
          backdropRef.current.style.opacity = '1';
          modalRef.current.style.transform = 'scale(1) translateY(0)';
          modalRef.current.style.opacity = '1';
        }
      });
    } else if (isVisible) {
      // Start exit animation
      setIsAnimating(true);
      if (backdropRef.current && modalRef.current) {
        backdropRef.current.style.opacity = '0';
        modalRef.current.style.transform = 'scale(0.95) translateY(10px)';
        modalRef.current.style.opacity = '0';
      }
      // Delay unmounting for animation to complete
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [data, isVisible]);

  // Helper to generate a unique ID for React keys
  const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Helper to safely parse numbers
  const parseNum = (v, fallback = 0) => {
    const n = parseFloat(String(v));
    return Number.isNaN(n) ? fallback : n;
  };

  // This effect now populates the metric form from the 'data' prop
  useEffect(() => {
    if (!data) return;
    
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
  }, [activityId, targetMetric, currentMetric, data]); // Depend on metrics

  const onFileChange = (e) => {
    setLocalErr(null);
    const incoming = Array.from(e.target.files || []).map((f) => ({ id: generateId(), file: f }));
    if (incoming.length === 0) return;

    // avoid exact duplicates (name+size+lastModified)
    const existingKeys = new Set(files.map((f) => `${f.file.name}-${f.file.size}-${f.file.lastModified}`));
    const uniqueIncoming = incoming.filter((i) => !existingKeys.has(`${i.file.name}-${i.file.size}-${i.file.lastModified}`));

    const combined = [...files, ...uniqueIncoming];
    if (combined.length > 5) {
      // Trim to the first 5 and notify user
      setFiles(combined.slice(0, 5));
      setLocalErr(t("project.errors.maxAttachments", { max: 5 }) || "Maximum 5 attachments allowed. Extra files were ignored.");
    } else {
      setFiles(combined);
    }

    // Clear the input so the same file can be re-selected if needed
    try {
      e.target.value = null;
    } catch (e2) {}
  };

  const removeFile = (id) => setFiles((p) => p.filter((f) => f.id !== id));

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

    // Validate: do not allow reports that push current beyond target
    const exceeded = metricsArray
      .filter((m) => m && m.target !== null)
      .map((m) => {
        const attemptedTotal = parseNum(m.current, 0) + parseNum(m.value, 0);
        return { m, attemptedTotal };
      })
      .filter((x) => x.attemptedTotal > x.m.target);

    if (exceeded.length > 0) {
      const msgs = exceeded.map((x) => {
        const keyLabel = x.m.key || "(metric)";
        const attempted = x.attemptedTotal;
        const target = x.m.target;
        const excess = attempted - target;
        return `${keyLabel}: attempt would be ${attempted} (target ${target}) — exceed by ${excess}`;
      });
      setLocalErr(
        (t("project.errors.metricExceed") || "Some metric values would exceed their target:") + " " + msgs.join("; ")
      );
      return;
    }

    // Prepare files as File[] for onSubmit
    const rawFiles = files.map((f) => f.file);

    await onSubmit({
      activityId,
      narrative,
      metricsArray, // Send the full array
      newStatus: newStatus || null,
      files: rawFiles,
      goalId,
      taskId,
    });
  };

  // Derived: whether any metric row would exceed target now (used to disable submit)
  const anyMetricWouldExceed = metricsArray.some((m) => m && m.target !== null && parseNum(m.current, 0) + parseNum(m.value, 0) > m.target);

  if (!isVisible && !isAnimating) return null;

  return (
    <>
      <style>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes slideOutDown {
          to {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        @keyframes pulseWarning {
          0%, 100% { 
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
          }
          50% { 
            box-shadow: 0 0 0 4px rgba(239, 68, 68, 0);
          }
        }
        @keyframes fileAppear {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .metric-error {
          animation: pulseWarning 2s infinite;
        }
        .file-item-enter {
          animation: fileAppear 0.3s ease-out;
        }
      `}</style>

      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 transition-all duration-300 ease-out"
        role="presentation"
        onClick={onClose} // Close on backdrop click
        style={{
          opacity: 0,
          pointerEvents: isAnimating ? 'auto' : 'none'
        }}
      >
        <form
          ref={modalRef}
          onSubmit={handleSubmit}
          encType="multipart/form-data"
          className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transform transition-all duration-300 ease-out"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-report-title"
          onClick={(e) => e.stopPropagation()} // Prevent form click from closing modal
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
          style={{
            transform: 'scale(0.95) translateY(10px)',
            opacity: 0
          }}
        >
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0 backdrop-blur-sm bg-white/95 dark:bg-gray-800/95">
            <h3 id="submit-report-title" className="text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-200">
              {t("project.modal.submitReport") || "Submit Report"}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("project.actions.close") || "Close"}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full p-1 transition-all duration-200 transform hover:scale-110 hover:rotate-90 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <X className="h-5 w-5 transition-transform duration-200" />
            </button>
          </div>

          {/* Modal Body (Scrollable) */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto">
            <div className="transition-all duration-200 hover:scale-[1.02] transform origin-left">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">
                {t("project.labels.activity")}
              </label>
              <div className="mt-1 text-sm font-mono p-2 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-200 transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-600">
                {activityId}
              </div>
            </div>

            <div className="transition-all duration-200 hover:scale-[1.02] transform origin-left">
              <label htmlFor="narrative" className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">
                {t("project.fields.narrative")}
              </label>
              <textarea
                id="narrative"
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                rows={4}
                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-gray-400 dark:hover:border-gray-500 resize-none"
              />
            </div>

            {/* Enhanced Metrics Section */}
            <div className="transition-all duration-300">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">
                {t("project.labels.metrics")}
              </label>
              <div className="mt-2 space-y-3">
                {metricsArray.map((m, idx) => {
                  const remaining = m.target !== null ? m.target - m.current : null;
                  const attemptedTotal = parseNum(m.current, 0) + parseNum(m.value, 0);
                  const willExceed = m.target !== null && attemptedTotal > m.target;
                  return (
                  <div 
                    key={m.id} 
                    className={`p-3 border rounded-lg space-y-2 transition-all duration-300 transform hover:scale-[1.01] ${
                      willExceed 
                        ? 'metric-error border-red-300 dark:border-red-600 bg-red-50/50 dark:bg-red-900/20' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="flex gap-2 items-center">
                      <input
                        placeholder={t("project.placeholders.metricKey") || "Metric Key"}
                        value={m.key}
                        readOnly={m.isPredefined} // Key is read-only if it came from targetMetric
                        onChange={(e) => updateMetricRow(idx, "key", e.target.value)}
                        className={`flex-1 px-2 py-1 border rounded-lg text-sm text-gray-900 dark:text-white transition-all duration-200 ${
                          m.isPredefined 
                            ? 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700' 
                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      />
                      <input
                        type="number"
                        step="any"
                        min={0}
                        placeholder={t("project.placeholders.metricValueReport") || "Value to Report"}
                        value={m.value}
                        onChange={(e) => updateMetricRow(idx, "value", e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-gray-400 dark:hover:border-gray-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeMetricRow(idx)}
                        className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500"
                        aria-label={t("project.actions.removeShort") || "Remove"}
                      >
                        <X className="h-4 w-4 transition-transform duration-200 hover:rotate-90" />
                      </button>
                    </div>
                    {/* Hint text for progress */}
                    {m.isPredefined && m.target !== null && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 pl-1 transition-colors duration-200">
                        {t("project.hints.metricRemaining", { current: m.current, target: m.target, remaining: remaining }) || `Current: ${m.current} / ${m.target} (Remaining: ${remaining})`}
                      </div>
                    )}

                    {/* Inline exceed warning */}
                    {willExceed && (
                      <div className="text-xs text-red-600 dark:text-red-400 pl-1 flex items-center gap-1 transition-all duration-200">
                        <div className="h-1.5 w-1.5 bg-red-500 rounded-full animate-pulse"></div>
                        {t("project.errors.metricWouldExceed", { key: m.key || "(metric)", attempted: attemptedTotal, target: m.target }) || `Reporting this value would make total ${attemptedTotal}, exceeding target ${m.target}.`}
                      </div>
                    )}
                  </div>
                )})}
              </div>

              <button
                type="button"
                onClick={addMetricRow}
                className="mt-3 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t("project.actions.addMetric") || "Add Metric"}
              </button>

              {localErr && (
                <div 
                  className="text-xs text-red-500 mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 transition-all duration-200"
                  style={{ animation: 'shake 0.4s ease-in-out' }}
                >
                  {localErr}
                </div>
              )}
            </div>

            {/* FIXED: Status dropdown for Activities */}
            <div className="transition-all duration-200 hover:scale-[1.02] transform origin-left">
              <label htmlFor="newStatus" className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">
                {t("project.fields.newStatus")} {t("project.labels.optional")}
              </label>
              <select
                id="newStatus"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-gray-400 dark:hover:border-gray-500"
              >
                <option value="">{t("project.status.noChange") || "(No Change)"}</option>
                <option value="To Do">{t("project.status.toDo") || "To Do"}</option>
                <option value="In Progress">{t("project.status.inProgress") || "In Progress"}</option>
                <option value="Done">{t("project.status.completed") || "Done"}</option>
              </select>
            </div>

            {/* Enhanced File attachment UI */}
            <div className="transition-all duration-300">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">
                {t("project.labels.attachments")}
              </label>
              <label
                htmlFor="file-upload"
                className="mt-2 flex justify-center items-center gap-2 px-6 py-4 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 bg-gray-50 dark:bg-gray-700/50 transition-all duration-300 transform hover:scale-[1.02] group/upload"
              >
                <UploadCloud className="h-6 w-6 text-gray-500 dark:text-gray-400 transition-all duration-200 group-hover/upload:scale-110 group-hover/upload:text-indigo-500 dark:group-hover/upload:text-indigo-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300 transition-colors duration-200 group-hover/upload:text-indigo-500 dark:group-hover/upload:text-indigo-400">
                  {t("project.actions.uploadFiles") || "Click to upload files (max 5)"}
                </span>
              </label>
              <input id="file-upload" type="file" multiple onChange={onFileChange} className="hidden" />

              {files.length > 0 && (
                <div className="mt-3 space-y-1">
                  <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 transition-colors duration-200">
                    {t("project.labels.selectedFiles") || 'Selected files:'}
                  </h4>
                  <ul className="text-xs text-gray-700 dark:text-gray-200 space-y-1">
                    {files.map((f, index) => (
                      <li 
                        key={f.id} 
                        className="file-item-enter flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-600 transform hover:scale-[1.02]"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <Paperclip className="h-3 w-3 flex-shrink-0 transition-transform duration-200" />
                        <span className="flex-1 truncate transition-colors duration-200">{f.file.name}</span>
                        <span className="text-gray-500 dark:text-gray-400 transition-colors duration-200">
                          ({Math.round(f.file.size / 1024)} KB)
                        </span>
                        <button 
                          type="button" 
                          onClick={() => removeFile(f.id)} 
                          className="ml-2 p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-600 transition-all duration-200 transform hover:scale-110 active:scale-95"
                        >
                          <X className="h-4 w-4 transition-transform duration-200 hover:rotate-90" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 transition-colors duration-200">
                {t("project.hints.maxAttachments", { max: 5 }) || 'Max 5 attachments.'}
              </div>
            </div>
          </div>

          {/* Enhanced Modal Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800 flex-shrink-0 backdrop-blur-sm bg-white/95 dark:bg-gray-800/95">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-600 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {t("project.actions.cancel") || "Cancel"}
            </button>
            <button
              type="submit"
              disabled={loading || anyMetricWouldExceed}
              className="px-4 py-2 rounded-lg border border-transparent shadow-sm bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:transform-none disabled:hover:scale-100"
            >
              {loading ? <Loader className="h-4 w-4 animate-spin mr-2 transition-transform duration-200" /> : null}
              {t("project.actions.submit") || "Submit"}
              {loading && (
                <div className="ml-2 h-1 w-1 bg-white rounded-full animate-pulse"></div>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}