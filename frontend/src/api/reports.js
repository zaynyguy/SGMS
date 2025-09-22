import { api } from "./auth";

export const submitReport = (activityId, formData) => {
  if (!activityId) throw new Error("activityId required");
  if (!(formData instanceof FormData)) {
    throw new Error("formData must be a FormData instance");
  }
  return api(`/api/reports/activity/${activityId}`, "POST", formData, {
    isFormData: true,
  });
};

export const fetchReports = (page = 1, pageSize = 20, status, q) => {
  const params = new URLSearchParams();
  params.append("page", page);
  params.append("pageSize", pageSize);
  if (status) params.append("status", status);
  if (q) params.append("q", q);
  return api(`/api/reports?${params.toString()}`, "GET");
};

export const reviewReport = (id, reviewData) =>
  api(`/api/reports/${id}/review`, "PUT", reviewData);

export const fetchReportById = (id) => api(`/api/reports/${id}`, "GET");

export const fetchMasterReport = (groupId) => {
  const qs = groupId ? `?groupId=${encodeURIComponent(groupId)}` : "";
  return api(`/api/reports/master-report${qs}`, "GET");
};

export const fetchReportingStatus = async () => {
  const data = await api("/api/reports/reporting-status", "GET");
  return {
    reporting_active:
      data && typeof data.reporting_active !== "undefined"
        ? Boolean(data.reporting_active)
        : null,
    raw: data,
  };
};

export default {
  submitReport,
  fetchReports,
  reviewReport,
  fetchReportById,
  fetchMasterReport,
  fetchReportingStatus,
};
