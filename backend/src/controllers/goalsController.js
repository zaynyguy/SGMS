const db = require('../db');

exports.getGoals = async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10), 1), 100);
  const offset = (page - 1) * pageSize;
  const { rows } = await db.query(
    `SELECT g.*, grp.name AS "groupName"
     FROM "Goals" g LEFT JOIN "Groups" grp ON g."groupId"=grp.id
     ORDER BY g."createdAt" DESC
     LIMIT ${pageSize} OFFSET ${offset}`
  );
  res.json({ page, pageSize, rows });
};

exports.createGoal = async (req, res) => {
  const { title, description, groupId, startDate, endDate } = req.body;
  const r = await db.query(
    `INSERT INTO "Goals"(title, description, "groupId", "startDate", "endDate")
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [title.trim(), description?.trim() || null, groupId || null, startDate || null, endDate || null]
  );
  res.status(201).json({ message: 'Goal created successfully.', goal: r.rows[0] });
};

exports.updateGoal = async (req, res) => {
  const { goalId } = req.params;
  const { title, description, groupId, startDate, endDate, status } = req.body;
  const r = await db.query(
    `UPDATE "Goals" SET title=$1, description=$2, "groupId"=$3, "startDate"=$4, "endDate"=$5, status=COALESCE($6,status), "updatedAt"=NOW()
     WHERE id=$7 RETURNING *`,
    [title?.trim() || null, description?.trim() || null, groupId || null, startDate || null, endDate || null, status || null, goalId]
  );
  res.json({ message: 'Goal updated successfully.', goal: r.rows[0] });
};

exports.deleteGoal = async (req, res) => {
  const { goalId } = req.params;
  await db.query('DELETE FROM "Goals" WHERE id=$1', [goalId]);
  res.json({ message: 'Goal deleted successfully.' });
};
