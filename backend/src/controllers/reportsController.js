// src/controllers/reportsController.js
const db = require("../db");
const path = require("path");
const fs = require("fs");
const { logAudit } = require("../helpers/audit");
const notificationService = require("../services/notificationService");
const {
  generateReportHtml,
  generateReportJson,
} = require("../helpers/reportHelper");
const { UPLOAD_DIR } = require("../middleware/uploadMiddleware");
const { getAttachmentSettings } = require("../utils/systemSettings");

exports.submitReport = async (req, res) => {
  const { activityId } = req.params;
  const { narrative, metrics_data, new_status } = req.body;

  try {
    const setting = await db.query(
      `SELECT value FROM "SystemSettings" WHERE key = 'reporting_active' LIMIT 1`
    );
    if (setting.rows[0] && setting.rows[0].value === false) {
      return res
        .status(403)
        .json({ message: "Reporting is currently disabled." });
    }
  } catch (err) {
    // missing setting is fine
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const reportResult = await client.query(
      `INSERT INTO "Reports"("activityId", "userId", narrative, metrics_data, new_status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        activityId,
        req.user.id,
        narrative || null,
        metrics_data ? JSON.parse(metrics_data) : null,
        new_status || null,
      ]
    );

    const report = reportResult.rows[0];

    // Validate attachments
    if (req.files && req.files.length) {
      const { maxSizeMb } = await getAttachmentSettings();
      const maxBytes = (Number(maxSizeMb) || 10) * 1024 * 1024;
      const oversized = req.files.filter((f) => {
        try {
          const stats = fs.statSync(f.path);
          return stats.size > maxBytes;
        } catch {
          return true;
        }
      });
      if (oversized.length) {
        for (const f of req.files) fs.unlinkSync(f.path);
        return res.status(400).json({
          message: `One or more files exceed the maximum allowed size of ${maxSizeMb} MB.`,
        });
      }
    }

    const insertedAttachments = [];

    if (req.files && req.files.length) {
      for (let file of req.files) {
        const relativePath = path.relative(UPLOAD_DIR, file.path);
        const insertRes = await client.query(
          `INSERT INTO "Attachments"("reportId", "fileName", "filePath", "fileType") VALUES ($1, $2, $3, $4) RETURNING *`,
          [report.id, file.originalname, relativePath, file.mimetype]
        );
        insertedAttachments.push(insertRes.rows[0]);
      }
    }

    await logAudit(req.user.id, "submit", "Report", report.id, { activityId });

    await client.query("COMMIT");

    for (const inserted of insertedAttachments) {
      try {
        await notificationService({
          userId: req.user.id,
          type: "attachment_uploaded",
          message: `Attachment "${inserted.fileName}" uploaded.`,
          meta: { attachmentId: inserted.id, reportId: report.id },
        });
      } catch (nerr) {
        console.error("submitReport: attachment notification failed:", nerr);
      }
    }

    res.status(201).json(report);
  } catch (err) {
    await client.query("ROLLBACK");
    if (req.files && req.files.length) {
      for (let file of req.files) fs.unlinkSync(file.path);
    }
    console.error("Error submitting report:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.reviewReport = async (req, res) => {
  const { reportId } = req.params;
  const { status, adminComment, resubmissionDeadline } = req.body;

  if (!status || !["Approved", "Rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status provided." });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const repRes = await client.query(
      `SELECT * FROM "Reports" WHERE id = $1 FOR UPDATE`,
      [reportId]
    );
    if (!repRes.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Report not found." });
    }
    const report = repRes.rows[0];

    const { rows: updatedRows } = await client.query(
      `UPDATE "Reports"
       SET status = $1,
           "adminComment" = COALESCE($2, "adminComment"),
           "resubmissionDeadline" = COALESCE($3, "resubmissionDeadline"),
           "updatedAt" = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, adminComment || null, resubmissionDeadline || null, reportId]
    );
    const updatedReport = updatedRows[0];

    await logAudit(req.user.id, "review_report", "Report", reportId, {
      status,
      adminComment,
    });

    if (status === "Approved") {
      // Apply metrics to activity
      if (updatedReport.metrics_data) {
        await client.query(
          `UPDATE "Activities"
           SET "currentMetric" = COALESCE($1, "currentMetric"), "updatedAt" = NOW()
           WHERE id = $2`,
          [updatedReport.metrics_data, report.activityId]
        );
      }

      // Update activity status if report specifies new_status
      if (updatedReport.new_status) {
        const newStatus = updatedReport.new_status;
        await client.query(
          `UPDATE "Activities"
     SET status = $1::"activity_status",
         "isDone" = CASE WHEN $1::"activity_status"='Done' THEN true ELSE "isDone" END,
         "updatedAt" = NOW()
     WHERE id = $2`,
          [newStatus, report.activityId]
        );
      }

      // Fetch activity + task + goal for progress snapshot
      const aRes = await client.query(
        `SELECT a.id, a."taskId", t."goalId", a."currentMetric", a."weight", a."isDone"
         FROM "Activities" a
         JOIN "Tasks" t ON t.id = a."taskId"
         WHERE a.id = $1 LIMIT 1`,
        [report.activityId]
      );

      if (aRes.rows[0]) {
        const act = aRes.rows[0];
        const gRes = await client.query(
          `SELECT "groupId" FROM "Goals" WHERE id = $1 LIMIT 1`,
          [act.goalId]
        );
        const groupId = gRes.rows[0] ? gRes.rows[0].groupId : null;

        await client.query(
          `INSERT INTO "ProgressHistory"("entity_type","entity_id","group_id","progress","metrics","recorded_at")
           VALUES ($1,$2,$3,$4,$5,NOW())`,
          [
            "Activity",
            act.id,
            groupId,
            act.progress || 0,
            act.currentMetric || {},
          ]
        );
      }
    }

    await client.query("COMMIT");

    try {
      await notificationService({
        userId: report.userId,
        type: "report_review",
        message: `Your report #${report.id} was ${status.toLowerCase()}.`,
        meta: { reportId: report.id },
        level: status === "Rejected" ? "warning" : "info",
      });
    } catch (nerr) {
      console.error("reviewReport: notify failed", nerr);
    }

    res.json(updatedReport);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error reviewing report:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.getAllReports = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT r.*, u.name as user_name,
             a.title as activity_title,
             t.title as task_title,
             g.title as goal_title
      FROM "Reports" r
      LEFT JOIN "Users" u ON r."userId" = u.id
      LEFT JOIN "Activities" a ON r."activityId" = a.id
      LEFT JOIN "Tasks" t ON a."taskId" = t.id
      LEFT JOIN "Goals" g ON t."goalId" = g.id
      ORDER BY r."createdAt" DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching all reports:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.generateMasterReport = async (req, res) => {
  const groupId = req.query.groupId ? Number(req.query.groupId) : null;
  const format = (req.query.format || "").toLowerCase();

  try {
    const rows = await db.query(
      `
SELECT g.id as goal_id, g.title as goal_title, g.progress as goal_progress, g.status as goal_status,
       t.id as task_id, t.title as task_title, t.progress as task_progress, t.status as task_status, t."assigneeId" as task_assignee,
       a.id as activity_id, a.title as activity_title, a.description as activity_description,
       a."currentMetric", a."targetMetric", a.weight as activity_weight, a."isDone" as activity_done, a.status as activity_status,
       r.id as report_id, r.narrative as report_narrative, r.status as report_status, r.metrics_data as report_metrics, r."new_status" as report_new_status, r."createdAt" as report_createdAt,
       at.id as attachment_id, at."fileName" as attachment_name, at."filePath" as attachment_path, at."fileType" as attachment_type
FROM "Goals" g
LEFT JOIN "Tasks" t ON t."goalId" = g.id
LEFT JOIN "Activities" a ON a."taskId" = t.id
LEFT JOIN "Reports" r ON r."activityId" = a.id
LEFT JOIN "Attachments" at ON at."reportId" = r.id
${groupId ? 'WHERE g."groupId" = $1' : ""}
ORDER BY g.id, t.id, a.id, r.id
`,
      groupId ? [groupId] : []
    );

    const raw = rows.rows || [];

    if (
      format === "html" ||
      (req.headers.accept &&
        req.headers.accept.includes("text/html") &&
        !req.query.format)
    ) {
      const html = generateReportHtml(raw);
      return res.set("Content-Type", "text/html").send(html);
    }

    const masterJson = generateReportJson(raw);
    return res.json(masterJson);
  } catch (err) {
    console.error("Error generating master report:", err);
    res.status(500).json({ error: err.message });
  }
};
