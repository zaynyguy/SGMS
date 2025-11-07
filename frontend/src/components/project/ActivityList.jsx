import React, { useState, useEffect, useRef, useMemo } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Edit, Trash2, Calendar, FileText, Check } from "lucide-react";
import { formatDate } from "../../uites/projectUtils"; // <-- fixed path
// no change to icons/components import assumptions

function ActivityList({
goal,
task,
activities = [],
activitiesLoading = false,
onEditActivity,
onDeleteActivity,
openSubmitModal,
canSubmitReport = false,
reportingActive = false,
canManageGTA = false,
}) {
const { t } = useTranslation();
const [visibleActivities, setVisibleActivities] = useState([]);
const [isInitialLoad, setIsInitialLoad] = useState(true);
const loadTimerRef = useRef(null);

// keep timers cleaned up
useEffect(() => {
return () => {
if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
};
}, []);

// Manage visibleActivities: initial staggered entrance, then immediate updates
useEffect(() => {
if (activitiesLoading) {
setVisibleActivities([]);
return;
}

if (isInitialLoad && activities.length > 0) {
// small delay so entrance animations feel natural
loadTimerRef.current = setTimeout(() => {
setVisibleActivities(activities);
setIsInitialLoad(false);
loadTimerRef.current = null;
}, 100);
return () => {
if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
};
}

// subsequent updates: show immediately (no stagger)
setVisibleActivities(activities);
}, [activities, activitiesLoading, isInitialLoad]);

// helpers
const getStatusText = (status) => {
const st = ((status || "") + "").toString().toLowerCase();
if (st === "done" || st === "completed") return t("project.status.completed") || "Completed";
if (st.includes("progress") || st === "in progress") return t("project.status.inProgress") || "In Progress";
return t("project.status.notStarted") || "Not started";
};

const normalizeMetric = (m) => {
if (m == null) return null;
if (typeof m === "object") return m;
if (typeof m === "string") {
const s = m.trim();
if (!s) return null;
try {
const parsed = JSON.parse(s);
return typeof parsed === "object" ? parsed : { value: parsed };
} catch {
return { value: s };
}
}
return { value: String(m) };
};

const renderMetricSummary = (rawMetric) => {
const m = normalizeMetric(rawMetric);
if (!m || (typeof m === "object" && Object.keys(m).length === 0)) return "—";
try {
const pairs = Object.entries(m)
.slice(0, 3)
.map(([k, v]) => `${k}: ${String(v)}`);
let summary = pairs.join(", ");
if (Object.keys(m).length > 3) summary += ` …(+${Object.keys(m).length - 3})`;
const MAX_LEN = 80;
if (summary.length > MAX_LEN) return summary.slice(0, MAX_LEN - 1) + "…";
return summary;
} catch {
const s = JSON.stringify(m);
return s.length > 80 ? s.slice(0, 77) + "…" : s;
}
};

if (activitiesLoading) {
return (
<div role="status" aria-live="polite" className="p-2 text-xs text-gray-500 transition-all duration-300">
<div className="flex items-center gap-2">
<div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
<div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
<div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }} />
<span>{t("project.loadingActivities") || "Loading activities…"}</span>
</div>
</div>
);
}

if (!activities || activities.length === 0) {
return (
<div className="p-4 text-xs text-gray-500 text-center transition-all duration-300 transform hover:scale-105">
<div className="opacity-60 transition-opacity duration-300">{t("project.empty.noActivities") || "No activities for this task."}</div>
</div>
);
}

return (
<div className="space-y-3">
<style>{`
@keyframes slideInUp { from { opacity:0; transform: translateY(20px) scale(.95); } to { opacity:1; transform: translateY(0) scale(1);} }
@keyframes slideOutDown { to { opacity:0; transform: translateY(20px) scale(.95); } }
@keyframes pulseGlow { 0%,100% { box-shadow:0 0 0 0 rgba(59,130,246,.4) } 50% { box-shadow:0 0 0 4px rgba(59,130,246,0) } }
@keyframes bounceIn { 0%{opacity:0;transform:scale(.3);}50%{opacity:1;transform:scale(1.05);}70%{transform:scale(.9);}100%{transform:scale(1);} }
.activity-enter { animation: slideInUp .4s ease-out both; }
.activity-exit { animation: slideOutDown .3s ease-in both; }
.status-completed { animation: bounceIn .6s ease-out both; }
`}</style>

{visibleActivities.map((activity, index) => {
const compositeRoll =
goal?.rollNo != null && task?.rollNo != null && activity?.rollNo != null
? `${String(goal.rollNo)}.${String(task.rollNo)}.${String(activity.rollNo)}`
: activity?.rollNo != null
? String(activity.rollNo)
: null;

const isDone = (activity.status || "").toString().toLowerCase() === "done" || activity.isDone;

return (
<div
key={activity.id}
className="relative activity-enter p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02] group"
style={{
animationDelay: `${index * 80}ms`,
animationFillMode: "both",
transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
}}
>
<div className="flex items-start justify-between gap-2">
<div className="min-w-0 flex-1">
<div className="font-medium text-sm text-gray-900 dark:text-white break-words flex items-center gap-2">
{compositeRoll && (
<span className="text-sky-600 dark:text-sky-400 font-semibold bg-sky-50 dark:bg-sky-900/20 px-2 py-1 rounded-full text-xs">
{compositeRoll}.
</span>
)}
<span>{activity.title}</span>
</div>

<div className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words">{activity.description || t("project.na") || "—"}</div>
</div>

<div className="flex-shrink-0 flex items-center gap-2">
<span
className={`text-xs font-medium px-2 py-1 rounded-full transition-all duration-300 transform ${
isDone
? "status-completed bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
}`}
>
{getStatusText(activity.status)}
</span>

{canManageGTA && (
<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
<button
type="button"
onClick={() => onEditActivity && onEditActivity(activity)}
className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
title={t("project.actions.edit") || "Edit activity"}
>
<Edit className="h-4 w-4" />
</button>
<button
type="button"
onClick={() => onDeleteActivity && onDeleteActivity(activity.id)}
className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
title={t("project.actions.delete") || "Delete activity"}
>
<Trash2 className="h-4 w-4" />
</button>
</div>
)}
</div>
</div>

<div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
<div className="flex items-center gap-4 min-w-0">
<span className="flex items-center gap-1">
<Calendar className="h-3 w-3" />
{formatDate(activity.dueDate) || t("project.na")}
</span>

<span className="whitespace-nowrap">
{t("project.fields.weight") || "Weight"}: <strong>{activity.weight ?? "-"}</strong>
</span>

<div className="flex items-center gap-3 min-w-0">
<div className="text-xs">
<span className="font-semibold mr-1 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded">{t("project.fields.previous", "Previous")}:</span>
<span className="truncate" style={{ maxWidth: 220 }}>{renderMetricSummary(activity.previousMetric)}</span>
</div>

<div className="text-xs">
<span className="font-semibold mr-1 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded">{t("project.fields.target", "Target")}:</span>
<span className="truncate" style={{ maxWidth: 220 }}>{renderMetricSummary(activity.targetMetric)}</span>
</div>

<div className="text-xs">
<span className="font-semibold mr-1 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">{t("project.fields.current", "Current")}:</span>
<span className="truncate" style={{ maxWidth: 220 }}>{renderMetricSummary(activity.currentMetric)}</span>
</div>
</div>
</div>

{reportingActive && (
<button
type="button"
onClick={() => openSubmitModal && openSubmitModal(activity.id)}
disabled={!canSubmitReport}
className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs hover:bg-indigo-600 disabled:opacity-50 transition-all duration-300"
>
<FileText className="h-3 w-3" />
{t("project.actions.submitReport") || "Submit Report"}
{canSubmitReport && <div className="ml-1 h-1 w-1 bg-white rounded-full animate-pulse" />}
</button>
)}
</div>

{/* ---------------------------------------------------------------- */}
{/* MODIFICATION START: Removed progress bar per user request */}
{/* ---------------------------------------------------------------- */}
{/* {String((activity.status || "").toLowerCase()).includes("progress") && (
<div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
<div className="bg-blue-500 h-1.5 rounded-full transition-all duration-1000 ease-out" style={{ width: "60%", animation: "pulseGlow 2s infinite" }} />
</div>
)}
*/}
{/* ---------------------------------------------------------------- */}
{/* MODIFICATION END */}
{/* ---------------------------------------------------------------- */}


{/* completion indicator - container is relative so absolute positions correctly */}
{isDone && (
<div className="absolute top-2 right-2">
<Check className="h-4 w-4 text-green-500" />
</div>
)}
</div>
);
})}
</div>
);
}

ActivityList.propTypes = {
goal: PropTypes.object,
task: PropTypes.object,
activities: PropTypes.array,
activitiesLoading: PropTypes.bool,
onEditActivity: PropTypes.func,
onDeleteActivity: PropTypes.func,
openSubmitModal: PropTypes.func,
canSubmitReport: PropTypes.bool,
reportingActive: PropTypes.bool,
canManageGTA: PropTypes.bool,
};

ActivityList.defaultProps = {
activities: [],
activitiesLoading: false,
canSubmitReport: false,
reportingActive: false,
canManageGTA: false,
};

export default React.memo(ActivityList);
