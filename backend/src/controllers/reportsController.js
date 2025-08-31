const db = require("../db");
const path = require("path");
const fs = require("fs");
const { logAudit } = require("../helpers/audit");
const { createNotification } = require("./notificationsController");
const { generateReportHtml } = require("../helpers/reportHelper");
const { recalcProgressFromActivity } = require("../utils/progress");
const { UPLOAD_DIR } = require("../middleware/uploadMiddleware");
const {getAttachmentSettings} = require("../utils/systemSettings")

exports.submitReport = async (req, res) => {
  const { activityId } = req.params;
  const { narrative, metrics_data, new_status } = req.body;

  // Check reporting_active setting (optional: read from SystemSettings)
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
    // ignore: missing setting is fine
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

    // validate file sizes against DB-controlled max
    if (req.files && req.files.length) {
      const { maxSizeMb } = await getAttachmentSettings(); 
      const maxBytes = (Number(maxSizeMb) || 10) * 1024 * 1024;
      const oversized = req.files.filter((f) => {
        try {
          const stats = fs.statSync(f.path);
          return stats.size > maxBytes;
        } catch (e) {
          // treat unreadable file as invalid
          return true;
        }
      });
      if (oversized.length) {
        // cleanup saved files
        for (const f of req.files) {
          try {
            fs.unlinkSync(f.path);
          } catch (e) {}
        }
        return res
          .status(400)
          .json({
            message: `One or more files exceed the maximum allowed size of ${maxSizeMb} MB.`,
          });
      }
    }
    
    // attachments (req.files is from multer)
    if (req.files && req.files.length) {
      for (let file of req.files) {
        const relativePath = path.relative(UPLOAD_DIR, file.path);
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
    // cleanup uploaded files if any
    if (req.files && req.files.length) {
      for (let file of req.files) {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {}
      }
    }
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

    // lock report row
    const repRes = await client.query(
      `SELECT * FROM "Reports" WHERE id = $1 FOR UPDATE`,
      [reportId]
    );

    if (!repRes.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Report not found" });
    }

    const reportRow = repRes.rows[0];

    const updated = await client.query(
      `UPDATE "Reports" SET status=$1, "adminComment"=$2, "updatedAt"=now() WHERE id=$3 RETURNING *`,
      [status, adminComment || null, reportId]
    );

    const updatedReport = updated.rows[0];

    if (status === "Approved") {
      const activityId = updatedReport.activityId;

      // Set activity.currentMetric to the report's metrics_data (replace)
      if (updatedReport.metrics_data) {
        await client.query(
          `UPDATE "Activities" SET "currentMetric" = $1, "updatedAt" = NOW() WHERE id = $2`,
          [updatedReport.metrics_data, activityId]
        );
      }

      // If the original report requested a new_status === 'Done', then mark activity done
      if (updatedReport.new_status && updatedReport.new_status === "Done") {
        await client.query(
          `UPDATE "Activities" SET "isDone" = true, status = 'Done', "updatedAt" = NOW() WHERE id = $1`,
          [activityId]
        );
      } else {
        // keep isDone as-is or set to false if you want strictness; we won't force false automatically
        // But update status to 'In Progress' if not done
        await client.query(
          `UPDATE "Activities" SET status = CASE WHEN "isDone" THEN status ELSE 'In Progress' END WHERE id = $1`,
          [activityId]
        );
      }

      // Recalculate progress (task + goal)
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
  const groupId = req.query.groupId || null;

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

    const html = generateReportHtml(rows.rows || rows);
    res.set("Content-Type", "text/html").send(html);
  } catch (err) {
    console.error("Error generating master report:", err);
    res.status(500).json({ error: err.message });
  }
};
