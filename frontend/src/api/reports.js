// src/api/reports.js
import { api } from './auth'; // Generic API helper

// ======================
// REPORT MANAGEMENT API
// ======================

export async function submitReport(activityId, payload) {
  try {
    const response = await fetch(`/api/reports/activity/${activityId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to submit report: ${errText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error submitting report:", error);
    throw error;
  }
}


// Fetch all reports (admin/manager)
export const fetchReports = () => api('/api/reports', 'GET');

// Review a report (approve/reject with comment & optional resubmission deadline)
export const reviewReport = (id, reviewData) =>
  api(`/api/reports/${id}/review`, 'PUT', reviewData);

// Fetch a specific report by ID
export const fetchReportById = (id) => api(`/api/reports/${id}`, 'GET');

// ======================
// MASTER REPORT API
// ======================

// Fetch master report as JSON
export const fetchMasterReport = (groupId) => {
  let qs = [];
  if (groupId) qs.push(`groupId=${encodeURIComponent(groupId)}`);
  return api(`/api/reports/master-report?${qs.join('&')}`, 'GET');
};

