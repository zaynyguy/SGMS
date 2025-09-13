// src/controllers/attachmentsController.js
const db = require("../db");
const path = require("path");
const fs = require("fs");
const { UPLOAD_DIR } = require("../middleware/uploadMiddleware");
const { uploadFile, deleteFile } = require("../services/uploadService");
const { logAudit } = require("../helpers/audit");

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

    if (at.provider === "cloudinary") {
      // Audit redirect/download as well
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
      return res.redirect(at.filePath);
    } else {
      const fullPath = path.join(UPLOAD_DIR, path.basename(at.filePath));
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "File not found on server." });
      }
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
      return res.download(fullPath, at.fileName);
    }
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
      await deleteFile(row.filePath, { public_id: row.publicId || row.publicId });
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

    const { url, provider, fileName, fileType, public_id } = uploaded;
    const { rows } = await db.query(
      `INSERT INTO "Attachments" ("reportId","fileName","filePath","fileType","provider","createdAt", "publicId")
   VALUES ($1,$2,$3,$4,$5,NOW(), $6) RETURNING *`,
      [reportId, fileName, url, fileType, provider, public_id || null]
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
