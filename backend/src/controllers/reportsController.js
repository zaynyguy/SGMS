// backend/src/controllers/reportController.js
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

/* helper: check permission */
function hasPermission(req, perm) {
  if (!req.user) return false;
  const perms = req.user.permissions || req.user.perms || [];
  return Array.isArray(perms) && perms.includes(perm);
}

/* helper: fetch enriched report row */
async function fetchReportWithGroup(reportId) {
  const q = `
    SELECT r.*, u.name as user_name,
      a.title as activity_title,
      a."targetMetric" as activity_target_metric,
      a."currentMetric" as activity_current_metric,
      a."metricType" as activity_metric_type,
      t.title as task_title,
      g.title as goal_title,
      g."groupId" as group_id,
      gr.name as group_name
    FROM "Reports" r
    LEFT JOIN "Users" u ON r."userId" = u.id
    LEFT JOIN "Activities" a ON r."activityId" = a.id
    LEFT JOIN "Tasks" t ON a."taskId" = t.id
    LEFT JOIN "Goals" g ON t."goalId" = g.id
    LEFT JOIN "Groups" gr ON g."groupId" = gr.id
    WHERE r.id = $1
    LIMIT 1
  `;
  const { rows } = await db.query(q, [reportId]);
  return rows[0] || null;
}

/* small helpers used by generateMasterReport */
function toNumberOrNull(v) {
  if (v === null || typeof v === "undefined") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function sumNumericValues(obj) {
  if (!obj) return 0;
  if (typeof obj === "number") return obj;
  if (typeof obj === "string") {
    const n = toNumberOrNull(obj);
    return n || 0;
  }
  if (typeof obj === "object") {
    return Object.values(obj).reduce((sum, val) => {
      const n = toNumberOrNull(val);
      return sum + (n || 0);
    }, 0);
  }
  return 0;
}

/* Controllers */

exports.canSubmitReport = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT value FROM "SystemSettings" WHERE key = 'reporting_active' LIMIT 1`
    );
    if (!rows[0]) return res.json({ reporting_active: false });
    const val = rows[0].value;
    const isActive =
      typeof val === "boolean" ? val : String(val).toLowerCase() === "true";
    return res.json({ reporting_active: Boolean(isActive) });
  } catch (err) {
    console.error("canSubmitReport error:", err);
    return res
      .status(500)
      .json({ reporting_active: false, error: err.message });
  }
};

exports.submitReport = async (req, res) => {
  const { activityId } = req.params;
  const { narrative, metrics_data, new_status } = req.body;

  // early check: reporting enabled
  try {
    const { rows } = await db.query(
      `SELECT value FROM "SystemSettings" WHERE key = 'reporting_active' LIMIT 1`
    );
    if (!rows[0]) {
      return res
        .status(403)
        .json({ message: "Reporting is currently disabled." });
    }
    const val = rows[0].value;
    const isActive =
      typeof val === "boolean" ? val : String(val).toLowerCase() === "true";
    if (!isActive)
      return res
        .status(403)
        .json({ message: "Reporting is currently disabled." });
  } catch (err) {
    console.error("Error reading reporting_active setting:", err);
    return res.status(500).json({
      message: "Unable to determine reporting status. Contact admin.",
    });
  }

  const client = await db.connect();
  const uploadedFiles = [];

  try {
    await client.query("BEGIN");

    // parse metrics_data early
    let parsedMetrics = null;
    if (metrics_data) {
      if (typeof metrics_data === "string") {
        try {
          parsedMetrics =
            metrics_data.trim() === "" ? null : JSON.parse(metrics_data);
        } catch (e) {
          parsedMetrics = metrics_data;
        }
      } else {
        parsedMetrics = metrics_data;
      }
    }

    // === VALIDATION: ensure incoming numeric metrics respect metricType logic ===
    if (
      parsedMetrics &&
      typeof parsedMetrics === "object" &&
      Object.keys(parsedMetrics).length > 0
    ) {
      // lock activity row
      const actQ = await client.query(
        `SELECT "targetMetric", "currentMetric", "metricType" FROM "Activities" WHERE id = $1 FOR UPDATE`,
        [activityId]
      );

      if (!actQ.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Activity not found." });
      }

      const activityRow = actQ.rows[0];
      const targetMetric = activityRow.targetmetric || activityRow.targetMetric || {};
      const currentMetric = activityRow.currentmetric || activityRow.currentMetric || {};
      const metricType = activityRow.metrictype || activityRow.metricType || "Plus"; // Default

      const violations = [];

      const extractNumeric = (v) => {
        if (v === null || typeof v === "undefined") return null;
        if (typeof v === "number") return v;
        if (typeof v === "object") {
          const ks = Object.keys(v || {});
          for (const k of ks) {
            const cand = v[k];
            if (typeof cand === "number") return cand;
            const parsed = Number(cand);
            if (!Number.isNaN(parsed)) return parsed;
          }
          return null;
        }
        const n = Number(String(v).replace(/,/g, "").trim());
        return Number.isNaN(n) ? null : n;
      };

      for (const k of Object.keys(parsedMetrics)) {
        const incomingRaw = parsedMetrics[k];
        const incoming = extractNumeric(incomingRaw);

        if (incoming === null) continue; // Skip non-numeric

        // determine target for that key
        let targetVal = null;
        const scalarTarget = extractNumeric(targetMetric);
        if (scalarTarget !== null) {
          targetVal = scalarTarget;
        } else if (
          targetMetric &&
          typeof targetMetric === "object" &&
          k in targetMetric
        ) {
          targetVal = extractNumeric(targetMetric[k]);
        }

        // determine current for that key (needed for Cumulative types)
        let currentVal = 0;
        if (
          currentMetric &&
          typeof currentMetric === "object" &&
          k in currentMetric
        ) {
          currentVal = extractNumeric(currentMetric[k]) || 0;
        }

        if (targetVal !== null) {
          // --- LOGIC PER METRIC TYPE ---

          if (metricType === "Plus" || metricType === "Minus") {
            // CUMULATIVE: We validate that (Current + Incoming) <= Target
            if (currentVal + incoming > targetVal) {
              violations.push({
                key: k,
                incoming,
                current: currentVal,
                target: targetVal,
                type: metricType,
                wouldBe: currentVal + incoming,
                message: `Cumulative total would exceed target.`,
              });
            }
          } else {
            // For snapshot types (Increase/Decrease/Maintain) we allow values by default.
          }
        }
      }

      if (violations.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Submitted metrics validation failed.",
          details: violations,
        });
      }
    }
    // === end validation ===

    const reportResult = await client.query(
      `INSERT INTO "Reports"("activityId", "userId", narrative, metrics_data, new_status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [activityId, req.user.id, narrative || null, parsedMetrics || {}, new_status || null]
    );
    const report = reportResult.rows[0];

    // attachments handling
    if (req.files && req.files.length) {
      const attachmentSettings = await getAttachmentSettings();
      const maxSizeMb = Number(
        attachmentSettings?.maxSizeMb ||
        attachmentSettings?.max_attachment_size_mb ||
        10
      );
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
        for (const f of req.files) {
          try {
            fs.unlinkSync(f.path);
          } catch (e) { }
        }
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `One or more files exceed the maximum allowed size of ${maxSizeMb} MB.`,
        });
      }
    }

    const insertedAttachments = [];
    if (req.files && req.files.length) {
      for (let file of req.files) {
        try {
          const uploaded = await uploadFile(file);
          uploadedFiles.push({ uploaded, originalFile: file });

          const insertRes = await client.query(
            `INSERT INTO "Attachments"("reportId", "fileName", "filePath", "fileType", "provider", "publicId", "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
            [
              report.id,
              uploaded.fileName || file.originalname,
              uploaded.url,
              uploaded.fileType || file.mimetype,
              uploaded.provider || "local",
              uploaded.publicId || null,
            ]
          );
          insertedAttachments.push(insertRes.rows[0]);
        } catch (uerr) {
          console.error("File upload failed for one attachment:", uerr);
          // cleanup uploaded files already done later; rollback now
          for (const entry of uploadedFiles) {
            try {
              if (entry.uploaded && entry.uploaded.provider === "local") {
                try {
                  const fname = path.basename(
                    entry.uploaded.url || entry.originalFile.path || ""
                  );
                  const fullLocal = path.join(process.cwd(), UPLOAD_DIR, fname);
                  if (fs.existsSync(fullLocal)) fs.unlinkSync(fullLocal);
                } catch (e) { }
              }
            } catch (cleanupErr) {
              console.error("cleanup after failed upload error:", cleanupErr);
            }
          }
          for (const f of req.files) {
            try {
              fs.unlinkSync(f.path);
            } catch (e) { }
          }
          await client.query("ROLLBACK");
          return res.status(500).json({ error: "File upload failed." });
        }
      }
    }

    // audit inside tx
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

    // notify managers and assignee
    try {
      const recipients = new Set();
      try {
        const permRes = await db.query(
          `SELECT DISTINCT u.id 
           FROM "Users" u
           JOIN "Roles" r ON u."roleId" = r.id
           JOIN "RolePermissions" rp ON rp."roleId" = r.id
           JOIN "Permissions" p ON p.id = rp."permissionId"
           WHERE p.name = $1`,
          ["manage_reports"]
        );
        for (const r of permRes.rows) if (r && r.id) recipients.add(r.id);
      } catch (permErr) {
        console.error(
          "submitReport: failed to query manage_reports users:",
          permErr
        );
      }

      try {
        const actRes = await db.query(
          `SELECT a.title AS activity_title, t."assigneeId" AS task_assignee
           FROM "Activities" a
           LEFT JOIN "Tasks" t ON t.id = a."taskId"
           WHERE a.id = $1 LIMIT 1`,
          [activityId]
        );
        const arow = actRes.rows[0];
        const activityTitle = (arow && arow.activity_title) || null;
        const taskAssignee = arow ? arow.task_assignee : null;
        if (taskAssignee) recipients.add(taskAssignee);

        const actorName = req.user?.name || req.user?.username || "Someone";
        const activityLabel = activityTitle || `#${activityId}`;
        const baseMessage = `${actorName} submitted a report for activity ${activityLabel}.`;

        if (recipients.has(req.user.id)) recipients.delete(req.user.id);

        for (const uid of recipients) {
          try {
            await notificationService({
              userId: uid,
              type: "report_submitted",
              message: baseMessage,
              meta: { reportId: report.id, activityId },
              level: "info",
            });
          } catch (nerr) {
            console.error(
              `submitReport: failed to notify user ${uid} about report ${report.id}:`,
              nerr
            );
          }
        }
      } catch (aerr) {
        console.error(
          "submitReport: failed to fetch activity/task assignee:",
          aerr
        );
      }
    } catch (outerNotifyErr) {
      console.error("submitReport: notify recipients failed", outerNotifyErr);
    }

    try {
      const enriched = await fetchReportWithGroup(report.id);
      return res.status(201).json(enriched || report);
    } catch (fetchErr) {
      console.error("submitReport: failed to fetch enriched report:", fetchErr);
      return res.status(201).json(report);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    for (const entry of uploadedFiles) {
      try {
        if (entry.uploaded && entry.uploaded.provider === "local") {
          try {
            const fname = path.basename(
              entry.uploaded.url || entry.originalFile.path || ""
            );
            const fullLocal = path.join(process.cwd(), UPLOAD_DIR, fname);
            if (fs.existsSync(fullLocal)) fs.unlinkSync(fullLocal);
          } catch (e) {
            console.error(e);
          }
        }
      } catch (cleanupErr) {
        console.error("cleanup after tx rollback error:", cleanupErr);
      }
    }
    if (req.files && req.files.length) {
      for (let file of req.files) {
        try {
          fs.unlinkSync(file.path);
        } catch (e) { }
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

    // On approval: apply metrics, update activity status
    if (status === "Approved") {
      let metricsObj = updatedReport.metrics_data || {};
      if (typeof metricsObj === "string") {
        try {
          metricsObj = metricsObj.trim() === "" ? {} : JSON.parse(metricsObj);
        } catch {
          metricsObj = {};
        }
      }

      if (!updatedReport.applied && metricsObj && Object.keys(metricsObj).length) {
        try {
          // This calls the UPDATED accumulate_metrics SQL function
          await client.query(
            `SELECT accumulate_metrics($1::int, $2::jsonb, $3::int, $4::int)`,
            [updatedReport.activityId, metricsObj, req.user.id, reportId]
          );

          await client.query(
            `UPDATE "Reports" SET applied = true, "appliedBy" = $1, "appliedAt" = NOW() WHERE id = $2`,
            [req.user.id, reportId]
          );
        } catch (applyErr) {
          console.error(
            "Failed to apply metrics via accumulate_metrics:",
            applyErr
          );
          await client.query("ROLLBACK");
          return res.status(500).json({ error: "Failed to apply report metrics." });
        }

        // Post-apply snapshot - run async
        try {
          const { snapshotActivity } = require("../jobs/monthlySnapshot");
          setImmediate(async () => {
            try {
              await snapshotActivity(updatedReport.activityId);
            } catch (e) {
              console.error("post-apply snapshotActivity failed:", e);
            }
          });
        } catch (e) {
          console.error("Failed to trigger post-apply snapshotActivity:", e);
        }
      }

      // Update status if provided
      if (updatedReport.new_status) {
        await client.query(
          `UPDATE "Activities"
           SET status = $1::"activity_status",
               "isDone" = CASE WHEN $1::"activity_status"='Done' THEN true ELSE "isDone" END,
               "updatedAt" = NOW()
           WHERE id = $2`,
          [updatedReport.new_status, updatedReport.activityId]
        );
      }
    }

    await client.query("COMMIT");

    // notify report owner
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

    try {
      const enrichedUpdated = await fetchReportWithGroup(updatedReport.id);
      return res.json(enrichedUpdated || updatedReport);
    } catch (fetchErr) {
      console.error("reviewReport: failed to fetch enriched report:", fetchErr);
      return res.json(updatedReport);
    }
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
    const pageSize = Math.min(
      Math.max(parseInt(req.query.pageSize || "20", 10), 1),
      200
    );
    const offset = (page - 1) * pageSize;
    const status = req.query.status ? String(req.query.status) : null;
    const qRaw = req.query.q ? String(req.query.q).trim() : null;

    const isAdmin = hasPermission(req, "manage_reports");
    const canViewGroup = hasPermission(req, "view_reports");

    const rebuiltParams = [pageSize, offset];
    const rebuiltWhereClauses = [];
    const pushParam = (val) => {
      rebuiltParams.push(val);
      return `$${rebuiltParams.length}`;
    };

    if (!isAdmin && canViewGroup) {
      const gRes2 = await db.query(
        `SELECT DISTINCT "groupId" FROM "UserGroups" WHERE "userId" = $1`,
        [req.user.id]
      );
      const groupIds2 = gRes2.rows.map((r) => r.groupId).filter(Boolean);
      if (groupIds2.length) {
        const groupParam = pushParam(groupIds2);
        const userParam = pushParam(req.user.id);
        rebuiltWhereClauses.push(
          `(g."groupId" = ANY(${groupParam}) OR r."userId" = ${userParam})`
        );
      } else {
        const userParam = pushParam(req.user.id);
        rebuiltWhereClauses.push(`r."userId" = ${userParam}`);
      }
    } else if (!isAdmin && !canViewGroup) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (status) {
      const p = pushParam(status);
      rebuiltWhereClauses.push(`r.status = ${p}`);
    }

    if (qRaw) {
      const p = pushParam(`%${qRaw}%`);
      rebuiltWhereClauses.push(
        `(r.id::text ILIKE ${p} OR u.name ILIKE ${p} OR a.title ILIKE ${p} OR r.narrative ILIKE ${p})`
      );
    }

    const rebuiltWhere = rebuiltWhereClauses.length
      ? "WHERE " + rebuiltWhereClauses.join(" AND ")
      : "";

    const sql = `
      SELECT r.*, u.name as user_name,
        a.title as activity_title,
        a."targetMetric" as activity_target_metric,
        a."currentMetric" as activity_current_metric,
        a."metricType" as activity_metric_type,
        t.title as task_title,
        g.title as goal_title,
        g."groupId" as group_id,
        gr.name as group_name,
        COUNT(*) OVER() AS total_count
      FROM "Reports" r
      LEFT JOIN "Users" u ON r."userId" = u.id
      LEFT JOIN "Activities" a ON r."activityId" = a.id
      LEFT JOIN "Tasks" t ON a."taskId" = t.id
      LEFT JOIN "Goals" g ON t."goalId" = g.id
      LEFT JOIN "Groups" gr ON g."groupId" = gr.id
      ${rebuiltWhere}
      ORDER BY r."createdAt" DESC
      LIMIT $1 OFFSET $2
    `;

    const { rows } = await db.query(sql, rebuiltParams);
    const total = rows.length ? Number(rows[0].total_count || 0) : 0;
    const cleaned = rows.map(({ total_count, ...r }) => r);

    return res.json({ rows: cleaned, page, pageSize, total });
  } catch (err) {
    console.error("Error fetching all reports (paginated):", err);
    res.status(500).json({ error: err.message });
  }
};

exports.generateMasterReport = async (req, res) => {
  const groupId = req.query.groupId ? Number(req.query.groupId) : null;
  const format = (req.query.format || "").toLowerCase();

  try {
    // Main raw query
    const rowsRes = await db.query(
      `
      SELECT g.id as goal_id,
             g.title as goal_title,
             g.progress as goal_progress,
             g.status as goal_status,
             g.weight as goal_weight,
             t.id as task_id,
             t.title as task_title,
             t.progress as task_progress,
             t.status as task_status,
             t.weight as task_weight,
             t."assigneeId" as task_assignee,
             a.id as activity_id,
             a.title as activity_title,
             a.description as activity_description,
             a."currentMetric",
             a."targetMetric",
             a."previousMetric",
             a."quarterlyGoals",
             a."metricType",
             a.weight as activity_weight,
             a."isDone" as activity_done,
             a.status as activity_status,
             r.id as report_id,
             r.narrative as report_narrative,
             r.status as report_status,
             r.metrics_data as report_metrics,
             r."new_status" as report_new_status,
             r."createdAt" as report_createdAt,
             at.id as attachment_id,
             at."fileName" as attachment_name,
             at."filePath" as attachment_path,
             at."fileType" as attachment_type
      FROM "Goals" g
      LEFT JOIN "Tasks" t ON t."goalId" = g.id
      LEFT JOIN "Activities" a ON a."taskId" = t.id
      -- Only join reports that have been Approved so Pending/Rejected don't affect master report
      LEFT JOIN "Reports" r ON r."activityId" = a.id AND r.status = 'Approved'
      LEFT JOIN "Attachments" at ON at."reportId" = r.id
      ${groupId ? 'WHERE g."groupId" = $1' : ""}
      ORDER BY g.id, t.id, a.id, r.id
      `,
      groupId ? [groupId] : []
    );

    const raw = rowsRes.rows || [];

    // Build nested masterJson: goals -> tasks -> activities
    const goalsMap = new Map();

    for (const r of raw) {
      const goalId = r.goal_id;
      if (!goalId) continue;

      if (!goalsMap.has(goalId)) {
        goalsMap.set(goalId, {
          id: goalId,
          title: r.goal_title,
          progress: r.goal_progress,
          status: r.goal_status,
          weight: r.goal_weight,
          tasks: new Map(),
        });
      }
      const goal = goalsMap.get(goalId);

      const taskId = r.task_id;
      if (!taskId) continue;

      if (!goal.tasks.has(taskId)) {
        goal.tasks.set(taskId, {
          id: taskId,
          title: r.task_title,
          progress: r.task_progress,
          status: r.task_status,
          weight: r.task_weight,
          assignee: r.task_assignee,
          activities: new Map(),
        });
      }
      const task = goal.tasks.get(taskId);

      const actId = r.activity_id;
      if (!actId) continue;

      if (!task.activities.has(actId)) {
        task.activities.set(actId, {
          id: actId,
          title: r.activity_title,
          description: r.activity_description,
          currentMetric: r.currentmetric || r.currentMetric || {},
          targetMetric: r.targetmetric || r.targetMetric || {},
          previousMetric: r.previousmetric || r.previousMetric || {},
          quarterlyGoals: r.quarterlygoals || r.quarterlyGoals || {},
          metricType: r.metrictype || r.metricType || "Plus",
          weight: r.activity_weight,
          isDone: r.activity_done,
          status: r.activity_status,
          reports: [],
          attachments: [],
          history: { monthly: {}, quarterly: {}, annual: {} },
          quarterlyTotal: null,
          yearlyProgress: null,
        });
      }
      const activity = task.activities.get(actId);

      // Attach report if present
      if (r.report_id) {
        activity.reports.push({
          id: r.report_id,
          narrative: r.report_narrative,
          status: r.report_status,
          metrics: r.report_metrics,
          new_status: r.report_new_status,
          createdAt: r.report_createdat || r.report_createdAt,
        });
      }

      // Attach attachment if present
      if (r.attachment_id) {
        activity.attachments.push({
          id: r.attachment_id,
          fileName: r.attachment_name,
          filePath: r.attachment_path,
          fileType: r.attachment_type,
        });
      }
    }

    // Convert nested Maps to plain arrays
    const masterJson = { goals: [] };
    for (const goal of goalsMap.values()) {
      const goalObj = {
        id: goal.id,
        title: goal.title,
        progress: goal.progress,
        status: goal.status,
        weight: goal.weight,
        tasks: [],
      };
      for (const task of goal.tasks.values()) {
        const taskObj = {
          id: task.id,
          title: task.title,
          progress: task.progress,
          status: task.status,
          weight: task.weight,
          assignee: task.assignee,
          activities: [],
        };
        for (const activity of task.activities.values()) {
          taskObj.activities.push(activity);
        }
        goalObj.tasks.push(taskObj);
      }
      masterJson.goals.push(goalObj);
    }

    // Fetch ProgressHistory rows (monthly snapshots)
    const phRowsQ = await db.query(
      `
      SELECT entity_id::int as activity_id, snapshot_month, progress, metrics, recorded_at
      FROM "ProgressHistory"
      WHERE lower(entity_type) = 'activity'
      ${groupId ? "AND group_id = $1" : ""}
      ORDER BY entity_id, snapshot_month
      `,
      groupId ? [groupId] : []
    );

    const historyByActivity = {};
    for (const r of phRowsQ.rows || []) {
      const aid = Number(r.activity_id);
      if (!historyByActivity[aid]) historyByActivity[aid] = [];
      historyByActivity[aid].push({
        snapshot_month: r.snapshot_month,
        progress: typeof r.progress === "number" ? r.progress : Number(r.progress) || 0,
        metrics: r.metrics || {},
        recorded_at: r.recorded_at,
      });
    }

    // Merge ActivityRecords (authoritative manual edits)
    // Get fiscal start month
    const fsRes = await db.query("SELECT get_fiscal_year_start_month() as m");
    const startMonth = fsRes.rows[0]?.m || 7;

    const arQuery = `
        SELECT ar.*
        FROM "ActivityRecords" ar
        JOIN "Activities" a ON ar."activityId" = a.id
        JOIN "Tasks" t ON a."taskId" = t.id
        JOIN "Goals" g ON t."goalId" = g.id
        WHERE 1=1
        ${groupId ? 'AND g."groupId" = $1' : ''}
        ORDER BY ar."fiscalYear", ar."quarter", ar."month"
      `;
    const arRows = await db.query(arQuery, groupId ? [groupId] : []);

    const recordsByActivity = {};
    for (const rec of arRows.rows || []) {
      const aid = rec.activityId;
      if (!recordsByActivity[aid]) recordsByActivity[aid] = [];
      recordsByActivity[aid].push(rec);
    }

    // Populate activity.history from both ProgressHistory and ActivityRecords
    // First: attach ProgressHistory monthly snapshots
    for (const [aidStr, snaps] of Object.entries(historyByActivity)) {
      const aid = Number(aidStr);
      // place into activity.history.monthly using snapshot_month YYYY-MM-DD -> YYYY-MM
      const activity = findActivityInMaster(masterJson, aid);
      if (!activity) continue;
      for (const s of snaps) {
        const d = s.snapshot_month ? new Date(s.snapshot_month) : new Date(s.recorded_at || Date.now());
        if (isNaN(d)) continue;
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!activity.history.monthly[monthKey]) activity.history.monthly[monthKey] = [];
        activity.history.monthly[monthKey].push({
          date: d.toISOString(),
          progress: s.progress,
          metrics: s.metrics,
          recorded_at: s.recorded_at,
          source: "progress_history",
        });
      }
    }

    // Second: attach ActivityRecords (monthly and quarterly)
    for (const aidStr of Object.keys(recordsByActivity)) {
      const aid = Number(aidStr);
      const activity = findActivityInMaster(masterJson, aid);
      if (!activity) continue;
      for (const rec of recordsByActivity[aid]) {
        const metricKey = rec.metricKey;
        const val = toNumberOrNull(rec.value);
        // construct metrics object
        const metricsObj = { [metricKey]: val };

        // Quarter
        if (rec.quarter) {
          const fiscalYear = rec.fiscalYear;
          // calculate calendar month (end of quarter)
          const relativeMonth = (rec.quarter - 1) * 3 + 2; // 0-indexed within fiscal year
          const absMonth = (startMonth - 1) + relativeMonth;
          const calMonthIndex = (absMonth % 12) + 1; // 1-12
          const yearOffset = Math.floor(absMonth / 12);
          const calYear = fiscalYear + yearOffset;
          const qKey = `${fiscalYear}-Q${rec.quarter}`;
          const dateStr = `${calYear}-${String(calMonthIndex).padStart(2, "0")}-28`;
          if (!activity.history.quarterly[qKey]) activity.history.quarterly[qKey] = [];
          activity.history.quarterly[qKey].push({
            date: dateStr,
            progress: null,
            metrics: metricsObj,
            recorded_at: dateStr,
            source: "activity_record",
          });
        }

        // Month
        if (rec.month) {
          const m = rec.month; // calendar month 1-12
          // Determine calendar year: if month >= startMonth then calendar year = fiscalYear; else fiscalYear + 1
          const fiscalYear = rec.fiscalYear;
          const calYear = m >= startMonth ? fiscalYear : fiscalYear + 1;
          const monthKey = `${calYear}-${String(m).padStart(2, "0")}`;
          const dateStr = `${calYear}-${String(m).padStart(2, "0")}-28`;
          if (!activity.history.monthly[monthKey]) activity.history.monthly[monthKey] = [];
          activity.history.monthly[monthKey].push({
            date: dateStr,
            progress: null,
            metrics: metricsObj,
            recorded_at: dateStr,
            source: "activity_record",
          });
        }
      }
    }

    // Compute quarterlyTotal and yearlyProgress for each activity
    for (const goal of masterJson.goals || []) {
      for (const task of goal.tasks || []) {
        for (const activity of task.activities || []) {
          try {
            const hist = activity.history || { quarterly: {}, monthly: {} };
            const metricType = activity.metricType || "Plus";

            // quarterlyTotal
            if (metricType === "Plus" || metricType === "Minus") {
              // sum latest value per quarter
              let sum = 0;
              let found = false;
              const quarterKeys = Object.keys(hist.quarterly || {}).sort();
              for (const qk of quarterKeys) {
                const entries = hist.quarterly[qk];
                if (!entries || entries.length === 0) continue;
                // pick latest entry
                const last = entries[entries.length - 1];
                const nv = sumNumericValues(last.metrics || {});
                if (nv) {
                  sum += nv;
                  found = true;
                }
              }
              activity.quarterlyTotal = found ? sum : null;
            } else {
              // snapshot types: use latest quarter (last key)
              const qKeys = Object.keys(hist.quarterly || {}).sort();
              if (qKeys.length) {
                const latestEntries = hist.quarterly[qKeys[qKeys.length - 1]] || [];
                if (latestEntries.length) {
                  const latest = latestEntries[latestEntries.length - 1];
                  activity.quarterlyTotal = sumNumericValues(latest.metrics || {});
                } else {
                  activity.quarterlyTotal = null;
                }
              } else {
                activity.quarterlyTotal = null;
              }
            }

            // compute yearlyProgress (YTD vs target)
            const ytdVal = activity.quarterlyTotal === null ? null : Number(activity.quarterlyTotal || 0);
            const targetSum = sumNumericValues(activity.targetMetric || {});
            if (ytdVal === null) {
              activity.yearlyProgress = null;
            } else {
              if (activity.metricType === "Decrease") {
                if (ytdVal === 0) {
                  activity.yearlyProgress = 100;
                } else if (targetSum === 0) {
                  activity.yearlyProgress = 0;
                } else {
                  activity.yearlyProgress = Math.round((targetSum / ytdVal) * 100);
                }
              } else if (activity.metricType === "Maintain") {
                if (targetSum === 0) {
                  activity.yearlyProgress = ytdVal === 0 ? 100 : 0;
                } else {
                  const pct = Math.round((ytdVal / targetSum) * 100);
                  activity.yearlyProgress = pct > 100 ? 100 : pct;
                }
              } else {
                // Plus, Minus, Increase
                if (targetSum === 0 && ytdVal === 0) {
                  activity.yearlyProgress = 100;
                } else if (targetSum === 0) {
                  activity.yearlyProgress = null;
                } else {
                  activity.yearlyProgress = Math.round((ytdVal / targetSum) * 100);
                }
              }
            }
          } catch (e) {
            activity.quarterlyTotal = null;
            activity.yearlyProgress = null;
          }
        }
      }
    }

    // If HTML requested
    if (
      format === "html" ||
      (req.headers.accept && req.headers.accept.includes("text/html") && !req.query.format)
    ) {
      try {
        const html = generateReportHtml(masterJson);
        return res.set("Content-Type", "text/html").send(html);
      } catch (e) {
        console.error("generateMasterReport: generateReportHtml error:", e);
        // fallthrough to JSON
      }
    }

    return res.json(masterJson);
  } catch (err) {
    console.error(
      "Error generating master report:",
      err && err.message ? err.message : err
    );
    res.status(500).json({ error: err.message || String(err) });
  }
};

/* Helper to find activity in master JSON */
function findActivityInMaster(masterJson, activityId) {
  if (!masterJson || !masterJson.goals) return null;
  for (const g of masterJson.goals) {
    for (const t of g.tasks || []) {
      for (const a of t.activities || []) {
        if (Number(a.id) === Number(activityId)) return a;
      }
    }
  }
  return null;
}
