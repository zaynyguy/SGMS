// src/controllers/activitiesController.js
const db = require("../db");
const notificationService = require("../services/notificationService");
const { logAudit } = require("../helpers/audit");
const EPS = 1e-9;

exports.getActivitiesByTask = async (req, res) => {
  const { taskId } = req.params;
  try {
    const isManager =
      Array.isArray(req.user?.permissions) &&
      req.user.permissions.includes("manage_gta");

    if (isManager) {
      const q = `
        SELECT a.*, t."goalId", gl."groupId", g.name AS "groupName"
        FROM "Activities" a
        JOIN "Tasks" t ON a."taskId" = t.id
        JOIN "Goals" gl ON t."goalId" = gl.id
        JOIN "Groups" g ON gl."groupId" = g.id
        WHERE a."taskId" = $1
        ORDER BY COALESCE(a."rollNo", 999999), a."createdAt" DESC
      `;
      const { rows } = await db.query(q, [taskId]);
      return res.json(rows);
    }

    const q = `
      SELECT a.*, t."goalId", gl."groupId", g.name AS "groupName"
      FROM "Activities" a
      JOIN "Tasks" t ON a."taskId" = t.id
      JOIN "Goals" gl ON t."goalId" = gl.id
      JOIN "Groups" g ON gl."groupId" = g.id
      JOIN "UserGroups" ug ON ug."groupId" = g.id
      WHERE a."taskId" = $1 AND ug."userId" = $2
      ORDER BY COALESCE(a."rollNo", 999999), a."createdAt" DESC
    `;
    const { rows } = await db.query(q, [taskId, req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error("getActivitiesByTask error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch activities.", error: err.message });
  }
};

exports.createActivity = async (req, res) => {
  const { taskId } = req.params;
  const { title, description, dueDate, weight, targetMetric, rollNo } = req.body;

  if (!title || String(title).trim() === "") {
    return res.status(400).json({ message: "Title is required." });
  }

  try {
    const activity = await db.tx(async (client) => {
      const t = await client.query(
        'SELECT id, weight FROM "Tasks" WHERE id=$1 FOR UPDATE',
        [taskId]
      );
      if (!t.rows.length) {
        const err = new Error("Task not found");
        err.status = 404;
        throw err;
      }

      const taskWeight = parseFloat(t.rows[0].weight) || 0;
      const newWeight =
        weight !== undefined && weight !== null
          ? parseFloat(String(weight))
          : 0;

      if (Number.isNaN(newWeight)) {
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
        [taskId]
      );
      const sumOther = parseFloat(sumRes.rows[0].sum || 0);

      if (newWeight + sumOther > taskWeight + EPS) {
        const err = new Error(
          `Cannot set activity weight to ${newWeight}. Task total is ${taskWeight} and ${sumOther} is already used.`
        );
        err.status = 400;
        throw err;
      }

      // rollNo handling (optional)
      let insertRes;
      if (rollNo !== undefined && rollNo !== null && String(rollNo).trim() !== "") {
        const rn = Number(rollNo);
        if (!Number.isInteger(rn) || rn <= 0) {
          const err = new Error("rollNo must be a positive integer");
          err.status = 400;
          throw err;
        }

        // uniqueness check per task
        const dup = await client.query(
          `SELECT id FROM "Activities" WHERE "taskId" = $1 AND "rollNo" = $2`,
          [taskId, rn]
        );
        if (dup.rows.length) {
          const err = new Error(`rollNo ${rn} is already in use for this task`);
          err.status = 409;
          throw err;
        }

        insertRes = await client.query(
          `INSERT INTO "Activities"
            ("taskId", "rollNo", title, description, "dueDate", "weight", "targetMetric", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7, NOW(), NOW())
           RETURNING *`,
          [
            taskId,
            rn,
            String(title).trim(),
            description?.trim() || null,
            dueDate || null,
            newWeight,
            targetMetric ?? null,
          ]
        );
      } else {
        insertRes = await client.query(
          `INSERT INTO "Activities"
            ("taskId", title, description, "dueDate", "weight", "targetMetric", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6, NOW(), NOW())
           RETURNING *`,
          [
            taskId,
            String(title).trim(),
            description?.trim() || null,
            dueDate || null,
            newWeight,
            targetMetric ?? null,
          ]
        );
      }

      if (!insertRes.rows || !insertRes.rows[0]) throw new Error("Failed to create activity");

      const newActivity = insertRes.rows[0];

      try {
        await logAudit({
          userId: req.user.id,
          action: "ACTIVITY_CREATED",
          entity: "Activity",
          entityId: newActivity.id,
          details: { title: newActivity.title, taskId: newActivity.taskId, rollNo: newActivity.rollNo },
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

    res
      .status(201)
      .json({ message: "Activity created successfully.", activity });
  } catch (err) {
    console.error("createActivity error:", err);
    if (err && (err.status === 404 || err.status === 409))
      return res.status(err.status).json({ message: err.message });
    if (err && err.status === 400)
      return res.status(400).json({ message: err.message });
    // unique-violation fallback
    if (err && err.code === "23505") {
      return res.status(409).json({ message: "rollNo conflict: that roll number is already in use for this task." });
    }
    return res
      .status(500)
      .json({ message: "Failed to create activity.", error: err.message });
  }
};

exports.updateActivity = async (req, res) => {
  const { activityId } = req.params;
  const { title, description, status, dueDate, weight, targetMetric, isDone, rollNo } =
    req.body;

  const bRes = await db.query('SELECT * FROM "Activities" WHERE id=$1', [
    activityId,
  ]);
  const beforeActivity = bRes.rows[0] || null;

  try {
    const activity = await db.tx(async (client) => {
      const c = await client.query(
        'SELECT * FROM "Activities" WHERE id=$1 FOR UPDATE',
        [activityId]
      );
      if (!c.rows.length) {
        const e = new Error("Activity not found");
        e.status = 404;
        throw e;
      }

      // rollNo uniqueness (if provided)
      if (rollNo !== undefined && rollNo !== null && String(rollNo).trim() !== "") {
        const rn = Number(rollNo);
        if (!Number.isInteger(rn) || rn <= 0) {
          const err = new Error("rollNo must be a positive integer");
          err.status = 400;
          throw err;
        }
        const dup = await client.query(
          `SELECT id FROM "Activities" WHERE "taskId" = $1 AND "rollNo" = $2 AND id <> $3`,
          [c.rows[0].taskId, rn, activityId]
        );
        if (dup.rows.length) {
          const err = new Error(`rollNo ${rn} is already in use for this task`);
          err.status = 409;
          throw err;
        }
      }

      let newWeight = weight ?? c.rows[0].weight;
      newWeight = parseFloat(String(newWeight));
      if (Number.isNaN(newWeight)) {
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
        [c.rows[0].taskId]
      );
      const taskWeight = parseFloat(tRes.rows[0].weight) || 0;

      const sumRes = await client.query(
        'SELECT COALESCE(SUM(weight)::numeric,0) AS sum FROM "Activities" WHERE "taskId"=$1 AND id<>$2',
        [c.rows[0].taskId, activityId]
      );
      const sumOther = parseFloat(sumRes.rows[0].sum || 0);

      if (newWeight + sumOther > taskWeight + EPS) {
        const err = new Error(
          `Cannot set activity weight to ${newWeight}. Task total is ${taskWeight} and ${sumOther} is already used.`
        );
        err.status = 400;
        throw err;
      }

      const r = await client.query(
        `UPDATE "Activities"
         SET "rollNo" = COALESCE($1, "rollNo"),
             title=$2, description=$3, status=COALESCE($4, status),
             "dueDate"=$5, "weight"=$6,
             "targetMetric"=COALESCE($7, "targetMetric"),
             "isDone"=COALESCE($8, "isDone"), "updatedAt"=NOW()
         WHERE id=$9
         RETURNING *`,
        [
          rollNo !== undefined && rollNo !== null && String(rollNo).trim() !== "" ? Number(rollNo) : null,
          title?.trim() || null,
          description?.trim() || null,
          status || null,
          dueDate || null,
          newWeight,
          targetMetric ?? null,
          isDone !== undefined ? isDone : null,
          activityId,
        ]
      );
      if (!r.rows || !r.rows[0]) throw new Error("Failed to update activity");

      const updatedActivity = r.rows[0];

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

    res.json({ message: "Activity updated successfully.", activity });
  } catch (err) {
    console.error("updateActivity error:", err);
    if (err && (err.status === 404 || err.status === 409))
      return res.status(err.status).json({ message: err.message });
    if (err && err.status === 400)
      return res.status(400).json({ message: err.message });
    if (err && err.code === "23505") {
      return res.status(409).json({ message: "rollNo conflict: that roll number is already in use for this task." });
    }
    return res
      .status(500)
      .json({ message: "Failed to update activity.", error: err.message });
  }
};

exports.deleteActivity = async (req, res) => {
  const { activityId } = req.params;

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
        [activityId]
      );
      const deletedRow = r.rows && r.rows[0] ? r.rows[0] : null;

      // Audit deletion
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

    res.json({ message: "Activity deleted successfully." });
  } catch (err) {
    console.error("deleteActivity error:", err);
    if (err && err.status === 404)
      return res.status(404).json({ message: err.message });
    return res
      .status(500)
      .json({ message: "Failed to delete activity.", error: err.message });
  }
};
