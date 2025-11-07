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
// MODIFIED: Added activity's target and current metrics for context on review page
async function fetchReportWithGroup(reportId) {
  const q = `
SELECT r.*, u.name as user_name,
a.title as activity_title,
a."targetMetric" as activity_target_metric,
a."currentMetric" as activity_current_metric,
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

  // early check: reporting enabled (keeps your existing logic)
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
    return res
      .status(500)
      .json({
        message: "Unable to determine reporting status. Contact admin.",
      });
  }

  const client = await db.connect();
  const uploadedFiles = [];

  try {
    await client.query("BEGIN");

    // parse metrics_data early so we can validate against the activity's target/current
    let parsedMetrics = null;
    if (metrics_data) {
      if (typeof metrics_data === "string") {
        try {
          parsedMetrics =
            metrics_data.trim() === "" ? null : JSON.parse(metrics_data);
        } catch (e) {
          // If it's not JSON, keep raw (but we won't validate non-objects)
          parsedMetrics = metrics_data;
        }
      } else {
        parsedMetrics = metrics_data;
      }
    }

    // === VALIDATION: ensure incoming numeric metric additions won't exceed target ===
    if (
      parsedMetrics &&
      typeof parsedMetrics === "object" &&
      Object.keys(parsedMetrics).length > 0
    ) {
      // lock the activity row so currentMetric/targetMetric won't race
      const actQ = await client.query(
        `SELECT "currentMetric", "targetMetric" FROM "Activities" WHERE id = $1 FOR UPDATE`,
        [activityId]
      );
      if (!actQ.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Activity not found." });
      }
      const activityRow = actQ.rows[0];
      const currentMetric = activityRow.currentMetric || {};
      const targetMetric = activityRow.targetMetric || {};

      const violations = []; // collect keys that would exceed target

      const extractNumeric = (v) => {
        if (v === null || typeof v === "undefined") return null;
        if (typeof v === "number") return v;
        // attempt to unwrap simple objects like { value: 5 } or { key: 5 }
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
        if (incoming === null) {
          // Non-numeric incoming: skip target validation (we only enforce numeric matrices)
          continue;
        }

        // existing current for that key
        const existingRaw = currentMetric && currentMetric[k];
        const existing = extractNumeric(existingRaw) ?? 0;

        // determine target for that key
        let targetVal = null;
        // if targetMetric is scalar numeric (e.g. 14), use it
        const scalarTarget = extractNumeric(targetMetric);
        if (scalarTarget !== null) {
          targetVal = scalarTarget;
        } else if (
          targetMetric &&
          typeof targetMetric === "object" &&
          k in targetMetric
        ) {
          targetVal = extractNumeric(targetMetric[k]);
        } else if (
          targetMetric &&
          typeof targetMetric === "object" &&
          "target" in targetMetric
        ) {
          // support shape like { target: 14 }
          targetVal = extractNumeric(targetMetric.target);
        }

        if (targetVal !== null) {
          if (existing + incoming > targetVal) {
            violations.push({
              key: k,
              existing,
              incoming,
              target: targetVal,
              wouldBe: existing + incoming,
            });
          }
        }
      }

      if (violations.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Submitted metrics would exceed activity target(s).",
          details: violations,
        });
      }
    }
    // === end validation ===

    // INSERT the report (unchanged behaviour) - we use parsedMetrics (possibly {} or null)
    const reportResult = await client.query(
      `INSERT INTO "Reports"("activityId", "userId", narrative, metrics_data, new_status, "createdAt", "updatedAt")
VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
RETURNING *`,
      [
        activityId,
        req.user.id,
        narrative || null,
        parsedMetrics || {},
        new_status || null,
      ]
    );
    const report = reportResult.rows[0];

    // attachments size validation & upload (unchanged from your existing code)
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
          } catch (e) {}
        }
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({
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
              uploaded.public_id || null,
            ]
          );
          insertedAttachments.push(insertRes.rows[0]);
        } catch (uerr) {
          console.error("File upload failed for one attachment:", uerr);
          // cleanup uploaded files already done later; rollback now
          for (const entry of uploadedFiles) {
            try {
              if (entry.uploaded && entry.uploaded.provider === "cloudinary") {
                await deleteFile(entry.uploaded.url, {
                  public_id: entry.uploaded.public_id,
                });
              } else if (
                entry.uploaded &&
                entry.uploaded.provider === "local"
              ) {
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

    // notify managers and assignee (best-effort) - unchanged
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
        if (entry.uploaded && entry.uploaded.provider === "cloudinary") {
          try {
            await deleteFile(entry.uploaded.url, {
              public_id: entry.uploaded.public_id,
            });
          } catch (e) {
            console.error(e);
          }
        } else if (entry.uploaded && entry.uploaded.provider === "local") {
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

    // On approval: apply metrics (idempotent), update activity status if requested
    if (status === "Approved") {
      // parse metrics_data to JSON if stored as string
      let metricsObj = updatedReport.metrics_data || {};
      if (typeof metricsObj === "string") {
        try {
          metricsObj = metricsObj.trim() === "" ? {} : JSON.parse(metricsObj);
        } catch {
          metricsObj = {};
        }
      }

      // Apply metrics only if not already applied and there's meaningful metrics
      if (
        !updatedReport.applied &&
        metricsObj &&
        Object.keys(metricsObj).length
      ) {
        try {
          await client.query(
            `SELECT accumulate_metrics($1::int, $2::jsonb, $3::int)`,
            [updatedReport.activityId, metricsObj, req.user.id]
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
          // don't fail entire transaction just because accumulation failed; surface error
          // choose to rollback to be safe
          await client.query("ROLLBACK");
          return res
            .status(500)
            .json({ error: "Failed to apply report metrics." });
        }
      }

      // If new_status provided on the report, update activity status accordingly
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

    // MODIFIED: Added a."targetMetric" and a."currentMetric"
    const sql = `
SELECT r.*, u.name as user_name,
a.title as activity_title,
a."targetMetric" as activity_target_metric,
a."currentMetric" as activity_current_metric,
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

// PATCH: Revised generateMasterReport handler to ensure activity previous/current/target metrics
// are returned in the master JSON. Also adds safe aliases in SQL and maps activity-level
// metric columns into the generated master JSON so the frontend can read previousMetric.
exports.generateMasterReport = async (req, res) => {
  const groupId = req.query.groupId ? Number(req.query.groupId) : null;
  const format = (req.query.format || "").toLowerCase();

  try {
    // MODIFIED: Added a."quarterlyGoals" to the SELECT statement
    const rows = await db.query(
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
LEFT JOIN "Reports" r ON r."activityId" = a.id
LEFT JOIN "Attachments" at ON at."reportId" = r.id
${groupId ? 'WHERE g."groupId" = $1' : ""}
ORDER BY g.id, t.id, a.id, r.id
`,
      groupId ? [groupId] : []
    );

    const raw = rows.rows || [];

    // progress history snapshots (unchanged)
    const phRowsQ = await db.query(
      `
SELECT entity_id::int as activity_id, snapshot_month, progress, metrics, recorded_at
FROM "ProgressHistory"
WHERE entity_type = 'activity'
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
        progress:
          typeof r.progress === "number" ? r.progress : Number(r.progress) || 0,
        metrics: r.metrics || {},
        recorded_at: r.recorded_at,
      });
    }

    // fallback: derive report-based timelines if no progress snapshots
    if (Object.keys(historyByActivity).length === 0) {
      for (const row of raw) {
        if (!row.activity_id || !row.report_id) continue;
        const actId = row.activity_id;
        const createdAt =
          row.report_createdat ||
          row.report_createdAt ||
          row.createdat ||
          row.createdAt;
        const metrics = row.report_metrics || {};
        if (!historyByActivity[actId]) historyByActivity[actId] = [];
        historyByActivity[actId].push({
          reportId: row.report_id,
          date: createdAt,
          metrics,
          newStatus: row.report_new_status,
        });
      }
    }

    // Build breakdowns from snapshots (or later use report-based grouping)
    const breakdowns = {};
    for (const [actId, snaps] of Object.entries(historyByActivity)) {
      const numericActId = Number(actId);
      breakdowns[numericActId] = { monthly: {}, quarterly: {}, annual: {} };
      for (const snap of snaps) {
        const dateStr = snap.snapshot_month || snap.recorded_at || snap.date;
        const d = new Date(dateStr);
        if (isNaN(d)) continue;
        const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
        const quarterKey = `${d.getFullYear()}-Q${
          Math.floor(d.getMonth() / 3) + 1
        }`;
        const yearKey = `${d.getFullYear()}`;
        if (!breakdowns[numericActId].monthly[monthKey])
          breakdowns[numericActId].monthly[monthKey] = [];
        breakdowns[numericActId].monthly[monthKey].push({
          date: dateStr,
          progress: snap.progress,
          metrics: snap.metrics,
          recorded_at: snap.recorded_at || snap.date,
        });
        if (!breakdowns[numericActId].quarterly[quarterKey])
          breakdowns[numericActId].quarterly[quarterKey] = [];
        breakdowns[numericActId].quarterly[quarterKey].push({
          date: dateStr,
          progress: snap.progress,
          metrics: snap.metrics,
          recorded_at: snap.recorded_at || snap.date,
        });
        if (!breakdowns[numericActId].annual[yearKey])
          breakdowns[numericActId].annual[yearKey] = [];
        breakdowns[numericActId].annual[yearKey].push({
          date: dateStr,
          progress: snap.progress,
          metrics: snap.metrics,
          recorded_at: snap.recorded_at || snap.date,
        });
      }
    }

    // Build hierarchical master JSON using your existing helper
    const masterJson = generateReportJson(raw);

    // === MINIMAL & SAFE CHANGE: attach previousMetric only ===
    // Build a map from raw rows to pick the first non-null previousMetric for each activity
    const activityPreviousById = {};
    for (const row of raw) {
      const aid = Number(row.activity_id);
      if (!aid) continue;
      if (activityPreviousById[aid]) continue; // already filled
      // defensive lookups for column name variants
      const candidate =
        row.activity_previous_metric ??
        row.previousmetric ??
        row.previous_metric ??
        row["previousMetric"] ??
        row["previous_metric"] ??
        row.previousMetric ??
        null;
      if (candidate !== null && typeof candidate !== "undefined") {
        activityPreviousById[aid] = candidate;
      }
    }

    // Inject previousMetric onto activity objects, but do NOT touch currentMetric/targetMetric/history/progress etc.
    for (const goal of masterJson.goals || []) {
      for (const task of goal.tasks || []) {
        for (const activity of task.activities || []) {
          if (activityPreviousById[activity.id] && !activity.previousMetric) {
            activity.previousMetric = activityPreviousById[activity.id];
          }
          // Attach history exactly as before (unchanged behavior)
          activity.history = breakdowns[activity.id] || {
            monthly: {},
            quarterly: {},
            annual: {},
          };
        }
      }
    }
    // === end minimal change ===

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
    console.error(
      "Error generating master report:",
      err && err.message ? err.message : err
    );
    res.status(500).json({ error: err.message || String(err) });
  }
};
