import { api } from "./auth"; // your existing api helper

// GET all reports
export const fetchAllReports = () => api("/api/reports", "GET");

// SUBMIT a new report for an activity
// activityId: ID of the activity
// reportData: { narrative, metrics_data, new_status }
// files: optional FormData for attachments
export const submitReport = (activityId, reportData, files = null) => {
  if (files) {
    // If there are files, use FormData
    const formData = new FormData();
    Object.keys(reportData).forEach((key) => {
      if (reportData[key] !== undefined && reportData[key] !== null) {
        formData.append(key, reportData[key]);
      }
    });
    files.forEach((file) => formData.append("files", file));
    return api(`/api/reports/${activityId}`, "POST", formData, true); // true = multipart
  } else {
    return api(`/api/reports/${activityId}`, "POST", reportData);
  }
};

// REVIEW a report (approve/reject)
export const reviewReport = (reportId, reviewData) =>
  api(`/api/reports/review/${reportId}`, "PATCH", reviewData);

// GENERATE master report (HTML)
export const generateMasterReport = (groupId = null) =>
  api(`/api/reports/master-report${groupId ? `?groupId=${groupId}` : ""}`, "GET");
