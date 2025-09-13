// src/controllers/tasksController.js
const db = require("../db");
const { logAudit } = require("../helpers/audit");
const notificationService = require("../services/notificationService");

exports.getTasksByGoal = async (req, res) => {
  const { goalId } = req.params;
  const isManager = req.user.permissions.includes("manage_gta");

  if (!isManager) {
    const check = await db.query(
      `SELECT 1 FROM "Goals" g
       JOIN "UserGroups" ug ON ug."groupId" = g."groupId"
       WHERE g.id = $1 AND ug."userId" = $2 LIMIT 1`,
      [goalId, req.user.id]
    );

    if (!check.rows.length)
      return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const { rows } = await db.query(
      `SELECT t.*, u.username AS assignee 
       FROM "Tasks" t
       LEFT JOIN "Users" u ON t."assigneeId" = u.id
       WHERE t."goalId" = $1
       ORDER BY t."createdAt" DESC`,
      [goalId]
    );

    res.json(rows);
  } catch (err) {
    console.error("getTasksByGoal error:", err);
    res.status(500).json({ message: "Failed to fetch tasks.", error: err.message });
  }
};

exports.createTask = async (req, res) => {
  const { goalId } = req.params;
  const { title, description, assigneeId, dueDate, weight } = req.body;

  if (!title) return res.status(400).json({ message: "Title is required." });

  try {
    const task = await db.tx(async (client) => {
      const insertRes = await client.query(
        `INSERT INTO "Tasks" ("goalId", title, description, "assigneeId", "dueDate", "weight", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6, NOW(), NOW()) RETURNING *`,
        [
          goalId,
          title.trim(),
          description?.trim() || null,
          assigneeId || null,
          dueDate || null,
          weight || 0,
        ]
      );
      const newTask = insertRes.rows[0];

      // Audit inside tx
      try {
        await logAudit({
          userId: req.user.id,
          action: "TASK_CREATED",
          entity: "Task",
          entityId: newTask.id,
          details: {
            title: newTask.title,
            assigneeId: newTask.assigneeId,
            goalId: newTask.goalId,
          },
          client,
          req,
        });
      } catch (e) {
        console.error("TASK_CREATED audit failed (in-tx):", e);
      }

      return newTask;
    });

    // Post-commit notification to assignee (best-effort)
    if (task && task.assigneeId) {
      try {
        await notificationService({
          userId: task.assigneeId,
          type: "task_assigned",
          message: `You were assigned to task "${task.title}".`,
          meta: { taskId: task.id, goalId },
        });
      } catch (nerr) {
        console.error("createTask: notification failed", nerr);
      }
    }

    res
      .status(201)
      .json({ message: "Task created successfully.", task });
  } catch (err) {
    console.error("createTask error:", err);
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
};

exports.updateTask = async (req, res) => {
  const { taskId } = req.params;
  const { title, description, assigneeId, dueDate, status, weight } = req.body;

  // fetch before snapshot
  const beforeTaskRes = await db.query(
    'SELECT * FROM "Tasks" WHERE id = $1 LIMIT 1',
    [taskId]
  );
  const beforeTask = beforeTaskRes.rows[0] || null;

  try {
    const updatedTask = await db.tx(async (client) => {
      const currentRes = await client.query(
        'SELECT * FROM "Tasks" WHERE id = $1 FOR UPDATE',
        [taskId]
      );
      if (!currentRes.rows.length) {
        const e = new Error("Task not found.");
        e.status = 404;
        throw e;
      }

      const r = await client.query(
        `UPDATE "Tasks" 
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             "assigneeId" = COALESCE($3, "assigneeId"),
             "dueDate" = COALESCE($4, "dueDate"),
             status = COALESCE($5, status),
             weight = COALESCE($6, weight),
             "updatedAt" = NOW()
         WHERE id = $7
         RETURNING *`,
        [
          title?.trim() || null,
          description?.trim() || null,
          assigneeId || null,
          dueDate || null,
          status || null,
          weight || null,
          taskId,
        ]
      );

      const updated = r.rows[0];

      // Audit inside tx with before/after
      try {
        await logAudit({
          userId: req.user.id,
          action: "TASK_UPDATED",
          entity: "Task",
          entityId: taskId,
          before: beforeTask,
          after: updated,
          client,
          req,
        });
      } catch (e) {
        console.error("TASK_UPDATED audit failed (in-tx):", e);
      }

      return updated;
    });

    // Post-commit: notify assignee if present (best-effort)
    if (assigneeId) {
      try {
        await notificationService({
          userId: assigneeId,
          type: "task_assigned",
          message: `You were assigned to task "${updatedTask.title}".`,
          meta: { taskId: updatedTask.id, goalId: updatedTask.goalId || null },
        });
      } catch (nerr) {
        console.error("updateTask: notification failed", nerr);
      }
    }

    res.json({ message: "Task updated successfully.", task: updatedTask });
  } catch (err) {
    console.error("updateTask error:", err);
    if (err && err.status === 404) return res.status(404).json({ message: err.message });
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
};

exports.deleteTask = async (req, res) => {
  const { taskId } = req.params;

  try {
    const deleted = await db.tx(async (client) => {
      const cur = await client.query(
        'SELECT * FROM "Tasks" WHERE id = $1 FOR UPDATE',
        [taskId]
      );
      if (!cur.rows.length) {
        const e = new Error("Task not found.");
        e.status = 404;
        throw e;
      }

      const toDelete = cur.rows[0];

      const r = await client.query(
        'DELETE FROM "Tasks" WHERE id = $1 RETURNING *',
        [taskId]
      );
      const deletedRow = r.rows[0] || null;

      // Audit deletion inside tx
      try {
        await logAudit({
          userId: req.user.id,
          action: "TASK_DELETED",
          entity: "Task",
          entityId: taskId,
          before: toDelete,
          client,
          req,
        });
      } catch (e) {
        console.error("TASK_DELETED audit failed (in-tx):", e);
      }

      return deletedRow;
    });

    res.json({ message: "Task deleted successfully." });
  } catch (err) {
    console.error("deleteTask error:", err);
    if (err && err.status === 404) return res.status(404).json({ message: err.message });
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
};
