// src/controllers/goalsController.js

const db = require('../db');

exports.getGoals = async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10), 1), 100);
  const offset = (page - 1) * pageSize;

  const isManager = req.user.permissions.includes("manage_gta");

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
};

exports.createGoal = async (req, res) => {
  const { title, description, groupId, startDate, endDate, weight } = req.body;
  const r = await db.query(
    `INSERT INTO "Goals"(title, description, "groupId", "startDate", "endDate", "weight")
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [title.trim(), description?.trim() || null, groupId || null, startDate || null, endDate || null, weight || 100]
  );
  res.status(201).json({ message: 'Goal created successfully.', goal: r.rows[0] });
};

exports.updateGoal = async (req, res) => {
  const { goalId } = req.params;
  const { title, description, groupId, startDate, endDate, status, weight } = req.body;
  const r = await db.query(
    `UPDATE "Goals" SET title=$1, description=$2, "groupId"=$3, "startDate"=$4, "endDate"=$5,
       status=COALESCE($6,status), "weight" = COALESCE($7, "weight"), "updatedAt"=NOW()
     WHERE id=$8 RETURNING *`,
    [title?.trim() || null, description?.trim() || null, groupId || null, startDate || null, endDate || null, status || null, weight || null, goalId]
  );
  res.json({ message: 'Goal updated successfully.', goal: r.rows[0] });
};

exports.deleteGoal = async (req, res) => {
  const { goalId } = req.params;
  await db.query('DELETE FROM "Goals" WHERE id=$1', [goalId]);
  res.json({ message: 'Goal deleted successfully.' });
};
