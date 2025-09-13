// src/controllers/activitiesController.js
const db = require("../db");
const notificationService = require("../services/notificationService");
const { logAudit } = require("../helpers/audit");

// GET /api/tasks/:taskId/activities
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
        ORDER BY a."createdAt" DESC
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
      ORDER BY a."createdAt" DESC
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

// POST /api/tasks/:taskId/activities
exports.createActivity = async (req, res) => {
  const { taskId } = req.params;
  const { title, description, dueDate, weight, targetMetric } = req.body;

  if (!title || String(title).trim() === "") {
    return res.status(400).json({ message: "Title is required." });
  }

  try {
    const activity = await db.tx(async (client) => {
      const t = await client.query('SELECT id FROM "Tasks" WHERE id=$1', [
        taskId,
      ]);
      if (!t.rows.length) {
        const err = new Error("Task not found");
        err.status = 404;
        throw err;
      }

      const r = await client.query(
        `INSERT INTO "Activities"
        ("taskId", title, description, "dueDate", "weight", "targetMetric", "createdAt", "updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6, NOW(), NOW())
        RETURNING *`,
        [
          taskId,
          String(title).trim(),
          description?.trim() || null,
          dueDate || null,
          weight ?? 0,
          targetMetric ?? null,
        ]
      );
      if (!r.rows || !r.rows[0]) throw new Error("Failed to create activity");

      const newActivity = r.rows[0];

      // Audit inside the same transaction so audit rolls back if tx rolls back
      try {
        await logAudit({
          userId: req.user.id,
          action: "ACTIVITY_CREATED",
          entity: "Activity",
          entityId: newActivity.id,
          details: { title: newActivity.title, taskId: newActivity.taskId },
          client,
          req,
        });
      } catch (e) {
        console.error("ACTIVITY_CREATED audit failed (in-tx):", e);
        // don't break the transaction for audit failure
      }

      return newActivity;
    });

    // Post-commit notification (best-effort)
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
    if (err && err.status === 404)
      return res.status(404).json({ message: err.message });
    return res
      .status(500)
      .json({ message: "Failed to create activity.", error: err.message });
  }
};

// PUT /api/tasks/:taskId/activities/:activityId
exports.updateActivity = async (req, res) => {
  const { activityId } = req.params;
  const { title, description, status, dueDate, weight, targetMetric, isDone } =
    req.body;

  const bRes = await db.query('SELECT * FROM "Activities" WHERE id=$1', [
    activityId,
  ]);
  const beforeActivity = bRes.rows[0] || null;

  try {
    const activity = await db.tx(async (client) => {
      const c = await client.query('SELECT id FROM "Activities" WHERE id=$1', [
        activityId,
      ]);
      if (!c.rows.length) {
        const e = new Error("Activity not found");
        e.status = 404;
        throw e;
      }

      const r = await client.query(
        `UPDATE "Activities"
         SET title=$1, description=$2, status=COALESCE($3, status),
             "dueDate"=$4, "weight"=COALESCE($5, "weight"),
             "targetMetric"=COALESCE($6, "targetMetric"),
             "isDone"=COALESCE($7, "isDone"), "updatedAt"=NOW()
         WHERE id=$8
         RETURNING *`,
        [
          title?.trim() || null,
          description?.trim() || null,
          status || null,
          dueDate || null,
          weight ?? null,
          targetMetric ?? null,
          isDone !== undefined ? isDone : null,
          activityId,
        ]
      );
      if (!r.rows || !r.rows[0]) throw new Error("Failed to update activity");

      const updatedActivity = r.rows[0];

      // Audit inside transaction with before/after snapshots
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

    // Post-commit notification (best-effort)
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
    if (err && err.status === 404)
      return res.status(404).json({ message: err.message });
    return res
      .status(500)
      .json({ message: "Failed to update activity.", error: err.message });
  }
};

// DELETE activity
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

      // Audit the deletion inside the same transaction
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
