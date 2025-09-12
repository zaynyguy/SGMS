// src/api/attachments.js
import { api } from "./auth";

export const fetchAttachments = (reportId) => {
  const qs = reportId ? `?reportId=${encodeURIComponent(reportId)}` : "";
  return api(`/api/reports/attachments${qs}`, "GET");
};

export const deleteAttachment = (attachmentId) =>
  api(`/api/reports/attachments/${attachmentId}`, "DELETE");

// attachments.js (frontend API helper)
export const downloadAttachment = (id) =>
  api(`/api/attachments/${id}/download`, "GET");

