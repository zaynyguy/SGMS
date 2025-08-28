// src/controllers/reportsController.js
const db = require("../db");
const path = require("path");
const fs = require("fs");
const { logAudit } = require("../helpers/audit");
const { createNotification } = require("./notificationsController");
const { generateReportHtml } = require("../helpers/reportHelper");
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
const { recalcProgressFromActivity } = require("../utils/progress");

exports.submitReport = async (req, res) => {
  const { activityId } = req.params;
  const { narrative, metrics_data, new_status } = req.body;

  if (!narrative || !new_status) {
    return res
      .status(400)
      .json({ message: "Narrative and new status are required fields." });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const reportResult = await client.query(
      `INSERT INTO "Reports"("activityId", "userId", narrative, metrics_data, new_status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [activityId, req.user.id, narrative, metrics_data || null, new_status]
    );

    const report = reportResult.rows[0];

    if (req.files && req.files.length) {
      for (let file of req.files) {
        const relativePath = path.relative(UPLOADS_DIR, file.path);
        await client.query(
          `INSERT INTO "Attachments"("reportId", "fileName", "filePath", "fileType") VALUES ($1, $2, $3, $4)`,
          [report.id, file.originalname, relativePath, file.mimetype]
        );
      }
    }

    await logAudit(req.user.id, "submit", "Report", report.id, { activityId });
    await client.query("COMMIT");
    res.status(201).json(report);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error submitting report:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.reviewReport = async (req, res) => {
  const { reportId } = req.params;
  const { status, adminComment } = req.body;

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
      return res.status(404).json({ error: "Report not found" });
    }

    const updated = await client.query(
      `UPDATE "Reports" SET status=$1, "adminComment"=$2, "updatedAt"=now() WHERE id=$3 RETURNING *`,
      [status, adminComment || null, reportId]
    );

    const updatedReport = updated.rows[0];

    
    if (status === "Approved") {
      const activityId = updatedReport.activityId;

      
      if (updatedReport.metrics_data) {
        await client.query(
          `UPDATE "Activities" SET "currentMetric" = COALESCE($1,"currentMetric"), "isDone" = true, "status" = 'Done', "updatedAt" = NOW() WHERE id = $2`,
          [updatedReport.metrics_data, activityId]
        );
      } else {
        await client.query(
          `UPDATE "Activities" SET "isDone" = true, "status" = 'Done', "updatedAt" = NOW() WHERE id = $1`,
          [activityId]
        );
      }

      
      await recalcProgressFromActivity(client, activityId);
    }

    await logAudit(req.user.id, "review", "Report", reportId, { status });
    await createNotification(
      updatedReport.userId,
      "report_review",
      `Your report was ${status}.`
    );

    await client.query("COMMIT");
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
  try {
    const { rows } = await db.query(`
      SELECT g.id as goal_id, g.title as goal_title,
             t.id as task_id, t.title as task_title,
             a.id as activity_id, a.title as activity_title, a.description as activity_description,
             r.id as report_id, r.narrative as report_narrative, r.status as report_status,
             at.id as attachment_id, at."filePath" as fileName
      FROM "Goals" g
      LEFT JOIN "Tasks" t ON t."goalId" = g.id
      LEFT JOIN "Activities" a ON a."taskId" = t.id
      LEFT JOIN "Reports" r ON r."activityId" = a.id AND r.status = 'Approved'
      LEFT JOIN "Attachments" at ON at."reportId" = r.id
      ORDER BY g.id, t.id, a.id, r.id
    `);

    const html = generateReportHtml(rows);
    res.set("Content-Type", "text/html").send(html);
  } catch (err) {
    console.error("Error generating master report:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.downloadAttachment = async (req, res) => {
  const { attachmentId } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT "filePath", "fileName" FROM "Attachments" WHERE id = $1`,
      [attachmentId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Attachment not found." });
    }

    const { filePath, fileName } = rows[0];

    const fullPath = path.join(UPLOADS_DIR, filePath);

    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size === 0) {
      return res
        .status(404)
        .json({ error: "File not found or is empty on the server." });
    }

    res.download(fullPath, fileName, (err) => {
      if (err) {
        console.error("Error downloading file:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Could not download the file." });
        }
      }
    });
  } catch (err) {
    console.error("Error fetching attachment:", err);
    res.status(500).json({ error: err.message });
  }
};
