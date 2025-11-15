import React, { useEffect, useState } from "react";
import { Loader, UploadCloud, Paperclip, X } from "lucide-react";

/**
 * Props:
 * - data: { goalId, taskId, activityId, targetMetric, currentMetric, quarterlyGoals? } // Tolerates stringified JSON too
 * - onClose: () => void
 * - onSubmit: async (formState) => {}
 * - loading: boolean
 * - t: i18n function
 */
export default function SubmitReportInline({
  data,
  onClose,
  onSubmit,
  loading,
  t,
}) {
  const { goalId, taskId, activityId } = data || {};
  const [narrative, setNarrative] = useState("");
  const [metricsArray, setMetricsArray] = useState([]); // Start empty, populate in useEffect
  const [newStatus, setNewStatus] = useState("");
  const [files, setFiles] = useState([]); // [{ id, file }]
  const [localErr, setLocalErr] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const backdropRef = React.useRef(null);
  const modalRef = React.useRef(null);

  // Safe parse: object | stringified JSON -> object (or original value)
  const safeParseJson = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "object") return v;
    if (typeof v === "string") {
      try {
        const trimmed = v.trim();
        if (trimmed === "") return null;
        return JSON.parse(trimmed);
      } catch {
        return v;
      }
    }
    return v;
  };

  // Robust numeric extractor: handles "100", 100, { value: "100" }, etc.
  const extractNumeric = (v) => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const cleaned = v.replace(/,/g, "").trim();
      if (cleaned === "") return null;
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    }
    if (typeof v === "object") {
      const keys = ["value", "amount", "target", "val", "count"];
      for (const k of keys) {
        if (v[k] !== undefined && v[k] !== null) {
          const sub = extractNumeric(v[k]);
          if (sub !== null) return sub;
        }
      }
      for (const sub of Object.values(v)) {
        const n = extractNumeric(sub);
        if (n !== null) return n;
      }
    }
    return null;
  };

  // Helper to generate a unique ID for React keys
  const generateId = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Animation management
  useEffect(() => {
    if (data) {
      setIsVisible(true);
      setIsAnimating(true);
      requestAnimationFrame(() => {
        if (backdropRef.current && modalRef.current) {
          backdropRef.current.style.opacity = "1";
          modalRef.current.style.transform = "scale(1) translateY(0)";
          modalRef.current.style.opacity = "1";
        }
      });
    } else if (isVisible) {
      setIsAnimating(true);
      if (backdropRef.current && modalRef.current) {
        backdropRef.current.style.opacity = "0";
        modalRef.current.style.transform = "scale(0.95) translateY(10px)";
        modalRef.current.style.opacity = "0";
      }
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [data, isVisible]);

  // Populate metricsArray from incoming data (robust parsing)
  useEffect(() => {
    if (!data) return;

    setNarrative("");
    setNewStatus("");
    setFiles([]);
    setLocalErr(null);

    const rawTargets = safeParseJson(
      data.targetMetric ??
        data.activity?.targetMetric ??
        data.target_metrics ??
        {}
    );
    const rawCurrents = safeParseJson(
      data.currentMetric ??
        data.activity?.currentMetric ??
        data.current_metrics ??
        {}
    );

    const targets =
      rawTargets && typeof rawTargets === "object" ? rawTargets : {};
    const currents =
      rawCurrents && typeof rawCurrents === "object" ? rawCurrents : {};

    const targetKeys = Object.keys(targets);

    if (targetKeys.length > 0) {
      const initialMetrics = targetKeys.map((key) => {
        const rawTarget = targets[key];
        const rawCurrent = currents[key];

        const targetVal = extractNumeric(rawTarget);
        const currentVal = extractNumeric(rawCurrent) ?? 0;

        return {
          id: generateId(),
          key: key,
          value: "", // incremental value to report — left empty for user input
          target: targetVal !== null ? targetVal : null,
          current: currentVal,
          isPredefined: true, // Key is from targetMetric and should be readonly
        };
      });

      setMetricsArray(initialMetrics);
    } else {
      // No predefined targets — provide a single blank row for user to fill
      setMetricsArray([
        {
          id: generateId(),
          key: "",
          value: "",
          target: null,
          current: 0,
          isPredefined: false,
        },
      ]);
    }
  }, [
    data?.activityId,
    data?.targetMetric,
    data?.currentMetric,
    data?.target_metrics,
    data?.current_metrics,
    data,
  ]);

  // File input handling
  const onFileChange = (e) => {
    setLocalErr(null);
    const incoming = Array.from(e.target.files || []).map((f) => ({
      id: generateId(),
      file: f,
    }));
    if (incoming.length === 0) return;

    const existingKeys = new Set(
      files.map((f) => `${f.file.name}-${f.file.size}-${f.file.lastModified}`)
    );
    const uniqueIncoming = incoming.filter(
      (i) =>
        !existingKeys.has(
          `${i.file.name}-${i.file.size}-${i.file.lastModified}`
        )
    );

    const combined = [...files, ...uniqueIncoming];
    if (combined.length > 5) {
      setFiles(combined.slice(0, 5));
      setLocalErr(
        t("project.errors.maxAttachments", { max: 5 }) ||
          "Maximum 5 attachments allowed. Extra files were ignored."
      );
    } else {
      setFiles(combined);
    }

    try {
      e.target.value = null;
    } catch (e2) {
      /* ignore */
    }
  };

  const removeFile = (id) => setFiles((p) => p.filter((f) => f.id !== id));

  const updateMetricRow = (idx, field, value) =>
    setMetricsArray((prev) => {
      const arr = [...prev];
      arr[idx] = { ...(arr[idx] || {}), [field]: value };
      return arr;
    });

  const addMetricRow = () =>
    setMetricsArray((p) => [
      ...p,
      {
        id: generateId(),
        key: "",
        value: "",
        target: null,
        current: 0,
        isPredefined: false,
      },
    ]);
  const removeMetricRow = (idx) =>
    setMetricsArray((p) => p.filter((_, i) => i !== idx));

  // Derived totals for overall hint (unchanged)
  const { totalTarget, totalCurrent, totalAvailable, isNumericTarget } =
    (() => {
      const rawTargets = safeParseJson(
        data?.targetMetric ?? data?.activity?.targetMetric ?? {}
      );
      const rawCurrents = safeParseJson(
        data?.currentMetric ?? data?.activity?.currentMetric ?? {}
      );
      const tObj =
        rawTargets && typeof rawTargets === "object" ? rawTargets : {};
      const cObj =
        rawCurrents && typeof rawCurrents === "object" ? rawCurrents : {};

      const totalT = Object.values(tObj).reduce(
        (s, v) => s + (extractNumeric(v) || 0),
        0
      );
      const totalC = Object.values(cObj).reduce(
        (s, v) => s + (extractNumeric(v) || 0),
        0
      );
      return {
        totalTarget: totalT,
        totalCurrent: totalC,
        totalAvailable: Math.max(0, totalT - totalC),
        isNumericTarget: totalT > 0,
      };
    })();

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLocalErr(null);

    // Validate: key is required if value is provided
    const hasInvalid = metricsArray.some(
      (m) => m && String(m.key).trim() === "" && String(m.value).trim() !== ""
    );
    if (hasInvalid) {
      setLocalErr(
        t("project.errors.metricKeyMissing") ||
          "Metric name is required if a value is entered."
      );
      return;
    }

    // Validate: value must be a number if provided
    const hasNaN = metricsArray.some(
      (m) =>
        m && String(m.value).trim() !== "" && extractNumeric(m.value) === null
    );
    if (hasNaN) {
      setLocalErr(
        t("project.errors.metricValueNumeric") ||
          "Metric value must be a number."
      );
      return;
    }

    // Prepare files as File[] for onSubmit
    const rawFiles = files.map((f) => f.file);

    // IMPORTANT: Send exactly what the user entered (replace semantics).
    // Build metrics object mapping key -> entered value (string).
    // Skip rows with empty key or empty value.
    const metricsObj = {};
    for (const m of metricsArray) {
      if (!m) continue;
      const key = String(m.key || "").trim();
      if (key === "") continue;
      // If user didn't enter a value, skip sending that metric.
      if (String(m.value ?? "").trim() === "") continue;
      // Send exactly the typed value (no accumulation).
      metricsObj[key] = String(m.value);
    }

    await onSubmit({
      activityId,
      narrative,
      metricsArray, // keep sending the array for debugging/UI if needed
      metrics_data: Object.keys(metricsObj).length
        ? JSON.stringify(metricsObj)
        : null,
      newStatus: newStatus || null,
      files: rawFiles,
      goalId,
      taskId,
    });
  };

  // We removed exceed-check / disable logic per your request — always allow submit (subject to validation above)
  if (!isVisible && !isAnimating) return null;

  return (
    <>
      <style>{`
        @keyframes slideInUp { from { opacity: 0; transform: translateY(20px) scale(0.95);} to { opacity: 1; transform: translateY(0) scale(1);} }
        @keyframes slideOutDown { to { opacity: 0; transform: translateY(20px) scale(0.95);} }
        @keyframes shake { 0%,100%{transform:translateX(0);}25%{transform:translateX(-5px);}75%{transform:translateX(5px);} }
        @keyframes fileAppear { from { opacity:0; transform:translateX(-10px);} to {opacity:1; transform:translateX(0);} }
      `}</style>

      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 transition-all duration-300 ease-out"
        role="presentation"
        onClick={onClose}
        style={{ opacity: 0, pointerEvents: isAnimating ? "auto" : "none" }}
      >
        <form
          ref={modalRef}
          onSubmit={handleSubmit}
          encType="multipart/form-data"
          className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transform transition-all duration-300 ease-out"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-report-title"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          style={{ transform: "scale(0.95) translateY(10px)", opacity: 0 }}
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0 backdrop-blur-sm bg-white/95 dark:bg-gray-800/95">
            <h3
              id="submit-report-title"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              {t("project.modal.submitReport") || "Submit Report"}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("project.actions.close") || "Close"}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full p-1 transition-all duration-200 transform hover:scale-110 hover:rotate-90 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("project.labels.activity")}
              </label>
              <div className="mt-1 text-sm font-mono p-2 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-200">
                {activityId}
              </div>
            </div>

            <div>
              <label
                htmlFor="narrative"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t("project.fields.narrative")}
              </label>
              <textarea
                id="narrative"
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                rows={4}
                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {isNumericTarget && (
              <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 text-sm">
                {t("project.hints.overallHint", {
                  target: totalTarget,
                  used: totalCurrent,
                  remaining: totalAvailable,
                }) ||
                  `Overall Target: ${totalTarget}. Total progress: ${totalCurrent}. Remaining: ${totalAvailable}.`}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("project.labels.metrics")}
              </label>
              <div className="mt-2 space-y-3">
                {metricsArray.map((m, idx) => {
                  const remaining =
                    m.target !== null ? m.target - (m.current || 0) : null;
                  return (
                    <div
                      key={m.id}
                      className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2 bg-white dark:bg-gray-800"
                    >
                      <div className="flex gap-2 items-center">
                        <input
                          placeholder={
                            t("project.placeholders.metricKey") || "Metric Key"
                          }
                          value={m.key}
                          readOnly={m.isPredefined}
                          onChange={(e) =>
                            updateMetricRow(idx, "key", e.target.value)
                          }
                          className={`flex-1 px-2 py-1 border rounded-lg text-sm ${
                            m.isPredefined
                              ? "bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed"
                              : "bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                          }`}
                        />
                        <input
                          type="number"
                          step="any"
                          min={0}
                          placeholder={
                            t("project.placeholders.metricValueReport") ||
                            "Value to Report"
                          }
                          value={m.value}
                          onChange={(e) =>
                            updateMetricRow(idx, "value", e.target.value)
                          }
                          className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                        />
                        <button
                          type="button"
                          onClick={() => removeMetricRow(idx)}
                          className="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          aria-label={
                            t("project.actions.removeShort") || "Remove"
                          }
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {m.isPredefined && m.target !== null && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 pl-1">
                          {t("project.hints.metricRemaining", {
                            current: m.current,
                            target: m.target,
                            remaining,
                          }) ||
                            `Current: ${m.current} / ${m.target} (Remaining: ${remaining})`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addMetricRow}
                className="flex items-center justify-center gap-2 mt-3 px-4 py-3 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors w-full"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                {t("project.actions.addMetric") || "Add Metric"}
              </button>

              {localErr && (
                <div
                  className="text-xs text-red-500 mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
                  style={{ animation: "shake 0.4s ease-in-out" }}
                >
                  {localErr}
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="newStatus"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t("project.fields.newStatus")} {t("project.labels.optional")}
              </label>
              <select
                id="newStatus"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">
                  {t("project.status.noChange") || "(No Change)"}
                </option>
                <option value="To Do">
                  {t("project.status.toDo") || "To Do"}
                </option>
                <option value="In Progress">
                  {t("project.status.inProgress") || "In Progress"}
                </option>
                <option value="Done">
                  {t("project.status.completed") || "Done"}
                </option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("project.labels.attachments")}
              </label>
              <label
                htmlFor="file-upload"
                className="mt-2 flex justify-center items-center gap-2 px-6 py-4 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700/50"
              >
                <UploadCloud className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {t("project.actions.uploadFiles") ||
                    "Click to upload files (max 5)"}
                </span>
              </label>
              <input
                id="file-upload"
                type="file"
                multiple
                onChange={onFileChange}
                className="hidden"
              />

              {files.length > 0 && (
                <div className="mt-3 space-y-1">
                  <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {t("project.labels.selectedFiles") || "Selected files:"}
                  </h4>
                  <ul className="text-xs text-gray-700 dark:text-gray-200 space-y-1">
                    {files.map((f, index) => (
                      <li
                        key={f.id}
                        className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg"
                      >
                        <Paperclip className="h-3 w-3 flex-shrink-0" />
                        <span className="flex-1 truncate">{f.file.name}</span>
                        <span className="text-gray-500 dark:text-gray-400">
                          ({Math.round(f.file.size / 1024)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(f.id)}
                          className="ml-2 p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {t("project.hints.maxAttachments", { max: 5 }) ||
                  "Max 5 attachments."}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-gray-700 text-sm font-medium"
            >
              {t("project.actions.cancel") || "Cancel"}
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <Loader className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t("project.actions.submit") || "Submit"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
