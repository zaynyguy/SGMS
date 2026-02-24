import React, { useEffect, useMemo, useState } from "react";
import {
  Loader,
  UploadCloud,
  Paperclip,
  X,
  CheckCircle,
  Activity,
  FileText,
  PlusSquare,
  AlertCircle,
  Info,
} from "lucide-react";

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
  const [userSelectedStatus, setUserSelectedStatus] = useState(false);
  const [files, setFiles] = useState([]); // [{ id, file }]
  const [localErr, setLocalErr] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [badgePulse, setBadgePulse] = useState(false);

  const backdropRef = React.useRef(null);
  const modalRef = React.useRef(null);

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

  const generateId = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  useEffect(() => {
    if (data) {
      setIsVisible(true);
      setIsAnimating(true);
      requestAnimationFrame(() => {
        if (backdropRef.current && modalRef.current) {
          backdropRef.current.style.opacity = "1";
          modalRef.current.style.transform = "translateY(0) scale(1)";
          modalRef.current.style.opacity = "1";
        }
      });
    } else if (isVisible) {
      setIsAnimating(true);
      if (backdropRef.current && modalRef.current) {
        backdropRef.current.style.opacity = "0";
        modalRef.current.style.transform = "translateY(10px) scale(0.97)";
        modalRef.current.style.opacity = "0";
      }
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [data, isVisible]);

  useEffect(() => {
    if (!data) return;

    setNarrative("");
    setNewStatus("");
    setUserSelectedStatus(false);
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
          value: "", // replacement value to report — left empty for user input
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

  const metricType = (data && (data.metricType || data.activity?.metricType)) || 'Plus';

  // Helper to determine if this is a cumulative or snapshot metric type
  const isCumulative = metricType === 'Plus' || metricType === 'Minus';

  // Get user-friendly label and description for metric type
  const getMetricTypeInfo = (type) => {
  const info = {
    Plus: {
      label: t('project.metrics.types.plus.label'),
      description: t('project.metrics.types.plus.description'),
      placeholder: t('project.metrics.types.plus.placeholder'),
      example: t('project.metrics.types.plus.example'),
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    },
    Minus: {
      label: t('project.metrics.types.minus.label'),
      description: t('project.metrics.types.minus.description'),
      placeholder: t('project.metrics.types.minus.placeholder'),
      example: t('project.metrics.types.minus.example'),
      color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    },
    Increase: {
      label: t('project.metrics.types.increase.label'),
      description: t('project.metrics.types.increase.description'),
      placeholder: t('project.metrics.types.increase.placeholder'),
      example: t('project.metrics.types.increase.example'),
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    },
    Decrease: {
      label: t('project.metrics.types.decrease.label'),
      description: t('project.metrics.types.decrease.description'),
      placeholder: t('project.metrics.types.decrease.placeholder'),
      example: t('project.metrics.types.decrease.example'),
      color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    },
    Maintain: {
      label: t('project.metrics.types.maintain.label'),
      description: t('project.metrics.types.maintain.description'),
      placeholder: t('project.metrics.types.maintain.placeholder'),
      example: t('project.metrics.types.maintain.example'),
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    },
  };

  return info[type] || info.Plus;
};


  const metricTypeInfo = getMetricTypeInfo(metricType);

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

  const { totalTarget, totalCurrent, totalAvailable, isNumericTarget } =
    useMemo(() => {
      if (metricsArray && metricsArray.length > 0) {
        let tSum = 0;
        let cSum = 0;
        for (const m of metricsArray) {
          if (!m) continue;
          const target = m.target !== undefined && m.target !== null ? m.target : null;
          const curr = Number(m.current) || 0;
          const reported = extractNumeric(m.value);
          // For cumulative metric types (Plus/Minus) the reported value adds to current
          const newCurrent = (metricType === 'Plus' || metricType === 'Minus')
            ? curr + (reported !== null ? reported : 0)
            : (reported !== null ? reported : curr);
          if (target !== null) tSum += target;
          cSum += newCurrent;
        }
        return {
          totalTarget: tSum,
          totalCurrent: cSum,
          totalAvailable: Math.max(0, tSum - cSum),
          isNumericTarget: tSum > 0,
        };
      }

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
        // When activity-level metricType isn't known here, fallback to raw sums
        totalCurrent: totalC,
        totalAvailable: Math.max(0, totalT - totalC),
        isNumericTarget: totalT > 0,
      };
    }, [metricsArray, data]);

  const suggestedStatus = useMemo(() => {
    let hasAnyTarget = false;
    let anyProgress = false;
    let allTargetsMet = true;

    if (!metricsArray || metricsArray.length === 0) return "To Do";

    for (const m of metricsArray) {
      if (!m) continue;
      const reported = extractNumeric(m.value);
      const curr = Number(m.current) || 0;
      const target = m.target !== undefined ? m.target : null;
      const newCurrent = (metricType === 'Plus' || metricType === 'Minus')
        ? curr + (reported !== null ? reported : 0)
        : (reported !== null ? reported : curr);

      if (target !== null && target !== undefined) {
        hasAnyTarget = true;
        if (newCurrent < target) {
          allTargetsMet = false;
        }
        if (newCurrent > 0) anyProgress = true;
      } else {
        if (newCurrent > 0) anyProgress = true;
        allTargetsMet = false;
      }
    }

    if (hasAnyTarget) {
      if (allTargetsMet) return "Done";
      if (anyProgress) return "In Progress";
      return "To Do";
    } else {
      if (anyProgress) return "In Progress";
      return "To Do";
    }
  }, [metricsArray]);

  // List of over-target metric ids for inline hints
  const overTargetMap = useMemo(() => {
    const map = new Map();
    if (!metricsArray) return map;
    for (const m of metricsArray) {
      if (!m) continue;
      const reported = extractNumeric(m.value);
      const target = m.target !== undefined ? m.target : null;
      // For cumulative metrics, check proposed total (current + reported)
      const curr = Number(m.current) || 0;
      const proposed = (metricType === 'Plus' || metricType === 'Minus')
        ? curr + (reported !== null ? reported : 0)
        : (reported !== null ? reported : curr);
      if (target !== null && proposed !== null && proposed > target) {
        map.set(m.id, { reported: proposed, target });
      }
    }
    return map;
  }, [metricsArray]);

  const hasExceeded = overTargetMap.size > 0;

  // Auto-apply suggestedStatus unless user manually selected a status
  useEffect(() => {
    if (!userSelectedStatus) {
      setNewStatus(suggestedStatus);
    }
    setBadgePulse(true);
    const t = setTimeout(() => setBadgePulse(false), 900);
    return () => clearTimeout(t);
  }, [suggestedStatus, userSelectedStatus]);

  useEffect(() => {
    if (data) {
      setUserSelectedStatus(false);
      setNewStatus(suggestedStatus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLocalErr(null);

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

    const rawFiles = files.map((f) => f.file);

    const metricsObj = {};
    for (const m of metricsArray) {
      if (!m) continue;
      const key = String(m.key || "").trim();
      if (key === "") continue;
      if (String(m.value ?? "").trim() === "") continue;
      metricsObj[key] = String(m.value);
    }

    await onSubmit({
      activityId,
      narrative,
      metricsArray,
      metrics_data: Object.keys(metricsObj).length
        ? JSON.stringify(metricsObj)
        : null,
      newStatus: newStatus || null,
      files: rawFiles,
      goalId,
      taskId,
    });
  };

  if (!isVisible && !isAnimating) return null;

  // header badge label: if any exceeded -> show "Warning" (red), else show status
  const headerBadge = hasExceeded ? "Caution" : newStatus;
  const headerIsWarning = hasExceeded;

  return (
    <>
      <style>{`
        @keyframes slideInUp { from { opacity: 0; transform: translateY(20px) scale(0.97);} to { opacity: 1; transform: translateY(0) scale(1);} }
        @keyframes shake { 0%,100%{transform:translateX(0);}25%{transform:translateX(-5px);}75%{transform:translateX(5px);} }
        @keyframes pulseBadge { 0% { transform: scale(1); opacity: 1;} 50% { transform: scale(1.06); opacity: 0.95 } 100% { transform: scale(1); opacity: 1 } }
        .badgePulse { animation: pulseBadge 0.9s ease; }
        .rowFade { transition: transform 200ms ease, box-shadow 200ms ease; }
        .rowFade:hover { transform: translateY(-3px); box-shadow: 0 6px 14px rgba(15,23,42,0.06); }
        .btnFloat { transition: transform 160ms ease; }
        .btnFloat:hover { transform: translateY(-2px) scale(1.01); }
      `}</style>

      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/45 z-50 flex items-center justify-center p-4 transition-all duration-300 ease-out"
        role="presentation"
        onClick={onClose}
        style={{ opacity: 0, pointerEvents: isAnimating ? "auto" : "none" }}
      >
        <form
          ref={modalRef}
          onSubmit={handleSubmit}
          encType="multipart/form-data"
          className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transform transition-all duration-300 ease-out"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-report-title"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          style={{ transform: "translateY(10px) scale(0.97)", opacity: 0 }}
        >
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-white/60 to-indigo-50 dark:from-gray-900/60 dark:to-indigo-900/30">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-indigo-600 text-white shadow-sm">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h3
                  id="submit-report-title"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  {t("project.modal.submitReport") || "Submit Report"}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("project.modal.subtitle") ||
                    "Add narrative, attach files, and update metrics"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${headerIsWarning
                  ? "bg-red-100 text-red-800 dark:bg-red-900/30"
                  : newStatus === "Done"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30"
                    : newStatus === "In Progress"
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-800/60"
                  } ${badgePulse ? "badgePulse" : ""}`}
                title={headerIsWarning ? "Warning: reported value exceeds target" : `Status: ${newStatus}`}
                aria-live="polite"
              >
                {headerIsWarning ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                <span>{headerBadge}</span>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={t("project.actions.close") || "Close"}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white rounded-full p-2 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 btnFloat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="px-6 py-6 space-y-5 overflow-y-auto">
            <div className="flex items-center justify-between gap-4">
              {/* Metric Type Info - Compact Design on its own line */}
              <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${isCumulative
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/50'
                  : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50'
                }`}>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${metricTypeInfo.color}`}>
                  {metricTypeInfo.label}
                </span>
                <span className={`${isCumulative ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300'}`}>
                  {metricTypeInfo.description}
                </span>
              </div>

              <div className="w-44 text-right">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t("project.labels.quickInfo") || "Quick info"}
                </div>
                <div className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                  <FileText className="inline h-4 w-4 mr-1 -mt-0.5" />
                  {isNumericTarget ? totalTarget : "-"}
                  <div className="text-xs text-gray-400">
                    {t("project.labels.totalTarget") || "Total target"}
                  </div>
                </div>
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
                className="mt-2 w-full px-3 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            {isNumericTarget && (
              <div className="p-2 rounded-md bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 text-indigo-900 dark:text-indigo-300 text-sm">
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
              <div className="mt-3 space-y-3">
                {metricsArray.map((m, idx) => {
                  const reported = extractNumeric(m.value);
                  const curr = Number(m.current) || 0;
                  const displayedCurrent = (metricType === 'Plus' || metricType === 'Minus')
                    ? curr + (reported !== null ? reported : 0)
                    : (reported !== null ? reported : curr);
                  const remaining =
                    m.target !== null && m.target !== undefined
                      ? m.target - displayedCurrent
                      : null;
                  const exceeded = m.target !== null && reported !== null && reported > m.target;

                  return (
                    <div
                      key={m.id}
                      className="p-3 border border-gray-100 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 rowFade"
                    >
                     <div className="flex flex-col md:flex-row gap-2 md:items-center">
  <input
    placeholder={t("project.placeholders.metricKey") || "Metric Key"}
    value={m.key}
    readOnly={m.isPredefined}
    onChange={(e) =>
      updateMetricRow(idx, "key", e.target.value)
    }
    className={`w-full md:flex-1 px-3 py-2 border rounded-lg text-sm ${
      m.isPredefined
        ? "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-100 dark:border-gray-800 cursor-not-allowed"
        : "bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700"
    }`}
  />

  <div className="flex items-center gap-2">
    <input
      type="number"
      step="any"
      placeholder={metricTypeInfo.placeholder}
      value={m.value}
      onChange={(e) =>
        updateMetricRow(idx, "value", e.target.value)
      }
      className="w-full md:w-44 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
    />

    <button
      type="button"
      onClick={() => removeMetricRow(idx)}
      className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shrink-0"
      aria-label={t("project.actions.removeShort") || "Remove"}
    >
      <X className="h-4 w-4" />
    </button>
  </div>
</div>


                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 pl-1">
                        {isCumulative
                          ? `${curr} + ${reported !== null ? reported : 0} = ${displayedCurrent} / ${m.target !== null ? m.target : "-"}${remaining !== null ? ` (Remaining: ${remaining})` : ""}`
                          : `New value: ${displayedCurrent} / ${m.target !== null ? m.target : "-"}${remaining !== null ? ` (Remaining: ${remaining})` : ""}`
                        }
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addMetricRow}
                className="w-full flex items-center justify-center gap-2 mt-4 px-4 py-3 bg-green-500 dark:bg-indigo-500 text-white rounded-lg text-sm font-medium hover:shadow-sm transition"
              >
                <PlusSquare className="h-4 w-4" />
                {t("project.actions.addMetric") || "Add Metric"}
              </button>

              {localErr && (
                <div
                  className="text-xs text-red-600 mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800"
                  style={{ animation: "shake 0.4s ease-in-out" }}
                >
                  {localErr}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  onChange={(e) => {
                    setNewStatus(e.target.value);
                    setUserSelectedStatus(true);
                  }}
                  className="mt-2 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
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
                {/* removed duplicate suggested-status text */}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("project.labels.attachments")}
                </label>
                <label
                  htmlFor="file-upload"
                  className="mt-2 flex justify-center items-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700"
                >
                  <UploadCloud className="h-5 w-5 text-gray-500 dark:text-gray-300" />
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
                  <div className="mt-3 space-y-2">
                    <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      <Paperclip className="inline h-3 w-3 mr-1" />
                      {t("project.labels.selectedFiles") || "Selected files:"}
                    </h4>
                    <ul className="text-xs text-gray-700 dark:text-gray-200 space-y-1">
                      {files.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-800"
                        >
                          <Paperclip className="h-3 w-3 flex-shrink-0" />
                          <span className="flex-1 truncate">{f.file.name}</span>
                          <span className="text-gray-500 dark:text-gray-400">
                            ({Math.round(f.file.size / 1024)} KB)
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFile(f.id)}
                            className="ml-2 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600"
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
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm font-medium btnFloat"
            >
              {t("project.actions.cancel") || "Cancel"}
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2 btnFloat"
            >
              {loading ? <Loader className="h-4 w-4 animate-spin" /> : null}
              <svg
                className="h-4 w-4 -ml-0.5"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5 12h14M12 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t("project.actions.submit") || "Submit"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
