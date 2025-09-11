// src/controllers/attachmentsController.js
const db = require("../db");
const path = require("path");
const fs = require("fs");
const { UPLOAD_DIR } = require("../middleware/uploadMiddleware");
const { logAudit } = require("../helpers/audit");
const { createNotification } = require("../services/notificationService");


/**
 * Download attachment. Permissions:
 * - admins (manage_reports or manage_attachments) can download any
 * - other users can download only if they belong to the group of the related activity/goal
 */
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

    if (!rows[0]) return res.status(404).json({ error: "Attachment not found." });
    const at = rows[0];

    // permission check
    const userPerms = req.user.permissions || [];
    const isAdmin = userPerms.includes('manage_reports') || userPerms.includes('manage_attachments');

    if (!isAdmin) {
      // check group membership
      const gcheck = await db.query(
        `SELECT 1 FROM "UserGroups" WHERE "userId" = $1 AND "groupId" = $2 LIMIT 1`,
        [req.user.id, at.groupId]
      );
      if (!gcheck.rows.length) return res.status(403).json({ error: "Forbidden" });
    }

    const fullPath = path.join(UPLOAD_DIR, at.filePath);
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size === 0) {
      return res.status(404).json({ error: "File not found on server." });
    }

    await logAudit(req.user.id, 'download', 'Attachment', attachmentId, { fileName: at.fileName });
    res.download(fullPath, at.fileName);
  } catch (err) {
    console.error("Error downloading attachment:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Delete attachment:
 * - submitter (owner of report) can delete pre-review (report.status==='Pending')
 * - admins (manage_reports or manage_attachments) can delete anytime
 */
exports.deleteAttachment = async (req, res) => {
  const { attachmentId } = req.params;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const q = await client.query(
      `SELECT at.*, r."userId" as reportUserId, r.status as reportStatus
       FROM "Attachments" at
       JOIN "Reports" r ON r.id = at."reportId"
       WHERE at.id = $1 FOR UPDATE`,
      [attachmentId]
    );
    if (!q.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: "Attachment not found." }); }
    const row = q.rows[0];

    const userPerms = req.user.permissions || [];
    const isAdmin = userPerms.includes('manage_reports') || userPerms.includes('manage_attachments');

    if (!isAdmin) {
      // only allow submitter to delete before review
      if (row.reportUserId !== req.user.id || row.reportStatus !== 'Pending') {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    // delete db row
    await client.query('DELETE FROM "Attachments" WHERE id = $1', [attachmentId]);

    // delete file from disk
    const fullPath = path.join(UPLOAD_DIR, row.filePath);
    try { fs.unlinkSync(fullPath); } catch (e) { /* ignore */ }

    await logAudit(req.user.id, 'delete', 'Attachment', attachmentId, { fileName: row.fileName });
    await client.query('COMMIT');
    res.json({ message: 'Attachment deleted.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error deleting attachment:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

/**
 * Admin-only list attachments (optionally filter by reportId)
 */
exports.listAttachments = async (req, res) => {
  const { reportId } = req.query;
  try {
    const params = reportId ? [reportId] : [];
    const where = reportId ? 'WHERE at."reportId" = $1' : '';
    const { rows } = await db.query(`
      SELECT at.*, r."activityId", r."userId" as reportUserId
      FROM "Attachments" at
      JOIN "Reports" r ON r.id = at."reportId"
      ${where}
      ORDER BY at."createdAt" DESC
    `, params);
    res.json(rows);
  } catch (err) {
    console.error("Error listing attachments:", err);
    res.status(500).json({ error: err.message });
  }
};
