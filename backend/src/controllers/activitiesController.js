// backend/src/controllers/activitiesController.js
const db = require("../db");
const notificationService = require("../services/notificationService");
const { logAudit } = require("../helpers/audit");

const EPS = 1e-9;

// Parsing helpers
function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toIntOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isInteger(n) ? n : null;
}

function toBoolean(v) {
  if (v === true || v === false) return v;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return Boolean(v);
}

function safeParseJson(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      return v.trim() === "" ? null : JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

function nullIfEmpty(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  return v;
}

function roundToTwo(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function areWeightsEqual(a, b) {
  return Math.abs(a - b) < 1e-6;
}

exports.getActivitiesByTask = async (req, res) => {
  const taskId = toIntOrNull(req.params.taskId);
  if (!taskId) return res.status(400).json({ message: "Invalid taskId" });

  const quarter = toIntOrNull(req.query.quarter);
  if (quarter && (quarter < 1 || quarter > 4)) {
    return res
      .status(400)
      .json({ message: "Invalid quarter parameter. Must be 1, 2, 3, or 4." });
  }

  try {
    const isManager =
      Array.isArray(req.user?.permissions) &&
      req.user.permissions.includes("manage_gta");

    let baseQueryStr = `
      SELECT a.*, t."goalId", gl."groupId", g.name AS "groupName"
      FROM "Activities" a
      JOIN "Tasks" t ON a."taskId" = t.id
      JOIN "Goals" gl ON t."goalId" = gl.id
      JOIN "Groups" g ON gl."groupId" = g.id
    `;
    const params = [taskId];
    const whereClauses = [`a."taskId" = $1`];

    if (!isManager) {
      baseQueryStr += ' JOIN "UserGroups" ug ON ug."groupId" = g.id';
      params.push(req.user.id);
      whereClauses.push(`ug."userId" = $${params.length}`);
    }

    if (quarter) {
      const qKey = `q${quarter}`;
      params.push(qKey);
      whereClauses.push(
        `COALESCE((a."quarterlyGoals"->>$${params.length})::numeric, 0) > 0`,
      );
    }

    const finalQuery = `
      ${baseQueryStr}
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY COALESCE(a."rollNo", 999999), a."createdAt" DESC
    `;

    const { rows } = await db.query(finalQuery, params);

    // Fetch quarterly records for all activities and attach them
    if (rows.length > 0) {
      const activityIds = rows.map((r) => r.id);

      // Get current fiscal year
      const fiscalRes = await db.query(
        `SELECT * FROM calc_fiscal_period(CURRENT_DATE)`,
      );
      const currentFiscalYear =
        fiscalRes.rows[0]?.fiscal_year || new Date().getFullYear();

      // Fetch all quarterly records for these activities
      const recordsRes = await db.query(
        `SELECT "activityId", "quarter", "metricKey", "value" 
         FROM "ActivityRecords" 
         WHERE "activityId" = ANY($1) 
         AND "fiscalYear" = $2 
         AND "quarter" IS NOT NULL`,
        [activityIds, currentFiscalYear],
      );

      // Group records by activity
      const recordsByActivity = {};
      for (const rec of recordsRes.rows) {
        if (!recordsByActivity[rec.activityId]) {
          recordsByActivity[rec.activityId] = {
            q1: "",
            q2: "",
            q3: "",
            q4: "",
          };
        }
        const qKey = `q${rec.quarter}`;
        recordsByActivity[rec.activityId][qKey] = rec.value;
      }

      // Attach to each activity
      for (const activity of rows) {
        activity.quarterlyRecords = recordsByActivity[activity.id] || {
          q1: "",
          q2: "",
          q3: "",
          q4: "",
        };
      }
    }

    return res.json(rows);
  } catch (err) {
    console.error("getActivitiesByTask error:", err);
    return res
      .status(500)
      .json({ message: "Failed to fetch activities.", error: err.message });
  }
};

exports.createActivity = async (req, res) => {
  const taskId = toIntOrNull(req.params.taskId);
  if (!taskId) return res.status(400).json({ message: "Invalid taskId" });

  const {
    title,
    description,
    dueDate,
    weight,
    targetMetric,
    previousMetric,
    rollNo,
    quarterlyGoals,
    metricType, // ADDED
  } = req.body;

  if (!title || String(title).trim() === "") {
    return res.status(400).json({ message: "Title is required." });
  }

  const parsedTargetMetric = safeParseJson(targetMetric);
  const parsedPreviousMetric = safeParseJson(previousMetric);
  const parsedQuarterlyGoals = safeParseJson(quarterlyGoals);

  // Validate Metric Type
  const validTypes = ["Plus", "Minus", "Increase", "Decrease", "Maintain"];
  const safeMetricType = validTypes.includes(metricType) ? metricType : "Plus";

  try {
    const activity = await db.tx(async (client) => {
      // lock task
      const t = await client.query(
        'SELECT id, weight FROM "Tasks" WHERE id=$1 FOR UPDATE',
        [taskId],
      );
      if (!t.rows.length) {
        const err = new Error("Task not found");
        err.status = 404;
        throw err;
      }

      const taskWeight = parseFloat(t.rows[0].weight) || 0;
      const newWeight = toNumberOrNull(weight);

      if (newWeight === null) {
        const err = new Error("Activity weight must be a number");
        err.status = 400;
        throw err;
      }
      if (newWeight <= 0) {
        const err = new Error("Activity weight must be > 0");
        err.status = 400;
        throw err;
      }

      const sumRes = await client.query(
        'SELECT COALESCE(SUM(weight)::numeric,0) AS sum FROM "Activities" WHERE "taskId"=$1',
        [taskId],
      );
      const sumOther = parseFloat(sumRes.rows[0].sum || 0);
      const totalAfter = roundToTwo(newWeight + sumOther);
      const taskWeightRounded = roundToTwo(taskWeight);

      if (
        totalAfter > taskWeightRounded &&
        !areWeightsEqual(totalAfter, taskWeightRounded)
      ) {
        const err = new Error(
          `Cannot set activity weight to ${newWeight}. Task total is ${taskWeight} and ${sumOther} is already used. Available: ${roundToTwo(taskWeight - sumOther)}`,
        );
        err.status = 400;
        throw err;
      }

      // rollNo handling
      let insertRes;
      const rn = toIntOrNull(rollNo);

      if (rn !== null) {
        const dup = await client.query(
          `SELECT id FROM "Activities" WHERE "taskId" = $1 AND "rollNo" = $2`,
          [taskId, rn],
        );
        if (dup.rows.length) {
          const err = new Error(`rollNo ${rn} is already in use for this task`);
          err.status = 409;
          throw err;
        }

        insertRes = await client.query(
          `INSERT INTO "Activities"
           ("taskId", "rollNo", title, description, "dueDate", "weight", "targetMetric", "previousMetric", "quarterlyGoals", "metricType", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7, $8, $9, $10, NOW(), NOW())
           RETURNING *`,
          [
            taskId,
            rn,
            String(title).trim(),
            description?.trim() || null,
            dueDate || null,
            newWeight,
            parsedTargetMetric ?? null,
            parsedPreviousMetric ?? null,
            parsedQuarterlyGoals ?? null,
            safeMetricType, // Insert metricType
          ],
        );
      } else {
        insertRes = await client.query(
          `INSERT INTO "Activities"
           ("taskId", title, description, "dueDate", "weight", "targetMetric", "previousMetric", "quarterlyGoals", "metricType", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6, $7, $8, $9, NOW(), NOW())
           RETURNING *`,
          [
            taskId,
            String(title).trim(),
            description?.trim() || null,
            dueDate || null,
            newWeight,
            parsedTargetMetric ?? null,
            parsedPreviousMetric ?? null,
            parsedQuarterlyGoals ?? null,
            safeMetricType, // Insert metricType
          ],
        );
      }

      if (!insertRes.rows || !insertRes.rows[0])
        throw new Error("Failed to create activity");

      const newActivity = insertRes.rows[0];

      try {
        await logAudit({
          userId: req.user.id,
          action: "ACTIVITY_CREATED",
          entity: "Activity",
          entityId: newActivity.id,
          details: {
            title: newActivity.title,
            taskId: newActivity.taskId,
            rollNo: newActivity.rollNo,
            metricType: newActivity.metricType,
          },
          client,
          req,
        });
      } catch (e) {
        console.error("ACTIVITY_CREATED audit failed (in-tx):", e);
      }

      return newActivity;
    });

    try {
      await notificationService({
        userId: req.user.id,
        type: "activity_created",
        message: `Activity "${activity.title}" created.`,
        meta: { activityId: activity.id },
      });
    } catch (notifErr) {
      console.error("createActivity: notification failed:", notifErr);
    }

    return res
      .status(201)
      .json({ message: "Activity created successfully.", activity });
  } catch (err) {
    console.error("createActivity error:", err);
    if (err && (err.status === 404 || err.status === 409))
      return res.status(err.status).json({ message: err.message });
    if (err && err.status === 400)
      return res.status(400).json({ message: err.message });
    if (err && err.code === "23505") {
      return res.status(409).json({
        message:
          "rollNo conflict: that roll number is already in use for this task.",
      });
    }
    return res
      .status(500)
      .json({ message: "Failed to create activity.", error: err.message });
  }
};

exports.updateActivity = async (req, res) => {
  const activityId = toIntOrNull(req.params.activityId);
  if (!activityId)
    return res.status(400).json({ message: "Invalid activityId" });

  const {
    title,
    description,
    status,
    dueDate,
    weight,
    targetMetric,
    previousMetric,
    quarterlyGoals,
    quarterlyRecords, // NEW: editable quarterly records
    isDone,
    rollNo,
    metricType, // ADDED
  } = req.body;

  const bRes = await db.query('SELECT * FROM "Activities" WHERE id=$1', [
    activityId,
  ]);
  const beforeActivity = bRes.rows[0] || null;

  try {
    const activity = await db.tx(async (client) => {
      const c = await client.query(
        'SELECT * FROM "Activities" WHERE id=$1 FOR UPDATE',
        [activityId],
      );
      if (!c.rows.length) {
        const e = new Error("Activity not found");
        e.status = 404;
        throw e;
      }
      const existing = c.rows[0];

      // rollNo uniqueness
      const rn = toIntOrNull(rollNo);
      if (
        rollNo !== undefined &&
        rollNo !== null &&
        String(rollNo).trim() !== ""
      ) {
        if (rn === null) {
          const err = new Error("rollNo must be a positive integer");
          err.status = 400;
          throw err;
        }
        const dup = await client.query(
          `SELECT id FROM "Activities" WHERE "taskId" = $1 AND "rollNo" = $2 AND id <> $3`,
          [existing.taskId, rn, activityId],
        );
        if (dup.rows.length) {
          const err = new Error(`rollNo ${rn} is already in use for this task`);
          err.status = 409;
          throw err;
        }
      }

      let newWeight = toNumberOrNull(weight ?? existing.weight);
      if (newWeight === null) {
        const err = new Error("Activity weight must be a number");
        err.status = 400;
        throw err;
      }
      if (newWeight <= 0) {
        const err = new Error("Activity weight must be > 0");
        err.status = 400;
        throw err;
      }

      const tRes = await client.query(
        'SELECT weight FROM "Tasks" WHERE id=$1 FOR UPDATE',
        [existing.taskId],
      );
      if (!tRes.rows.length) {
        const err = new Error("Parent task not found");
        err.status = 404;
        throw err;
      }
      const taskWeight = parseFloat(tRes.rows[0].weight) || 0;

      const sumRes = await client.query(
        'SELECT COALESCE(SUM(weight)::numeric,0) AS sum FROM "Activities" WHERE "taskId"=$1 AND id<>$2',
        [existing.taskId, activityId],
      );
      const sumOther = parseFloat(sumRes.rows[0].sum || 0);
      const totalAfter = roundToTwo(newWeight + sumOther);
      const taskWeightRounded = roundToTwo(taskWeight);

      if (
        totalAfter > taskWeightRounded &&
        !areWeightsEqual(totalAfter, taskWeightRounded)
      ) {
        const err = new Error(
          `Cannot set activity weight to ${newWeight}. Task total is ${taskWeight} and ${sumOther} is already used. Available: ${roundToTwo(taskWeight - sumOther)}`,
        );
        err.status = 400;
        throw err;
      }

      const parsedTargetMetric = safeParseJson(targetMetric);
      const parsedPreviousMetric = safeParseJson(previousMetric);
      const parsedQuarterlyGoals = safeParseJson(quarterlyGoals);

      const safeTitle = nullIfEmpty(title)
        ? String(nullIfEmpty(title)).trim()
        : null;
      const safeDescription = nullIfEmpty(description)
        ? String(nullIfEmpty(description)).trim()
        : null;
      const safeStatus = nullIfEmpty(status);
      const safeDueDate = nullIfEmpty(dueDate);
      const safeIsDone = isDone === undefined ? null : toBoolean(isDone);

      // Validate Metric Type
      const validTypes = ["Plus", "Minus", "Increase", "Decrease", "Maintain"];
      let safeMetricType = null;
      if (metricType !== undefined) {
        safeMetricType = validTypes.includes(metricType)
          ? metricType
          : existing.metricType;
      }

      // Update query including metricType
      const r = await client.query(
        `UPDATE "Activities"
         SET "rollNo" = COALESCE($1, "rollNo"),
             title=$2, description=$3, status=COALESCE($4, status),
             "dueDate"=$5, "weight"=$6,
             "targetMetric"=COALESCE($7, "targetMetric"),
             "isDone"=COALESCE($8, "isDone"), "updatedAt"=NOW(),
             "previousMetric"=COALESCE($10, "previousMetric"),
             "quarterlyGoals"=COALESCE($11, "quarterlyGoals"),
             "metricType"=COALESCE($12, "metricType")
         WHERE id=$9
         RETURNING *`,
        [
          rn !== null ? rn : null,
          safeTitle ?? null,
          safeDescription ?? null,
          safeStatus ?? null,
          safeDueDate,
          newWeight,
          parsedTargetMetric ?? null,
          safeIsDone,
          activityId,
          parsedPreviousMetric ?? null,
          parsedQuarterlyGoals ?? null,
          safeMetricType, // $12
        ],
      );

      if (!r.rows || !r.rows[0]) throw new Error("Failed to update activity");
      const updatedActivity = r.rows[0];

      // NEW: Handle quarterlyRecords if provided
      if (quarterlyRecords && typeof quarterlyRecords === "object") {
        // Get fiscal year from database helper function
        const fiscalRes = await client.query(
          `SELECT * FROM calc_fiscal_period(CURRENT_DATE)`,
        );
        const fiscalYear =
          fiscalRes.rows[0]?.fiscal_year || new Date().getFullYear();

        // Get metric key from target metric
        const targetMetricObj = updatedActivity.targetMetric || {};
        const metricKey = Object.keys(targetMetricObj)[0] || "value";

        // Upsert each quarter's record
        for (const [quarter, value] of Object.entries(quarterlyRecords)) {
          const qNum = parseInt(quarter.replace("q", ""), 10);

          if (qNum >= 1 && qNum <= 4) {
            // If value is null or empty string, treat it as a DELETE request
            if (value === null || value === undefined || value === "") {
              await client.query(
                `DELETE FROM "ActivityRecords" 
                 WHERE "activityId" = $1 
                   AND "fiscalYear" = $2 
                   AND "quarter" = $3 
                   AND "metricKey" = $4`,
                [activityId, fiscalYear, qNum, metricKey],
              );
            } else {
              // Otherwise UPSERT
              const numVal = toNumberOrNull(value);
              if (numVal !== null) {
                await client.query(
                  `INSERT INTO "ActivityRecords" 
                    ("activityId", "fiscalYear", "quarter", "month", "metricKey", "value", "source", "updatedBy", "createdBy")
                   VALUES ($1, $2, $3, NULL, $4, $5, 'manual', $6, $6)
                   ON CONFLICT ("activityId", "fiscalYear", "quarter", "metricKey") 
                   WHERE "quarter" IS NOT NULL
                   DO UPDATE SET 
                     "value" = $5,
                     "source" = 'manual',
                     "updatedBy" = $6,
                     "updatedAt" = NOW()`,
                  [
                    activityId,
                    fiscalYear,
                    qNum,
                    metricKey,
                    numVal,
                    req.user.id,
                  ],
                );
              }
            }
          }
        }
      }

      try {
        await logAudit({
          userId: req.user.id,
          action: "ACTIVITY_UPDATED",
          entity: "Activity",
          entityId: updatedActivity.id,
          before: beforeActivity,
          after: updatedActivity,
          client,
          req,
        });
      } catch (e) {
        console.error("ACTIVITY_UPDATED audit failed (in-tx):", e);
      }

      return updatedActivity;
    });

    try {
      await notificationService({
        userId: req.user.id,
        type: "activity_updated",
        message: `Activity "${activity.title}" updated.`,
        meta: { activityId: activity.id },
      });
    } catch (notifErr) {
      console.error("updateActivity: notification failed:", notifErr);
    }

    return res.json({ message: "Activity updated successfully.", activity });
  } catch (err) {
    console.error("updateActivity error:", err);
    if (err && (err.status === 404 || err.status === 409))
      return res.status(err.status).json({ message: err.message });
    if (err && err.status === 400)
      return res.status(400).json({ message: err.message });
    if (err && err.code === "22P02") {
      return res.status(400).json({ message: "Invalid input type provided." });
    }
    return res
      .status(500)
      .json({ message: "Failed to update activity.", error: err.message });
  }
};

exports.deleteActivity = async (req, res) => {
  const activityId = toIntOrNull(req.params.activityId);
  if (!activityId)
    return res.status(400).json({ message: "Invalid activityId" });

  try {
    const deleted = await db.tx(async (client) => {
      const a = await client.query('SELECT * FROM "Activities" WHERE id=$1', [
        activityId,
      ]);
      if (!a.rows.length) {
        const e = new Error("Activity not found");
        e.status = 404;
        throw e;
      }
      const toDelete = a.rows[0];

      const r = await client.query(
        'DELETE FROM "Activities" WHERE id=$1 RETURNING *',
        [activityId],
      );
      const deletedRow = r.rows && r.rows[0] ? r.rows[0] : null;

      try {
        await logAudit({
          userId: req.user.id,
          action: "ACTIVITY_DELETED",
          entity: "Activity",
          entityId: activityId,
          before: toDelete,
          client,
          req,
        });
      } catch (e) {
        console.error("ACTIVITY_DELETED audit failed (in-tx):", e);
      }
      return deletedRow;
    });

    try {
      await notificationService({
        userId: req.user.id,
        type: "activity_deleted",
        message: deleted
          ? `Activity "${deleted.title}" deleted.`
          : `Activity ${activityId} deleted.`,
        meta: { activityId },
      });
    } catch (notifErr) {
      console.error("deleteActivity: notification failed:", notifErr);
    }

    return res.json({ message: "Activity deleted successfully." });
  } catch (err) {
    console.error("deleteActivity error:", err);
    if (err && err.status === 404)
      return res.status(404).json({ message: err.message });
    return res
      .status(500)
      .json({ message: "Failed to delete activity.", error: err.message });
  }
};

// ================================================================
// ACTIVITY RECORDS CRUD OPERATIONS
// ================================================================

/**
 * Get all records for an activity
 * Supports filtering by fiscalYear, quarter, and granularity (quarterly/monthly)
 */
exports.getActivityRecords = async (req, res) => {
  const activityId = toIntOrNull(req.params.activityId);
  if (!activityId)
    return res.status(400).json({ message: "Invalid activityId" });

  const { fiscalYear, quarter, granularity } = req.query;

  try {
    let query = `
      SELECT ar.*, u_created.name as "createdByName", u_updated.name as "updatedByName"
      FROM "ActivityRecords" ar
      LEFT JOIN "Users" u_created ON ar."createdBy" = u_created.id
      LEFT JOIN "Users" u_updated ON ar."updatedBy" = u_updated.id
      WHERE ar."activityId" = $1
    `;
    const params = [activityId];
    let paramIndex = 2;

    if (fiscalYear) {
      query += ` AND ar."fiscalYear" = $${paramIndex}`;
      params.push(toIntOrNull(fiscalYear));
      paramIndex++;
    }

    if (quarter) {
      query += ` AND ar."quarter" = $${paramIndex}`;
      params.push(toIntOrNull(quarter));
      paramIndex++;
    }

    // Filter by granularity
    if (granularity === "quarterly") {
      query += ` AND ar."quarter" IS NOT NULL`;
    } else if (granularity === "monthly") {
      query += ` AND ar."month" IS NOT NULL AND ar."quarter" IS NULL`;
    }

    query += ` ORDER BY ar."fiscalYear" DESC, ar."quarter" NULLS LAST, ar."month" NULLS LAST, ar."metricKey"`;

    const { rows } = await db.query(query, params);
    return res.json(rows);
  } catch (err) {
    console.error("getActivityRecords error:", err);
    return res
      .status(500)
      .json({ message: "Failed to fetch records.", error: err.message });
  }
};

/**
 * Update or create activity records (upsert)
 * Expects body: { records: [{ fiscalYear, quarter, month, metricKey, value }, ...] }
 */
exports.upsertActivityRecords = async (req, res) => {
  const activityId = toIntOrNull(req.params.activityId);
  if (!activityId)
    return res.status(400).json({ message: "Invalid activityId" });

  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ message: "Records array is required" });
  }

  try {
    const results = await db.tx(async (client) => {
      // Verify activity exists
      const actCheck = await client.query(
        `SELECT id FROM "Activities" WHERE id = $1`,
        [activityId],
      );
      if (!actCheck.rows.length) {
        const err = new Error("Activity not found");
        err.status = 404;
        throw err;
      }

      const upserted = [];

      for (const record of records) {
        const { fiscalYear, quarter, month, metricKey, value } = record;

        if (!fiscalYear || !metricKey) {
          continue; // Skip invalid records
        }

        const numValue = toNumberOrNull(value);

        if (quarter !== null && quarter !== undefined) {
          // Quarterly record
          const result = await client.query(
            `INSERT INTO "ActivityRecords" 
              ("activityId", "fiscalYear", "quarter", "month", "metricKey", "value", "source", "updatedBy", "createdBy")
             VALUES ($1, $2, $3, NULL, $4, $5, 'manual', $6, $6)
             ON CONFLICT ("activityId", "fiscalYear", "quarter", "metricKey") 
             WHERE "quarter" IS NOT NULL
             DO UPDATE SET 
               "value" = $5,
               "source" = 'manual',
               "updatedBy" = $6,
               "updatedAt" = NOW()
             RETURNING *`,
            [activityId, fiscalYear, quarter, metricKey, numValue, req.user.id],
          );
          upserted.push(result.rows[0]);
        } else if (month !== null && month !== undefined) {
          // Monthly record
          const result = await client.query(
            `INSERT INTO "ActivityRecords" 
              ("activityId", "fiscalYear", "quarter", "month", "metricKey", "value", "source", "updatedBy", "createdBy")
             VALUES ($1, $2, NULL, $3, $4, $5, 'manual', $6, $6)
             ON CONFLICT ("activityId", "fiscalYear", "month", "metricKey") 
             WHERE "month" IS NOT NULL AND "quarter" IS NULL
             DO UPDATE SET 
               "value" = $5,
               "source" = 'manual',
               "updatedBy" = $6,
               "updatedAt" = NOW()
             RETURNING *`,
            [activityId, fiscalYear, month, metricKey, numValue, req.user.id],
          );
          upserted.push(result.rows[0]);
        }
      }

      // Log audit
      try {
        await logAudit({
          userId: req.user.id,
          action: "ACTIVITY_RECORDS_UPDATED",
          entity: "ActivityRecords",
          entityId: activityId,
          details: { recordCount: upserted.length },
          client,
          req,
        });
      } catch (e) {
        console.error("ACTIVITY_RECORDS_UPDATED audit failed:", e);
      }

      return upserted;
    });

    return res.json({
      message: "Records updated successfully.",
      records: results,
      count: results.length,
    });
  } catch (err) {
    console.error("upsertActivityRecords error:", err);
    if (err && err.status === 404) {
      return res.status(404).json({ message: err.message });
    }
    return res
      .status(500)
      .json({ message: "Failed to update records.", error: err.message });
  }
};

/**
 * Delete a specific activity record
 */
exports.deleteActivityRecord = async (req, res) => {
  const activityId = toIntOrNull(req.params.activityId);
  const recordId = toIntOrNull(req.params.recordId);

  if (!activityId || !recordId) {
    return res.status(400).json({ message: "Invalid activityId or recordId" });
  }

  try {
    const result = await db.tx(async (client) => {
      // Verify record exists and belongs to activity
      const recordCheck = await client.query(
        `SELECT * FROM "ActivityRecords" WHERE id = $1 AND "activityId" = $2`,
        [recordId, activityId],
      );

      if (!recordCheck.rows.length) {
        const err = new Error("Record not found");
        err.status = 404;
        throw err;
      }

      const deletedRecord = recordCheck.rows[0];

      await client.query(`DELETE FROM "ActivityRecords" WHERE id = $1`, [
        recordId,
      ]);

      // Log audit
      try {
        await logAudit({
          userId: req.user.id,
          action: "ACTIVITY_RECORD_DELETED",
          entity: "ActivityRecords",
          entityId: recordId,
          before: deletedRecord,
          client,
          req,
        });
      } catch (e) {
        console.error("ACTIVITY_RECORD_DELETED audit failed:", e);
      }

      return deletedRecord;
    });

    return res.json({
      message: "Record deleted successfully.",
      record: result,
    });
  } catch (err) {
    console.error("deleteActivityRecord error:", err);
    if (err && err.status === 404) {
      return res.status(404).json({ message: err.message });
    }
    return res
      .status(500)
      .json({ message: "Failed to delete record.", error: err.message });
  }
};

/**
 * Get aggregated records for master report display
 * Returns records grouped by activity with fiscal calculations
 */
exports.getAggregatedRecords = async (req, res) => {
  const { groupId, fiscalYear, granularity = "quarterly" } = req.query;

  try {
    let query = `
      SELECT 
        ar."activityId",
        ar."fiscalYear",
        ar."quarter",
        ar."month",
        ar."metricKey",
        ar."value",
        ar."source",
        a.title as "activityTitle",
        a."targetMetric",
        a."quarterlyGoals",
        a."metricType",
        t.title as "taskTitle",
        t.id as "taskId",
        g.title as "goalTitle",
        g.id as "goalId",
        gr.name as "groupName",
        gr.id as "groupId"
      FROM "ActivityRecords" ar
      JOIN "Activities" a ON ar."activityId" = a.id
      JOIN "Tasks" t ON a."taskId" = t.id
      JOIN "Goals" g ON t."goalId" = g.id
      LEFT JOIN "Groups" gr ON g."groupId" = gr.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (groupId) {
      query += ` AND g."groupId" = $${paramIndex}`;
      params.push(toIntOrNull(groupId));
      paramIndex++;
    }

    if (fiscalYear) {
      query += ` AND ar."fiscalYear" = $${paramIndex}`;
      params.push(toIntOrNull(fiscalYear));
      paramIndex++;
    }

    if (granularity === "quarterly") {
      query += ` AND ar."quarter" IS NOT NULL`;
    } else if (granularity === "monthly") {
      query += ` AND ar."month" IS NOT NULL AND ar."quarter" IS NULL`;
    }

    query += ` ORDER BY gr.name, g.id, t.id, a.id, ar."fiscalYear", ar."quarter" NULLS LAST, ar."month" NULLS LAST`;

    const { rows } = await db.query(query, params);

    // Group by activity
    const grouped = {};
    for (const row of rows) {
      const key = row.activityId;
      if (!grouped[key]) {
        grouped[key] = {
          activityId: row.activityId,
          activityTitle: row.activityTitle,
          targetMetric: row.targetMetric,
          quarterlyGoals: row.quarterlyGoals,
          metricType: row.metricType,
          taskId: row.taskId,
          taskTitle: row.taskTitle,
          goalId: row.goalId,
          goalTitle: row.goalTitle,
          groupId: row.groupId,
          groupName: row.groupName,
          records: [],
        };
      }
      grouped[key].records.push({
        fiscalYear: row.fiscalYear,
        quarter: row.quarter,
        month: row.month,
        metricKey: row.metricKey,
        value: row.value,
        source: row.source,
      });
    }

    return res.json(Object.values(grouped));
  } catch (err) {
    console.error("getAggregatedRecords error:", err);
    return res.status(500).json({
      message: "Failed to fetch aggregated records.",
      error: err.message,
    });
  }
};
