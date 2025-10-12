// src/controllers/goalsController.js
const db = require('../db');
const { logAudit } = require('../helpers/audit');
const EPS = 1e-9;

/**
 * Helper: set goals_rollno_seq to at least the current max rollNo.
 * This ensures nextval won't later return an already-used rollNo.
 */
async function bumpGoalsSequence(client) {
  try {
    // determine maximum rollNo currently used
    const mres = await client.query(`SELECT COALESCE(MAX("rollNo"), 0) AS m FROM "Goals"`);
    const maxRoll = parseInt(mres.rows[0].m || 0, 10) || 0;
    // set sequence last_value to maxRoll (nextval will return maxRoll+1)
    await client.query(`SELECT setval('goals_rollno_seq', $1)`, [maxRoll]);
  } catch (e) {
    // don't fail the main tx just for sequence maintenance, but log
    console.error("bumpGoalsSequence failed:", e);
  }
}

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
  const { title, description, groupId, startDate, endDate, weight, rollNo } = req.body;
  if (!title) return res.status(400).json({ message: "Title is required." });

  try {
    const goal = await db.tx(async (client) => {
      // weight validations (existing logic)
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

      // rollNo handling (optional)
      let ins;
      if (rollNo !== undefined && rollNo !== null && String(rollNo).trim() !== "") {
        const rn = Number(rollNo);
        if (!Number.isInteger(rn) || rn <= 0) {
          const err = new Error("rollNo must be a positive integer");
          err.status = 400;
          throw err;
        }

        // check uniqueness
        const dup = await client.query(`SELECT id FROM "Goals" WHERE "rollNo" = $1`, [rn]);
        if (dup.rows.length) {
          const err = new Error(`rollNo ${rn} is already in use`);
          err.status = 409;
          throw err;
        }

        // insert explicit rollNo
        ins = await client.query(
          `INSERT INTO "Goals"("rollNo", title, description, "groupId", "startDate", "endDate", "weight", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7, NOW(), NOW()) RETURNING *`,
          [rn, title.trim(), description?.trim() || null, groupId || null, startDate || null, endDate || null, newWeight]
        );
      } else {
        // let DB assign rollNo (default nextval)
        ins = await client.query(
          `INSERT INTO "Goals"(title, description, "groupId", "startDate", "endDate", "weight", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6, NOW(), NOW()) RETURNING *`,
          [title.trim(), description?.trim() || null, groupId || null, startDate || null, endDate || null, newWeight]
        );
      }

      const newGoal = ins.rows[0];

      // if we inserted a manual rollNo, or even generally, bump sequence to max
      await bumpGoalsSequence(client);

      // audit
      try {
        await logAudit({
          userId: req.user.id,
          action: "GOAL_CREATED",
          entity: "Goal",
          entityId: newGoal.id,
          details: { title: newGoal.title, groupId: newGoal.groupId, rollNo: newGoal.rollNo },
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
    if (err && (err.status === 400 || err.status === 409)) return res.status(err.status).json({ message: err.message });
    // handle unique-violation fallback (in case race condition slipped through)
    if (err && err.code === "23505") {
      return res.status(409).json({ message: "rollNo conflict: that roll number is already in use." });
    }
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
};

exports.updateGoal = async (req, res) => {
  const { goalId } = req.params;
  const { title, description, groupId, startDate, endDate, status, weight, rollNo } = req.body;

  try {
    const updatedGoal = await db.tx(async (client) => {
      const cur = await client.query('SELECT * FROM "Goals" WHERE id=$1 FOR UPDATE', [goalId]);
      if (!cur.rows.length) {
        const e = new Error("Goal not found.");
        e.status = 404;
        throw e;
      }
      const before = cur.rows[0];

      // weight checks (existing)
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

      // rollNo handling: if provided, validate & ensure uniqueness (excluding current)
      let rnParam = null;
      if (rollNo !== undefined && rollNo !== null && String(rollNo).trim() !== "") {
        const rn = Number(rollNo);
        if (!Number.isInteger(rn) || rn <= 0) {
          const err = new Error("rollNo must be a positive integer");
          err.status = 400;
          throw err;
        }
        // check uniqueness excluding this goal
        const dup = await client.query(`SELECT id FROM "Goals" WHERE "rollNo" = $1 AND id <> $2`, [rn, goalId]);
        if (dup.rows.length) {
          const err = new Error(`rollNo ${rn} is already in use`);
          err.status = 409;
          throw err;
        }
        rnParam = rn;
      } else {
        // if rollNo not provided, we will leave it unchanged; use COALESCE in update
        rnParam = null;
      }

      const r = await client.query(
        `UPDATE "Goals" SET
           "rollNo" = COALESCE($1, "rollNo"),
           title = $2,
           description = $3,
           "groupId" = $4,
           "startDate" = $5,
           "endDate" = $6,
           status = COALESCE($7, status),
           "weight" = $8,
           "updatedAt" = NOW()
         WHERE id=$9
         RETURNING *`,
        [rnParam, title?.trim() || null, description?.trim() || null, groupId || null, startDate || null, endDate || null, status || null, newWeight, goalId]
      );
      const updated = r.rows[0];

      // if rollNo changed or set manually, bump sequence
      if (rnParam !== null) {
        await bumpGoalsSequence(client);
      } else {
        // still safe to bump to ensure sequence >= max(rollNo)
        await bumpGoalsSequence(client);
      }

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
    if (err && err.status === 409) return res.status(409).json({ message: err.message });
    // unique-violation fallback
    if (err && err.code === "23505") {
      return res.status(409).json({ message: "rollNo conflict: that roll number is already in use." });
    }
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
};

exports.deleteGoal = async (req, res) => {
  const { goalId } = req.params;
  try {
    const deleted = await db.tx(async (client) => {
      const cur = await client.query('SELECT * FROM "Goals" WHERE id=$1 FOR UPDATE', [goalId]);
      if (!cur.rows.length) {
        const e = new Error("Goal not found");
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

      // bump sequence after deletion to reflect any changes
      await bumpGoalsSequence(client);

      return toDelete;
    });

    res.json({ message: 'Goal deleted successfully.' });
  } catch (err) {
    console.error("deleteGoal error:", err);
    if (err && err.status === 404) return res.status(404).json({ message: err.message });
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
};
