// src/controllers/goalsController.js
const db = require('../db');
const { logAudit } = require('../helpers/audit');
const EPS = 1e-9;

exports.getGoals = async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10), 1), 100);
  const offset = (page - 1) * pageSize;

  try {
    const isManager = Array.isArray(req.user?.permissions) && req.user.permissions.includes("manage_gta");

    if (isManager) {
      const { rows } = await db.query(
        `SELECT g.*, grp.name AS "groupName"
         FROM "Goals" g LEFT JOIN "Groups" grp ON g."groupId"=grp.id
         ORDER BY g."createdAt" DESC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      );
      return res.json({ page, pageSize, rows });
    }

    const { rows } = await db.query(
      `SELECT g.*, grp.name AS "groupName"
       FROM "Goals" g
       JOIN "Groups" grp ON g."groupId" = grp.id
       JOIN "UserGroups" ug ON ug."groupId" = grp.id
       WHERE ug."userId" = $1
       ORDER BY g."createdAt" DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, pageSize, offset]
    );
    res.json({ page, pageSize, rows });
  } catch (err) {
    console.error("getGoals error:", err);
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
};

exports.createGoal = async (req, res) => {
  const { title, description, groupId, startDate, endDate, weight } = req.body;
  if (!title) return res.status(400).json({ message: "Title is required." });

  try {
    const goal = await db.tx(async (client) => {
      const existing = await client.query(`SELECT id, weight FROM "Goals" FOR UPDATE`);

      const sumOther = existing.rows.reduce(
        (acc, r) => acc + (parseFloat(r.weight) || 0),
        0
      );

      const newWeight =
        weight !== undefined && weight !== null
          ? parseFloat(String(weight))
          : 0;

      if (Number.isNaN(newWeight)) {
        const err = new Error("Goal weight must be a number");
        err.status = 400;
        throw err;
      }

      if (newWeight <= 0) {
        const err = new Error("Goal weight must be > 0");
        err.status = 400;
        throw err;
      }

      if (sumOther + newWeight > 100 + EPS) {
        const err = new Error(
          `Cannot set goal weight to ${newWeight}. System total would exceed 100 (currently ${sumOther} used).`
        );
        err.status = 400;
        throw err;
      }

      const r = await client.query(
        `INSERT INTO "Goals"(title, description, "groupId", "startDate", "endDate", "weight", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6, NOW(), NOW()) RETURNING *`,
        [title.trim(), description?.trim() || null, groupId || null, startDate || null, endDate || null, newWeight]
      );
      const newGoal = r.rows[0];

      try {
        await logAudit({
          userId: req.user.id,
          action: "GOAL_CREATED",
          entity: "Goal",
          entityId: newGoal.id,
          details: { title: newGoal.title, groupId: newGoal.groupId },
          client,
          req,
        });
      } catch (e) {
        console.error("GOAL_CREATED audit failed (in-tx):", e);
      }

      return newGoal;
    });

    res.status(201).json({ message: 'Goal created successfully.', goal });
  } catch (err) {
    console.error("createGoal error:", err);
    if (err && err.status === 400) return res.status(400).json({ message: err.message });
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
};

exports.updateGoal = async (req, res) => {
  const { goalId } = req.params;
  const { title, description, groupId, startDate, endDate, status, weight } = req.body;

  try {
    const updatedGoal = await db.tx(async (client) => {
      const cur = await client.query('SELECT * FROM "Goals" WHERE id=$1 FOR UPDATE', [goalId]);
      if (!cur.rows.length) {
        const e = new Error("Goal not found.");
        e.status = 404;
        throw e;
      }
      const before = cur.rows[0];

      const others = await client.query(
        `SELECT id, weight FROM "Goals" WHERE id <> $1 FOR UPDATE`,
        [goalId]
      );

      const sumOther = others.rows.reduce(
        (acc, r) => acc + (parseFloat(r.weight) || 0),
        0
      );

      let newWeight = weight ?? before.weight;
      newWeight = parseFloat(String(newWeight));
      if (Number.isNaN(newWeight)) {
        const err = new Error("Goal weight must be a number");
        err.status = 400;
        throw err;
      }
      if (newWeight <= 0) {
        const err = new Error("Goal weight must be > 0");
        err.status = 400;
        throw err;
      }

      if (sumOther + newWeight > 100 + EPS) {
        const err = new Error(
          `Cannot set goal weight to ${newWeight}. System total would exceed 100 (currently ${sumOther} used by other goals).`
        );
        err.status = 400;
        throw err;
      }

      const r = await client.query(
        `UPDATE "Goals" SET title=$1, description=$2, "groupId"=$3, "startDate"=$4, "endDate"=$5,
           status=COALESCE($6,status), "weight" = $7, "updatedAt"=NOW()
         WHERE id=$8 RETURNING *`,
        [title?.trim() || null, description?.trim() || null, groupId || null, startDate || null, endDate || null, status || null, newWeight, goalId]
      );
      const updated = r.rows[0];

      try {
        await logAudit({
          userId: req.user.id,
          action: "GOAL_UPDATED",
          entity: "Goal",
          entityId: goalId,
          before,
          after: updated,
          client,
          req,
        });
      } catch (e) {
        console.error("GOAL_UPDATED audit failed (in-tx):", e);
      }

      return updated;
    });

    res.json({ message: 'Goal updated successfully.', goal: updatedGoal });
  } catch (err) {
    console.error("updateGoal error:", err);
    if (err && err.status === 404) return res.status(404).json({ message: err.message });
    if (err && err.status === 400) return res.status(400).json({ message: err.message });
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
};

exports.deleteGoal = async (req, res) => {
  const { goalId } = req.params;
  try {
    const deleted = await db.tx(async (client) => {
      const cur = await client.query('SELECT * FROM "Goals" WHERE id=$1 FOR UPDATE', [goalId]);
      if (!cur.rows.length) {
        const e = new Error("Goal not found.");
        e.status = 404;
        throw e;
      }
      const toDelete = cur.rows[0];
      await client.query('DELETE FROM "Goals" WHERE id=$1', [goalId]);

      try {
        await logAudit({
          userId: req.user.id,
          action: "GOAL_DELETED",
          entity: "Goal",
          entityId: goalId,
          before: toDelete,
          client,
          req,
        });
      } catch (e) {
        console.error("GOAL_DELETED audit failed (in-tx):", e);
      }

      return toDelete;
    });

    res.json({ message: 'Goal deleted successfully.' });
  } catch (err) {
    console.error("deleteGoal error:", err);
    if (err && err.status === 404) return res.status(404).json({ message: err.message });
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
};
