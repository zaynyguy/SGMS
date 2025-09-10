// src/controllers/activitiesController.js
const db = require("../db");

exports.getActivitiesByTask = async (req, res) => {
  const { taskId } = req.params;
  const isManager = req.user.permissions.includes("manage_gta");

  if (isManager) {
    const q = `
      SELECT a.*, t."goalId", gl."groupId", g.name AS "groupName"
      FROM "Activities" a
      JOIN "Tasks" t ON a."taskId"=t.id
      JOIN "Goals" gl ON t."goalId"=gl.id
      JOIN "Groups" g ON gl."groupId"=g.id
      WHERE a."taskId"=$1
      ORDER BY a."createdAt" DESC`;
    const { rows } = await db.query(q, [taskId]);
    return res.json(rows);
  }

  const q = `
    SELECT a.*, t."goalId", gl."groupId", g.name AS "groupName"
    FROM "Activities" a
    JOIN "Tasks" t ON a."taskId"=t.id
    JOIN "Goals" gl ON t."goalId"=gl.id
    JOIN "Groups" g ON gl."groupId"=g.id
    JOIN "UserGroups" ug ON ug."groupId" = g.id
    WHERE a."taskId" = $1 AND ug."userId" = $2
    ORDER BY a."createdAt" DESC
  `;
  const { rows } = await db.query(q, [taskId, req.user.id]);
  res.json(rows);
};

exports.createActivity = async (req, res) => {
  const { taskId } = req.params;
  const { title, description, dueDate, weight, targetMetric } = req.body;
  if (!title) return res.status(400).json({ message: "Title is required." });

  await db.tx(async (client) => {
    const t = await client.query('SELECT id FROM "Tasks" WHERE id=$1', [
      taskId,
    ]);
    if (!t.rows.length) {
      const err = new Error("Task not found");
      err.status = 404;
      throw err;
    }
    const r = await client.query(
      `INSERT INTO "Activities" ("taskId", title, description, "dueDate", "weight", "targetMetric")
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        taskId,
        title.trim(),
        description?.trim() || null,
        dueDate || null,
        weight || 0,
        targetMetric || {},
      ]
    );
    res
      .status(201)
      .json({ message: "Activity created successfully.", activity: r.rows[0] });
  });
};

exports.updateActivity = async (req, res) => {
  const { activityId } = req.params;
  const { title, description, status, dueDate, weight, targetMetric, isDone } =
    req.body; 
  await db.tx(async (client) => {
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
       SET title=$1, description=$2, status=COALESCE($3,status), "dueDate"=$4, "weight"=COALESCE($5,"weight"),
           "targetMetric"=COALESCE($6,"targetMetric"), "isDone"=COALESCE($7,"isDone"), "updatedAt"=NOW()
       WHERE id=$8 RETURNING *`,
      [
        title?.trim() || null,
        description?.trim() || null,
        status || null,
        dueDate || null,
        weight || null,
        targetMetric || null,
        isDone !== undefined ? isDone : null,
        activityId,
      ]
    );

    res.json({
      message: "Activity updated successfully.",
      activity: r.rows[0],
    });
  });
};

exports.deleteActivity = async (req, res) => {
  const { activityId } = req.params;

  await db.tx(async (client) => {
    const a = await client.query('SELECT id FROM "Activities" WHERE id=$1', [
      activityId,
    ]);
    if (!a.rows.length) {
      const e = new Error("Activity not found");
      e.status = 404;
      throw e;
    }

    await client.query('DELETE FROM "Activities" WHERE id=$1', [activityId]);

    res.json({ message: "Activity deleted successfully." });
  });
};
