// src/api/attachments.js
import { api, rawFetch } from "./auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const fetchAttachments = async (reportId) => {
  const qs = reportId ? `?reportId=${encodeURIComponent(reportId)}` : "";
  const data = await api(`/api/reports/attachments${qs}`, "GET");
  if (Array.isArray(data)) return data;
  if (data && data.rows) return data.rows;
  return data;
};

export const deleteAttachment = async (attachmentId) => {
  return api(`/api/reports/attachments/${encodeURIComponent(attachmentId)}`, "DELETE");
};

export const downloadAttachment = async (id) => {
  const res = await rawFetch(`/api/reports/attachments/${encodeURIComponent(id)}/download`, "GET");
  if (!res.ok) {
    const txt = await res.text();
    let parsed;
    try { parsed = txt ? JSON.parse(txt) : null; } catch { parsed = txt || null; }
    throw new Error(parsed?.message || `Download failed: HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = await res.json();
    if (json && json.url) return { url: json.url };
    throw new Error(json?.message || "Unexpected JSON response for download");
  }

  const cd = res.headers.get("content-disposition") || "";
  let filename = null;
  if (cd) {
    const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^;"']+)["']?/i);
    if (m && m[1]) {
      try { filename = decodeURIComponent(m[1]); } catch { filename = m[1]; }
    }
  }

  const blob = await res.blob();
  return { blob, filename };
};
