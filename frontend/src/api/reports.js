import { api, rawFetch } from "./auth";

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

export const downloadMasterReportExcel = async (groupId) => {
  const qs = groupId
    ? `?groupId=${encodeURIComponent(groupId)}&format=excel`
    : "?format=excel";
  const res = await rawFetch(`/api/reports/master-report${qs}`, "GET");
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.blob();
};

export const importProjectExcel = (file) => {
  if (!(file instanceof File)) {
    throw new Error("A File object is required for Excel import.");
  }
  const formData = new FormData();
  formData.append("file", file);
  return api("/api/reports/import", "POST", formData, {
    isFormData: true,
  });
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
  downloadMasterReportExcel,
  importProjectExcel,
  fetchReportingStatus,
};
