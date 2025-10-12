// src/controllers/tasksController.js
const db = require("../db");
const { logAudit } = require("../helpers/audit");
const notificationService = require("../services/notificationService");
const EPS = 1e-9;

exports.getTasksByGoal = async (req, res) => {
  const { goalId } = req.params;
  const isManager = Array.isArray(req.user?.permissions) && req.user.permissions.includes("manage_gta");

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
    // Order by rollNo (if present) then createdAt to give deterministic ordering for UI
    const { rows } = await db.query(
      `SELECT t.*, u.username AS assignee 
       FROM "Tasks" t
       LEFT JOIN "Users" u ON t."assigneeId" = u.id
       WHERE t."goalId" = $1
       ORDER BY COALESCE(t."rollNo", 999999), t."createdAt" DESC`,
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
  const { title, description, assigneeId, dueDate, weight, rollNo } = req.body;

  if (!title) return res.status(400).json({ message: "Title is required." });

  try {
    const task = await db.tx(async (client) => {
      const g = await client.query(
        'SELECT id, weight FROM "Goals" WHERE id=$1 FOR UPDATE',
        [goalId]
      );
      if (!g.rows.length) {
        const err = new Error("Goal not found");
        err.status = 404;
        throw err;
      }

      const goalWeight = parseFloat(g.rows[0].weight) || 100;

      const newWeight =
        weight !== undefined && weight !== null ? parseFloat(String(weight)) : 0;
      if (Number.isNaN(newWeight)) {
        const err = new Error("Task weight must be a number");
        err.status = 400;
        throw err;
      }
      if (newWeight <= 0) {
        const err = new Error("Task weight must be > 0");
        err.status = 400;
        throw err;
      }

      const sumRes = await client.query(
        'SELECT COALESCE(SUM(weight)::numeric,0) AS sum FROM "Tasks" WHERE "goalId"=$1',
        [goalId]
      );
      const sumOther = parseFloat(sumRes.rows[0].sum || 0);

      if (newWeight + sumOther > goalWeight + EPS) {
        const err = new Error(
          `Cannot set task weight to ${newWeight}. Goal total is ${goalWeight} and ${sumOther} is already used.`
        );
        err.status = 400;
        throw err;
      }

      // Optional rollNo handling
      let insertRes;
      if (rollNo !== undefined && rollNo !== null && String(rollNo).trim() !== "") {
        const rn = Number(rollNo);
        if (!Number.isInteger(rn) || rn <= 0) {
          const err = new Error("rollNo must be a positive integer");
          err.status = 400;
          throw err;
        }

        // uniqueness check within same goal
        const dup = await client.query(
          `SELECT id FROM "Tasks" WHERE "goalId" = $1 AND "rollNo" = $2`,
          [goalId, rn]
        );
        if (dup.rows.length) {
          const err = new Error(`rollNo ${rn} is already in use for this goal`);
          err.status = 409;
          throw err;
        }

        insertRes = await client.query(
          `INSERT INTO "Tasks" ("goalId", "rollNo", title, description, "assigneeId", "dueDate", "weight", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7, NOW(), NOW()) RETURNING *`,
          [
            goalId,
            rn,
            title.trim(),
            description?.trim() || null,
            assigneeId || null,
            dueDate || null,
            newWeight,
          ]
        );
      } else {
        // let DB trigger/logic assign rollNo
        insertRes = await client.query(
          `INSERT INTO "Tasks" ("goalId", title, description, "assigneeId", "dueDate", "weight", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6, NOW(), NOW()) RETURNING *`,
          [
            goalId,
            title.trim(),
            description?.trim() || null,
            assigneeId || null,
            dueDate || null,
            newWeight,
          ]
        );
      }

      const newTask = insertRes.rows[0];

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
            rollNo: newTask.rollNo,
          },
          client,
          req,
        });
      } catch (e) {
        console.error("TASK_CREATED audit failed (in-tx):", e);
      }

      return newTask;
    });

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
    if (err && (err.status === 404 || err.status === 409))
      return res.status(err.status).json({ message: err.message });
    if (err && err.status === 400)
      return res.status(400).json({ message: err.message });
    // unique-violation fallback
    if (err && err.code === "23505") {
      return res.status(409).json({ message: "rollNo conflict: that roll number is already in use for this goal." });
    }
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
};

exports.updateTask = async (req, res) => {
  const { taskId } = req.params;
  const { title, description, assigneeId, dueDate, status, weight, rollNo } = req.body;

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

      // rollNo uniqueness check (if provided)
      const current = currentRes.rows[0];
      if (rollNo !== undefined && rollNo !== null && String(rollNo).trim() !== "") {
        const rn = Number(rollNo);
        if (!Number.isInteger(rn) || rn <= 0) {
          const err = new Error("rollNo must be a positive integer");
          err.status = 400;
          throw err;
        }
        const dup = await client.query(
          `SELECT id FROM "Tasks" WHERE "goalId" = $1 AND "rollNo" = $2 AND id <> $3`,
          [current.goalId, rn, taskId]
        );
        if (dup.rows.length) {
          const err = new Error(`rollNo ${rn} is already in use for this goal`);
          err.status = 409;
          throw err;
        }
      }

      let newWeight = weight ?? currentRes.rows[0].weight;
      newWeight = parseFloat(String(newWeight));
      if (Number.isNaN(newWeight)) {
        const err = new Error("Task weight must be a number");
        err.status = 400;
        throw err;
      }
      if (newWeight <= 0) {
        const err = new Error("Task weight must be > 0");
        err.status = 400;
        throw err;
      }

      const goalId = currentRes.rows[0].goalId;
      const gRes = await client.query(
        'SELECT weight FROM "Goals" WHERE id=$1 FOR UPDATE',
        [goalId]
      );
      const goalWeight = parseFloat(gRes.rows[0].weight) || 100;

      const sumRes = await client.query(
        'SELECT COALESCE(SUM(weight)::numeric,0) AS sum FROM "Tasks" WHERE "goalId"=$1 AND id<>$2',
        [goalId, taskId]
      );
      const sumOther = parseFloat(sumRes.rows[0].sum || 0);

      if (newWeight + sumOther > goalWeight + EPS) {
        const err = new Error(
          `Cannot set task weight to ${newWeight}. Goal total is ${goalWeight} and ${sumOther} is already used.`
        );
        err.status = 400;
        throw err;
      }

      const r = await client.query(
        `UPDATE "Tasks" 
         SET "rollNo" = COALESCE($1, "rollNo"),
             title = COALESCE($2, title),
             description = COALESCE($3, description),
             "assigneeId" = COALESCE($4, "assigneeId"),
             "dueDate" = COALESCE($5, "dueDate"),
             status = COALESCE($6, status),
             weight = $7,
             "updatedAt" = NOW()
         WHERE id = $8
         RETURNING *`,
        [
          rollNo !== undefined && rollNo !== null && String(rollNo).trim() !== "" ? Number(rollNo) : null,
          title?.trim() || null,
          description?.trim() || null,
          assigneeId || null,
          dueDate || null,
          status || null,
          newWeight,
          taskId,
        ]
      );

      const updated = r.rows[0];

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
    if (err && (err.status === 404 || err.status === 409)) return res.status(err.status).json({ message: err.message });
    if (err && err.status === 400) return res.status(400).json({ message: err.message });
    if (err && err.code === "23505") {
      return res.status(409).json({ message: "rollNo conflict: that roll number is already in use for this goal." });
    }
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
        const e = new Error("Task not found");
        e.status = 404;
        throw e;
      }

      const toDelete = cur.rows[0];

      const r = await client.query(
        'DELETE FROM "Tasks" WHERE id = $1 RETURNING *',
        [taskId]
      );
      const deletedRow = r.rows[0] || null;

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
