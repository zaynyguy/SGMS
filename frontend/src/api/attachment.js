// src/api/attachments.js
import { api } from "./auth";


// list attachments (uses existing api wrapper)
export const fetchAttachments = (reportId) => {
  const qs = reportId ? `?reportId=${encodeURIComponent(reportId)}` : "";
  return api(`/api/reports/attachments${qs}`, "GET");
};

export const deleteAttachment = (attachmentId) =>
  api(`/api/reports/attachments/${attachmentId}`, "DELETE");

// IMPORTANT: use fetch for binary downloads (do not use api() which expects JSON)
export const downloadAttachment = async (attachmentId) => {
  const url = `/api/reports/attachments/${encodeURIComponent(attachmentId)}/download`;

  const res = await fetch(url, {
    method: "GET",
    // include credentials if your server uses cookies for auth:
    credentials: "include",
    // If you use a bearer token, you can add Authorization header here:
    // headers: { "Authorization": `Bearer ${token}` }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Download failed: ${res.status} ${res.statusText} ${text ? "- " + text : ""}`);
  }

  // parse filename from Content-Disposition if present
  const disposition = res.headers.get("content-disposition") || "";
  let filename = `attachment-${attachmentId}`;
  const match = /filename\*?=(?:UTF-8'')?["']?([^;"']+)["']?/i.exec(disposition);
  if (match && match[1]) {
    try { filename = decodeURIComponent(match[1]); } catch (e) { filename = match[1]; }
  }

  const blob = await res.blob();
  return { blob, filename };
};
