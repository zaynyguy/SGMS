// src/api/reports.js
import { api } from "./auth";

// -------------------- REPORT SUBMISSION --------------------

// Submit a report for an activity
// Expects FormData (narrative, metrics_data, new_status, attachments[])
export const submitReport = (activityId, formData) => {
  if (!activityId) throw new Error("activityId required");
  if (!(formData instanceof FormData)) {
    throw new Error("formData must be a FormData instance");
  }

  return api(`/api/reports/activity/${activityId}`, "POST", formData, {
    isFormData: true, // <- tells api helper not to JSON.stringify or set Content-Type
  });
};

// -------------------- REPORT MANAGEMENT --------------------

// Fetch all reports
export const fetchReports = (page = 1, pageSize = 20, status, q) => {
  const params = new URLSearchParams();
  params.append("page", page);
  params.append("pageSize", pageSize);
  if (status) params.append("status", status);
  if (q) params.append("q", q);
  return api(`/api/reports?${params.toString()}`, "GET");
};

// Review a report (approve/reject)
export const reviewReport = (id, reviewData) =>
  api(`/api/reports/${id}/review`, "PUT", reviewData);

// Fetch one report by ID
export const fetchReportById = (id) => api(`/api/reports/${id}`, "GET");

// -------------------- MASTER REPORT --------------------

// Fetch master report JSON (optionally filter by groupId)
export const fetchMasterReport = (groupId) => {
  const qs = groupId ? `?groupId=${encodeURIComponent(groupId)}` : "";
  return api(`/api/reports/master-report${qs}`, "GET");
};

// -------------------- REPORTING STATUS (NEW) --------------------

// Simple endpoint for frontend to ask "is reporting allowed right now?"
// Expected return shape: { reporting_active: true }  (if backend sends different shape, adapt accordingly)
export const fetchReportingStatus = async () => {
  // This will throw on HTTP errors (see api() helper)
  const data = await api("/api/reports/reporting-status", "GET");
  // Be defensive: return normalized object
  return {
    reporting_active:
      data && typeof data.reporting_active !== "undefined"
        ? Boolean(data.reporting_active)
        : null,
    raw: data,
  };
};

// -------------------- exports (named) --------------------
export default {
  submitReport,
  fetchReports,
  reviewReport,
  fetchReportById,
  fetchMasterReport,
  fetchReportingStatus,
};
