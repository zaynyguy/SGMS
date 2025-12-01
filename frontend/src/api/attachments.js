// src/api/attachments.js
import { api, rawFetch } from "./auth";

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

function parseContentDisposition(cd) {

  let filename = null;
  const rfc5987 = cd.match(/filename\*=UTF-8''([^\s;]+)/i);
  if (rfc5987 && rfc5987[1]) {
    try {
      filename = decodeURIComponent(rfc5987[1]);
    } catch {}
  }

  if (!filename) {
    const ascii = cd.match(/filename="?([^";]+)"?/i);
    if (ascii && ascii[1]) {
      filename = ascii[1].replace(/^"|"$/g, "");
    }
  }

  return filename;
}

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

  // ✅ Properly decode UTF-8 filename
  const cd = res.headers.get("content-disposition") || "";
  const filename = parseContentDisposition(cd);

  const blob = await res.blob();
  return { blob, filename };
};