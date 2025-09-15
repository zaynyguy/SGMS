// src/controllers/attachmentsController.js
const db = require("../db");
const path = require("path");
const fs = require("fs");
const { UPLOAD_DIR } = require("../middleware/uploadMiddleware");
const { uploadFile, deleteFile } = require("../services/uploadService");
const { logAudit } = require("../helpers/audit");
const http = require("http");
const https = require("https");
const { URL } = require("url");

exports.downloadAttachment = async (req, res) => {
  const { attachmentId } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT at.*, r."activityId", a."taskId", t."goalId", g."groupId"
       FROM "Attachments" at
       JOIN "Reports" r ON r.id = at."reportId"
       JOIN "Activities" a ON a.id = r."activityId"
       JOIN "Tasks" t ON t.id = a."taskId"
       JOIN "Goals" g ON g.id = t."goalId"
       WHERE at.id = $1`,
      [attachmentId]
    );

    if (!rows[0])
      return res.status(404).json({ error: "Attachment not found." });
    const at = rows[0];

    const userPerms = req.user.permissions || [];
    const isAdmin =
      userPerms.includes("manage_reports") ||
      userPerms.includes("manage_attachments");

    if (!isAdmin) {
      const gcheck = await db.query(
        `SELECT 1 FROM "UserGroups" WHERE "userId" = $1 AND "groupId" = $2 LIMIT 1`,
        [req.user.id, at.groupId]
      );
      if (!gcheck.rows.length)
        return res.status(403).json({ error: "Forbidden" });
    }

    // Audit the download attempt
    try {
      await logAudit({
        userId: req.user.id,
        action: "ATTACHMENT_DOWNLOADED",
        entity: "Attachment",
        entityId: attachmentId,
        details: { fileName: at.fileName },
        req,
      });
    } catch (e) {
      console.error("ATTACHMENT_DOWNLOADED audit failed:", e);
    }

    if (at.provider === "cloudinary" || /^https?:\/\//i.test(at.filePath)) {
      // Proxy the remote file to avoid client-side CORS issues.
      // at.filePath is expected to be a full URL for cloud files.
      let fileUrl = at.filePath;
      // If stored local-style (/uploads/...), try to build an absolute URL using request origin
      if (!/^https?:\/\//i.test(fileUrl)) {
        // If it's a relative path (local), serve it from disk below (fallback).
        fileUrl = null;
      }

      if (fileUrl) {
        try {
          const parsed = new URL(fileUrl);
          const lib = parsed.protocol === "https:" ? https : http;
          const requestOptions = {
            headers: {
              // We don't send auth to cloud host — it's public URL.
              // But copying client-accept header might improve content negotiation.
              accept: req.headers.accept || "*/*",
            },
          };

          lib.get(fileUrl, requestOptions, (proxRes) => {
            if (proxRes.statusCode >= 400) {
              return res.status(proxRes.statusCode).send("Failed to fetch remote file");
            }

            // Copy important headers
            const ct = proxRes.headers["content-type"];
            const cl = proxRes.headers["content-length"];

            if (ct) res.setHeader("Content-Type", ct);
            if (cl) res.setHeader("Content-Length", cl);

            // Force download filename to DB's original filename
            const safeName = String(at.fileName || `attachment-${attachmentId}`).replace(/["\\]/g, "");
            res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);

            // Pipe remote response directly to our response
            proxRes.pipe(res);
            proxRes.on("error", (err) => {
              console.error("Error piping remote file:", err);
              try { res.end(); } catch (e) {}
            });
          }).on("error", (err) => {
            console.error("Remote request failed:", err);
            res.status(502).json({ error: "Failed fetching remote file." });
          });

          return;
        } catch (err) {
          console.error("Error proxying remote file:", err);
          // fallback to local serve if possible below
        }
      }
    }

    // Local file fallback (or when provider === 'local')
    const fullPath = path.join(UPLOAD_DIR, path.basename(at.filePath));
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "File not found on server." });
    }
    return res.download(fullPath, at.fileName);
  } catch (err) {
    console.error("Error downloading attachment:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteAttachment = async (req, res) => {
  const { attachmentId } = req.params;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const q = await client.query(
      `SELECT at.*, r."userId" as reportUserId, r.status as reportStatus
       FROM "Attachments" at
       JOIN "Reports" r ON r.id = at."reportId"
       WHERE at.id = $1 FOR UPDATE`,
      [attachmentId]
    );
    if (!q.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Attachment not found." });
    }
    const row = q.rows[0];

    const userPerms = req.user.permissions || [];
    const isAdmin =
      userPerms.includes("manage_reports") ||
      userPerms.includes("manage_attachments");

    if (
      !isAdmin &&
      (row.reportUserId !== req.user.id || row.reportStatus !== "Pending")
    ) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Forbidden" });
    }

    await client.query('DELETE FROM "Attachments" WHERE id = $1', [
      attachmentId,
    ]);

    if (row.provider === "cloudinary") {
      // pass the stored publicId if present
      await deleteFile(row.filePath, { publicId: row.publicId || null });
    } else {
      const fullPath = path.join(UPLOAD_DIR, path.basename(row.filePath));
      try {
        fs.unlinkSync(fullPath);
      } catch (e) {}
    }

    // Audit deletion inside tx
    try {
      await logAudit({
        userId: req.user.id,
        action: "ATTACHMENT_DELETED",
        entity: "Attachment",
        entityId: attachmentId,
        before: row,
        client,
        req,
      });
    } catch (e) {
      console.error("ATTACHMENT_DELETED audit failed (in-tx):", e);
    }

    await client.query("COMMIT");
    res.json({ message: "Attachment deleted." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting attachment:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.listAttachments = async (req, res) => {
  const { reportId } = req.query;
  try {
    const params = reportId ? [reportId] : [];
    const where = reportId ? 'WHERE at."reportId" = $1' : "";
    const { rows } = await db.query(
      `
      SELECT at.*, r."activityId", r."userId" as reportUserId
      FROM "Attachments" at
      JOIN "Reports" r ON r.id = at."reportId"
      ${where}
      ORDER BY at."createdAt" DESC
    `,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error("Error listing attachments:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.uploadAttachment = async (req, res) => {
  try {
    const { file } = req;
    const { reportId } = req.body;
    if (!file || !reportId)
      return res.status(400).json({ error: "File and reportId required." });

    const uploaded = await uploadFile(file);

    // uploaded now returns publicId (standardized)
    const { url, provider, fileName, fileType, publicId } = uploaded;
    const { rows } = await db.query(
      `INSERT INTO "Attachments" ("reportId","fileName","filePath","fileType","provider","createdAt", "publicId")
   VALUES ($1,$2,$3,$4,$5,NOW(), $6) RETURNING *`,
      [reportId, fileName, url, fileType, provider, publicId || null]
    );

    try {
      await logAudit({
        userId: req.user.id,
        action: "ATTACHMENT_UPLOADED",
        entity: "Attachment",
        entityId: rows[0].id,
        details: { fileName: uploaded.fileName },
        req,
      });
    } catch (e) {
      console.error("ATTACHMENT_UPLOADED audit failed:", e);
    }

    res.status(201).json({ message: "File uploaded", attachment: rows[0] });
  } catch (err) {
    console.error("Error uploading attachment:", err);
    res.status(500).json({ error: err.message });
  }
};
