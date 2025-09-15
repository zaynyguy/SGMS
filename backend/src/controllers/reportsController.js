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
const { uploadFile, deleteFile } = require("../services/uploadService");

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

  // We'll keep track of uploaded files so we can cleanup on failure
  const uploadedFiles = []; // each item: { uploaded, originalFile }

  try {
    await client.query("BEGIN");

    const reportResult = await client.query(
      `INSERT INTO "Reports"("activityId", "userId", narrative, metrics_data, new_status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
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

    // Validate attachments size (use system setting)
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
        // cleanup uploaded tmp files written by multer
        for (const f of req.files) {
          try {
            fs.unlinkSync(f.path);
          } catch (e) {}
        }
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `One or more files exceed the maximum allowed size of ${maxSizeMb} MB.`,
        });
      }
    }

    const insertedAttachments = [];

    if (req.files && req.files.length) {
      // Upload each file via uploadService.uploadFile
      for (let file of req.files) {
        try {
          const uploaded = await uploadFile(file);
          // keep uploaded info for cleanup in case of later rollback
          uploadedFiles.push({ uploaded, originalFile: file });

          // Insert into DB using uploaded.url and provider
          const insertRes = await client.query(
            `INSERT INTO "Attachments"("reportId", "fileName", "filePath", "fileType", "provider", "publicId", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
            [
              report.id,
              uploaded.fileName || file.originalname,
              uploaded.url,
              uploaded.fileType || file.mimetype,
              uploaded.provider || "local",
              uploaded.public_id || null,
            ]
          );
          insertedAttachments.push(insertRes.rows[0]);
        } catch (uerr) {
          console.error("File upload failed for one attachment:", uerr);
          // If an upload fails, abort the transaction and cleanup earlier uploads
          // cleanup uploaded files so far
          for (const entry of uploadedFiles) {
            try {
              if (entry.uploaded && entry.uploaded.provider === "cloudinary") {
                // attempt cloudinary cleanup using returned public_id if available
                await deleteFile(entry.uploaded.url, {
                  public_id: entry.uploaded.public_id,
                });
              } else if (
                entry.uploaded &&
                entry.uploaded.provider === "local"
              ) {
                // remove local file from uploads directory
                try {
                  const fname = path.basename(
                    entry.uploaded.url || entry.originalFile.path || ""
                  );
                  const fullLocal = path.join(process.cwd(), UPLOAD_DIR, fname);
                  if (fs.existsSync(fullLocal)) fs.unlinkSync(fullLocal);
                } catch (e) {}
              }
            } catch (cleanupErr) {
              console.error("cleanup after failed upload error:", cleanupErr);
            }
          }

          // remove temp files from multer for the failed file set
          for (const f of req.files) {
            try {
              fs.unlinkSync(f.path);
            } catch (e) {}
          }

          await client.query("ROLLBACK");
          return res.status(500).json({ error: "File upload failed." });
        }
      }
    }

    // Audit the report submission inside the same transaction
    try {
      await logAudit({
        userId: req.user.id,
        action: "REPORT_SUBMITTED",
        entity: "Report",
        entityId: report.id,
        details: { activityId },
        client,
        req,
      });
    } catch (e) {
      console.error("REPORT_SUBMITTED audit failed (in-tx):", e);
    }

    await client.query("COMMIT");

    // Post-commit: notify about attachments (best-effort)
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

    // If transaction failed after uploading files, cleanup any uploaded artifacts
    for (const entry of uploadedFiles) {
      try {
        if (entry.uploaded && entry.uploaded.provider === "cloudinary") {
          // try to remove Cloudinary upload (pass public_id when available)
          try {
            await deleteFile(entry.uploaded.url, {
              public_id: entry.uploaded.public_id,
            });
          } catch (e) {
            console.error(
              "Failed to cleanup cloudinary file after tx rollback:",
              e
            );
          }
        } else if (entry.uploaded && entry.uploaded.provider === "local") {
          try {
            const fname = path.basename(
              entry.uploaded.url || entry.originalFile.path || ""
            );
            const fullLocal = path.join(process.cwd(), UPLOAD_DIR, fname);
            if (fs.existsSync(fullLocal)) fs.unlinkSync(fullLocal);
          } catch (e) {
            console.error("Failed to cleanup local file after tx rollback:", e);
          }
        }
      } catch (cleanupErr) {
        console.error("cleanup after tx rollback error:", cleanupErr);
      }
    }

    // Also remove any leftover multer temp files
    if (req.files && req.files.length) {
      for (let file of req.files) {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {}
      }
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
    const beforeReport = repRes.rows[0];

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

    // Audit review inside same transaction
    try {
      await logAudit({
        userId: req.user.id,
        action: "REPORT_REVIEWED",
        entity: "Report",
        entityId: reportId,
        before: beforeReport,
        after: updatedReport,
        details: { status, adminComment },
        client,
        req,
      });
    } catch (e) {
      console.error("REPORT_REVIEWED audit failed (in-tx):", e);
    }

    if (status === "Approved") {
      // Apply metrics to activity
      if (updatedReport.metrics_data) {
        await client.query(
          `UPDATE "Activities"
           SET "currentMetric" = COALESCE($1, "currentMetric"), "updatedAt" = NOW()
           WHERE id = $2`,
          [updatedReport.metrics_data, updatedReport.activityId]
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
          [newStatus, updatedReport.activityId]
        );
      }

      // Fetch activity + task + goal for progress snapshot
      const aRes = await client.query(
        `SELECT a.id, a."taskId", t."goalId", a."currentMetric", a."weight", a."isDone"
         FROM "Activities" a
         JOIN "Tasks" t ON t.id = a."taskId"
         WHERE a.id = $1 LIMIT 1`,
        [updatedReport.activityId]
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

    // Post-commit: notify report owner
    try {
      await notificationService({
        userId: beforeReport.userId,
        type: "report_review",
        message: `Your report #${beforeReport.id} was ${status.toLowerCase()}.`,
        meta: { reportId: beforeReport.id },
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
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || "20", 10), 1), 200);
    const offset = (page - 1) * pageSize;
    const status = req.query.status ? String(req.query.status) : null;
    const qRaw = req.query.q ? String(req.query.q).trim() : null;

    const whereClauses = [];
    const params = [pageSize, offset];

    if (status) {
      params.push(status);
      whereClauses.push(`r.status = $${params.length}`);
    }

    if (qRaw) {
      // search across id, user name, activity title, narrative
      params.push(`%${qRaw}%`);
      const idx = params.length;
      whereClauses.push(
        `(r.id::text ILIKE $${idx} OR u.name ILIKE $${idx} OR a.title ILIKE $${idx} OR r.narrative ILIKE $${idx})`
      );
    }

    const where = whereClauses.length ? "WHERE " + whereClauses.join(" AND ") : "";

    const sql = `
      SELECT r.*, u.name as user_name,
             a.title as activity_title,
             t.title as task_title,
             g.title as goal_title,
             COUNT(*) OVER() AS total_count
      FROM "Reports" r
      LEFT JOIN "Users" u ON r."userId" = u.id
      LEFT JOIN "Activities" a ON r."activityId" = a.id
      LEFT JOIN "Tasks" t ON a."taskId" = t.id
      LEFT JOIN "Goals" g ON t."goalId" = g.id
      ${where}
      ORDER BY r."createdAt" DESC
      LIMIT $1 OFFSET $2
    `;

    const { rows } = await db.query(sql, params);
    const total = rows.length ? Number(rows[0].total_count || 0) : 0;

    // strip total_count from each row before returning (optional)
    const cleaned = rows.map(({ total_count, ...r }) => r);

    return res.json({
      rows: cleaned,
      page,
      pageSize,
      total,
    });
  } catch (err) {
    console.error("Error fetching all reports (paginated):", err);
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
       r.id as report_id, r.narrative as report_narrative, r.status as report_status, r.metrics_data as report_metrics, 
       r."new_status" as report_new_status, r."createdAt" as report_createdAt,
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

    // --- Build Change History from Reports ---
    const historyByActivity = {};
    for (const row of raw) {
      if (!row.activity_id || !row.report_id) continue;

      const actId = row.activity_id;
      const createdAt = row.report_createdat;
      const metrics = row.report_metrics || {};

      if (!historyByActivity[actId]) historyByActivity[actId] = [];

      historyByActivity[actId].push({
        reportId: row.report_id,
        date: createdAt,
        metrics,
        newStatus: row.report_new_status,
      });
    }

    // Group history into monthly / quarterly / annual
    const breakdowns = {};
    for (const [actId, reports] of Object.entries(historyByActivity)) {
      breakdowns[actId] = {
        monthly: {},
        quarterly: {},
        annual: {},
      };

      for (const rep of reports) {
        const d = new Date(rep.date);
        if (isNaN(d)) continue;

        const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
        const quarterKey = `${d.getFullYear()}-Q${
          Math.floor(d.getMonth() / 3) + 1
        }`;
        const yearKey = `${d.getFullYear()}`;

        // push to monthly
        if (!breakdowns[actId].monthly[monthKey])
          breakdowns[actId].monthly[monthKey] = [];
        breakdowns[actId].monthly[monthKey].push(rep);

        // push to quarterly
        if (!breakdowns[actId].quarterly[quarterKey])
          breakdowns[actId].quarterly[quarterKey] = [];
        breakdowns[actId].quarterly[quarterKey].push(rep);

        // push to annual
        if (!breakdowns[actId].annual[yearKey])
          breakdowns[actId].annual[yearKey] = [];
        breakdowns[actId].annual[yearKey].push(rep);
      }
    }

    // --- Inject into the JSON output ---
    const masterJson = generateReportJson(raw);

    // Walk activities inside masterJson and attach history
    for (const goal of masterJson.goals || []) {
      for (const task of goal.tasks || []) {
        for (const activity of task.activities || []) {
          activity.history = breakdowns[activity.id] || {
            monthly: {},
            quarterly: {},
            annual: {},
          };
        }
      }
    }

    if (
      format === "html" ||
      (req.headers.accept &&
        req.headers.accept.includes("text/html") &&
        !req.query.format)
    ) {
      const html = generateReportHtml(raw);
      return res.set("Content-Type", "text/html").send(html);
    }

    return res.json(masterJson);
  } catch (err) {
    console.error("Error generating master report:", err);
    res.status(500).json({ error: err.message });
  }
};
