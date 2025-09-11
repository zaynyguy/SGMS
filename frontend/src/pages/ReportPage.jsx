import React, { useState, useEffect } from "react";
import { submitReport, fetchReports, reviewReport, fetchMasterReport } from "../api/reports";

/* --- Nav Component --- */
function Nav({ current, onChange }) {
  const items = [
    { id: "submit", label: "Submit Report", icon: "📝" },
    { id: "review", label: "Review Reports", icon: "👁️" },
    { id: "master", label: "Master Report", icon: "📊" },
  ];
  
  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-2 md:p-3 flex flex-wrap gap-2 mb-6 border-t-4 border-gray-900 dark:border-gray-200">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={`px-3 py-2 md:px-4 md:py-2 rounded-lg font-medium text-sm flex items-center gap-1 transition-colors ${
            current === it.id
              ? "bg-blue-600 text-white shadow-md"
              : "text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          <span className="text-base">{it.icon}</span>
          <span className="hidden sm:inline">{it.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* --- Submit Report Page --- */
function SubmitReportPage() {
  const [activityId, setActivityId] = useState("");
  const [narrative, setNarrative] = useState("");
  const [metrics, setMetrics] = useState([{ id: 1, key: "", value: "" }]);
  const [newStatus, setNewStatus] = useState("");
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
    if (Object.keys(metricsObj).length)
      form.append("metrics_data", JSON.stringify(metricsObj));
    if (newStatus) form.append("new_status", newStatus);

    setSubmitting(true);
    try {
      const data = await submitReport(activityId, form);
      setMessage({ type: "success", text: `Report submitted successfully (ID: ${data.id})` });
      setActivityId("");
      setNarrative("");
      setMetrics([{ id: 1, key: "", value: "" }]);
      setNewStatus("");
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-lg border-t-4 border-gray-900 dark:border-gray-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">Submit Report</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Activity ID</label>
          <input
            value={activityId}
            onChange={(e) => setActivityId(e.target.value)}
            className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="Enter activity ID"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Narrative</label>
          <textarea
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            rows={4}
            className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="Provide a detailed narrative of your report"
          />
        </div>
        
        <div>
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
        
        <div>
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
        
        <div className="pt-4">
          <button
            disabled={submitting}
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
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
        </div>
        
        {message && (
          <div className={`p-4 rounded-lg ${message.type === "error" ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800" : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"}`}>
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
  );
}

/* --- Review Reports Page --- */
function ReviewReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [actionState, setActionState] = useState({});

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);
    try {
      const data = await fetchReports();
      setReports(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(id, status) {
    const adminComment = actionState[id]?.comment || null;
    const resubmissionDeadline = actionState[id]?.deadline || null;
    try {
      await reviewReport(id, { status, adminComment, resubmissionDeadline });
      setReports((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
      alert("Review updated successfully");
    } catch (err) {
      alert("Failed: " + err.message);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">Review Reports</h2>
      </div>
      
      {loading && (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {!loading && reports.length === 0 && (
        <div className="text-center py-10 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-gray-500 dark:text-gray-400">No reports available for review</p>
        </div>
      )}
      
      <div className="space-y-4">
        {reports.map((r) => (
          <div key={r.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start p-4 bg-white dark:bg-gray-800">
              <div className="flex-1 mb-3 sm:mb-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 dark:text-white">Report #{r.id}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    r.status === "Approved" ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300" :
                    r.status === "Rejected" ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300" :
                    "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                  }`}>
                    {r.status}
                  </span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 text-sm">{r.activity_title}</p>
              </div>
              <button
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm"
              >
                {expanded === r.id ? (
                  <>
                    <span className="hidden sm:inline">Collapse</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">Expand</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
            
            {expanded === r.id && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/50 space-y-4">
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Metrics Data</h4>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
                    <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {JSON.stringify(r.metrics_data, null, 2)}
                    </pre>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Admin Comment</label>
                  <input
                    placeholder="Enter your comment here"
                    value={actionState[r.id]?.comment || ""}
                    onChange={(e) => setActionState((s) => ({ ...s, [r.id]: { ...(s[r.id] || {}), comment: e.target.value } }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Resubmission Deadline (optional)</label>
                  <input
                    type="date"
                    value={actionState[r.id]?.deadline || ""}
                    onChange={(e) => setActionState((s) => ({ ...s, [r.id]: { ...(s[r.id] || {}), deadline: e.target.value } }))}
                    className="px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button 
                    onClick={() => handleReview(r.id, "Approved")} 
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-4 rounded-lg transition text-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Approve
                  </button>
                  <button 
                    onClick={() => handleReview(r.id, "Rejected")} 
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-lg transition text-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* --- Master Report Page --- */
function MasterReportPage() {
  const [groupId, setGroupId] = useState("");
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    if (!groupId) {
      alert("Please enter a Group ID");
      return;
    }
    
    setGenerating(true);
    const w = window.open("", "_blank");
    try {
      const data = await fetchMasterReport(groupId);
      const html = generateHtmlReport(data);
      w.document.write(html);
      w.document.close();
    } catch (err) {
      w.document.write("<p>Failed to generate report: " + (err.message || "Unknown error") + "</p>");
    } finally {
      setGenerating(false);
    }
  }

  function generateHtmlReport(data) {
    // Same implementation as before
    const goals = data?.goals || [];

    function formatMetrics(report) {
      let metrics = report.metrics_data ?? report.metrics;
      if (!metrics) return "-";

      let obj;
      if (typeof metrics === "string") {
        try {
          obj = JSON.parse(metrics);
        } catch {
          return metrics;
        }
      } else {
        obj = metrics;
      }

      if (!obj || Object.keys(obj).length === 0) return "-";

      return `<ul style="margin:0; padding-left:15px;">${
        Object.entries(obj)
          .map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`)
          .join("")
      }</ul>`;
    }

    return `<!DOCTYPE html>
<html>
<head>
<title>Master Report</title>
<style>
body { font-family: Arial, sans-serif; padding: 20px; }
h1 { color: #2563eb; }
h2 { color: #1d4ed8; margin-top: 30px; }
h3 { color: #1e40af; margin-top: 20px; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
th, td { border: 1px solid #ddd; padding: 6px; font-size: 14px; vertical-align: top; }
th { background: #f3f4f6; }
</style>
</head>
<body>
<h1>Master Report</h1>
<p>Generated: ${data?.generationDate ?? "N/A"}</p>

${goals.length === 0 ? "<p>No goals found.</p>" : goals.map(goal => `
<h2>Goal: ${goal.title} (Status: ${goal.status}, Progress: ${goal.progress}%)</h2>
${goal.tasks.length === 0 ? "<p>No tasks.</p>" : goal.tasks.map(task => `
<h3>Task: ${task.title}</h3>
${task.activities?.length === 0 ? "<p>No activities.</p>" : task.activities.map(activity => `
<p><strong>Activity:</strong> ${activity.title}</p>
${activity.reports?.length === 0 ? "<p>No reports.</p>" : `
<table>
<thead>
<tr><th>Report ID</th><th>Narrative</th><th>Status</th><th>Metrics</th></tr>
</thead>
<tbody>
${activity.reports.map(r => `<tr>
<td>${r.id ?? ""}</td>
<td>${r.narrative ?? ""}</td>
<td>${r.status ?? ""}</td>
<td>${formatMetrics(r)}</td>
</tr>`).join("")}
</tbody>
</table>`}
`).join("")}
`).join("")}
`).join("")}

</body>
</html>`;
  }  

  return (
    <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">Master Report</h2>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6 border border-blue-100 dark:border-blue-800/30">
        <p className="text-blue-700 dark:text-blue-300 text-sm">Generate a comprehensive master report for any group by entering the Group ID below.</p>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group ID</label>
          <input
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            placeholder="Enter Group ID"
            className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>
        <button 
          onClick={handleGenerate} 
          disabled={generating}
          className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed mt-2 sm:mt-0"
        >
          {generating ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </span>
          ) : (
            "Generate Report"
          )}
        </button>
      </div>
    </div>
  );
}

/* --- Main App Wrapper --- */
export default function ReportsUI() {
  const [page, setPage] = useState("submit");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 max-w-8xl mx-auto transition-colors duration-200">
      
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">Reports Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 md:mt-2">Submit, review, and generate comprehensive reports</p>
      </header>
      
      <Nav current={page} onChange={setPage} />
      {page === "submit" && <SubmitReportPage />}
      {page === "review" && <ReviewReportsPage />}
      {page === "master" && <MasterReportPage />}
      
      <footer className="mt-8 md:mt-12 text-center text-gray-500 dark:text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} Report System | v2.0</p>
      </footer>
    </div>
  );
}