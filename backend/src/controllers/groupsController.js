const db = require('../db');

exports.getAllGroups = async (req, res) => {
  const { rows } = await db.query('SELECT * FROM "Groups" ORDER BY "createdAt" DESC');
  res.json(rows);
};

exports.createGroup = async (req, res) => {
  const { name, description } = req.body;
  const r = await db.query(
    `INSERT INTO "Groups"(name, description) VALUES ($1,$2) RETURNING *`,
    [name.trim(), description?.trim() || null]
  );
  res.status(201).json({ message: 'Group created successfully.', group: r.rows[0] });
};

exports.updateGroup = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const c = await db.query('SELECT id FROM "Groups" WHERE id=$1', [id]);
  if (!c.rows.length) return res.status(404).json({ message: 'Group not found.' });
  const r = await db.query(
    `UPDATE "Groups" SET name=$1, description=$2, "updatedAt"=NOW() WHERE id=$3 RETURNING *`,
    [name.trim(), description?.trim() || null, id]
  );
  res.json({ message: 'Group updated successfully.', group: r.rows[0] });
};

exports.deleteGroup = async (req, res) => {
  const { id } = req.params;
  const c = await db.query('SELECT id FROM "Groups" WHERE id=$1', [id]);
  if (!c.rows.length) return res.status(404).json({ message: 'Group not found.' });
  await db.query('DELETE FROM "Groups" WHERE id=$1', [id]);
  res.json({ message: 'Group deleted successfully.' });
};
