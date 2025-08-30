// src/controllers/auditController.js
const db = require('../db');

exports.list = async (req, res) => {
  const { entity, action, userId } = req.query;
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;
  const limit = Math.min(1000, Math.max(1, Number(req.query.limit || 200)));
  let idx = 1;
  const clauses = [];
  const params = [];
  if (entity) { clauses.push(`al.entity = $${idx++}`); params.push(entity); }
  if (action) { clauses.push(`al.action = $${idx++}`); params.push(action); }
  if (userId) { clauses.push(`al."userId" = $${idx++}`); params.push(Number(userId)); }
  if (from) { clauses.push(`al."createdAt" >= $${idx++}`); params.push(from); }
  if (to) { clauses.push(`al."createdAt" <= $${idx++}`); params.push(to); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const q = `
    SELECT al.*, u.username, u.name
    FROM "AuditLogs" al
    LEFT JOIN "Users" u ON u.id = al."userId"
    ${where}
    ORDER BY al."createdAt" DESC
    LIMIT $${idx}
  `;
  params.push(limit);
  try {
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) {
    console.error('audit.list error', err);
    res.status(500).json({ error: err.message });
  }
};
