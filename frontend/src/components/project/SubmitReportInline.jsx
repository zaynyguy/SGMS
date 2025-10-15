// SubmitReportInline.jsx
import React, { useEffect, useState } from "react";
import { Loader } from "lucide-react";

/**
 * Props:
 * - data: { goalId, taskId, activityId }
 * - onClose: () => void
 * - onSubmit: async (formState) => {}
 * - loading: boolean
 * - t: i18n function
 */
export default function SubmitReportInline({ data, onClose, onSubmit, loading, t }) {
  const { goalId, taskId, activityId } = data || {};
  const [narrative, setNarrative] = useState("");
  const [metricsArray, setMetricsArray] = useState([{ key: "", value: "" }]);
  const [newStatus, setNewStatus] = useState("");
  const [files, setFiles] = useState([]);
  const [localErr, setLocalErr] = useState(null);

  useEffect(() => {
    setNarrative("");
    setMetricsArray([{ key: "", value: "" }]);
    setNewStatus("");
    setFiles([]);
    setLocalErr(null);
  }, [activityId]);

  const onFileChange = (e) => setFiles(Array.from(e.target.files || []));

  const updateMetricRow = (idx, field, value) =>
    setMetricsArray((prev) => {
      const arr = [...prev];
      arr[idx] = { ...(arr[idx] || {}), [field]: value };
      return arr;
    });

  const addMetricRow = () => setMetricsArray((p) => [...p, { key: "", value: "" }]);
  const removeMetricRow = (idx) => setMetricsArray((p) => (p.length > 1 ? p.filter((_, i) => i !== idx) : [{ key: "", value: "" }]));

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLocalErr(null);
    const hasInvalid = metricsArray.some((m) => m && String(m.key).trim() === "" && String(m.value).trim() !== "");
    if (hasInvalid) {
      setLocalErr(t("project.errors.metricKeyMissing"));
      return;
    }

    await onSubmit({
      activityId,
      narrative,
      metricsArray,
      newStatus: newStatus || null,
      files,
      goalId,
      taskId,
    });
  };

  return (
  <div
    className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
    role="presentation"
    onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
  >
    <form
      onSubmit={handleSubmit}
      encType="multipart/form-data"
      className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded shadow-lg overflow-auto max-h-[90vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-report-title"
    >
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 id="submit-report-title" className="text-lg font-semibold text-gray-900 dark:text-white">
          {t("project.modal.submitReport")}
        </h3>
        <button
          type="button"
          onClick={() => onClose()}
          aria-label={t("project.actions.close") || "Close"}
          className="text-gray-400 hover:text-gray-600"
        >
          &times;
        </button>
      </div>

      <div className="px-4 py-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("project.labels.activity")}
          </label>
          <div className="mt-1 text-sm text-gray-700 dark:text-gray-200">{activityId}</div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("project.fields.narrative")}
          </label>
          <textarea
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("project.labels.metrics")}
          </label>
          <div className="mt-2 space-y-2">
            {metricsArray.map((m, idx) => (
              <div key={m.id ?? idx} className="flex gap-2">
                <input
                  placeholder={t("project.placeholders.metricKey")}
                  value={m.key}
                  onChange={(e) => updateMetricRow(idx, "key", e.target.value)}
                  className="flex-1 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                />
                <input
                  placeholder={t("project.placeholders.metricValue")}
                  value={m.value}
                  onChange={(e) => updateMetricRow(idx, "value", e.target.value)}
                  className="flex-1 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => removeMetricRow(idx)}
                  className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                >
                  {t("project.actions.removeShort")}
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addMetricRow}
            className="mt-2 px-2 py-1 bg-green-600 text-white rounded text-xs"
          >
            + {t("project.actions.addMetric")}
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("project.hints.metrics")}</p>
          {localErr && <div className="text-xs text-red-500 mt-1">{localErr}</div>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("project.fields.newStatus")}
          </label>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">{t("project.none")}</option>
            <option value="Done">{t("project.status.completed")}</option>
            <option value="In Progress">{t("project.status.inProgress")}</option>
            <option value="Not Started">{t("project.status.notStarted")}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("project.labels.attachments")}
          </label>
          <input type="file" multiple onChange={onFileChange} className="mt-2" />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("project.hints.attachments")}</p>

          {files.length > 0 && (
            <ul className="mt-2 text-xs text-gray-700 dark:text-gray-200">
              {files.map((f) => (
                <li key={`${f.name}-${f.size}`}>
                  {f.name} ({Math.round(f.size / 1024)} KB)
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2 bg-white dark:bg-gray-800 sticky bottom-0">
        <button
          type="button"
          onClick={() => onClose()}
          className="px-3 py-2 rounded border bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          {t("project.actions.cancel")}
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-2 rounded bg-indigo-600 text-white flex items-center"
        >
          {loading ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
          {t("project.actions.submit")}
        </button>
      </div>
    </form>
  </div>
);
}
