// src/api/attachments.js
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Fetch attachments list for a report (returns array)
 */
export const fetchAttachments = (reportId) => {
  const qs = reportId ? `?reportId=${encodeURIComponent(reportId)}` : "";
  return fetch(`${API_URL}/api/reports/attachments${qs}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(localStorage.getItem("authToken") ? { Authorization: `Bearer ${localStorage.getItem("authToken")}` } : {}),
    },
  }).then(async (res) => {
    const text = await res.text();
    let data = text;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!res.ok) {
      const err = new Error(data?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.response = data;
      throw err;
    }
    if (Array.isArray(data)) return data;
    if (data && data.rows) return data.rows;
    return data;
  });
};

export const deleteAttachment = (attachmentId) =>
  fetch(`${API_URL}/api/reports/attachments/${encodeURIComponent(attachmentId)}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      ...(localStorage.getItem("authToken") ? { Authorization: `Bearer ${localStorage.getItem("authToken")}` } : {}),
    },
  }).then(async (res) => {
    const text = await res.text();
    let data = text;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!res.ok) {
      const err = new Error(data?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.response = data;
      throw err;
    }
    return data;
  });

/**
 * downloadAttachment(id)
 * - Fetches the download endpoint and returns { blob, filename }.
 * - If server returns JSON with { url } (fallback), returns { url }.
 */
export const downloadAttachment = async (id) => {
  const token = localStorage.getItem("authToken");
  const url = `${API_URL}/api/reports/attachments/${encodeURIComponent(id)}/download`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "*/*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    redirect: "follow",
  });

  if (!res.ok) {
    // try parse JSON error
    const text = await res.text();
    let data = text;
    try { data = text ? JSON.parse(text) : null; } catch {}
    throw new Error(data?.message || `Download failed: HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";

  // If JSON — maybe server returned { url } or error
  if (contentType.includes("application/json")) {
    const json = await res.json();
    if (json && json.url) return { url: json.url };
    throw new Error(json?.message || "Unexpected JSON response for download");
  }

  // parse filename from content-disposition if present
  const cd = res.headers.get("content-disposition") || "";
  let filename = null;
  if (cd) {
    // Handles filename, filename*=UTF-8''..., or quoted names
    const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^;"']+)["']?/i);
    if (m && m[1]) {
      try {
        filename = decodeURIComponent(m[1]);
      } catch {
        filename = m[1];
      }
    }
  }

  const blob = await res.blob();
  return { blob, filename };
};
