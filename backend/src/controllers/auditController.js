// src/controllers/auditController.js
const db = require('../db');

exports.list = async (req, res) => {
  try {
    const { entity, action, userId } = req.query;
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;

    // Server-side pagination: default 100, max 100
    const requestedLimit = Number(req.query.limit || 100);
    const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 100;
    const requestedOffset = Number(req.query.offset || 0);
    const offset = Number.isFinite(requestedOffset) ? Math.max(0, requestedOffset) : 0;

    let idx = 1;
    const clauses = [];
    const params = [];

    if (entity) {
      clauses.push(`al.entity = $${idx++}`);
      params.push(entity);
    }
    if (action) {
      clauses.push(`al.action = $${idx++}`);
      params.push(action);
    }
    if (userId) {
      clauses.push(`al."userId" = $${idx++}`);
      params.push(Number(userId));
    }
    if (from) {
      clauses.push(`al."createdAt" >= $${idx++}`);
      params.push(from);
    }
    if (to) {
      clauses.push(`al."createdAt" <= $${idx++}`);
      params.push(to);
    }

    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';

    // 1) total count (fast - no JOIN)
    const countQuery = `SELECT COUNT(*)::int AS total FROM "AuditLogs" al ${where};`;
    const { rows: countRows } = await db.query(countQuery, params);
    const total = (countRows && countRows[0] && countRows[0].total) || 0;

    // 2) actual page rows (join to bring user info)
    // add limit & offset as final params
    const q = `
      SELECT al.*, u.username, u.name
      FROM "AuditLogs" al
      LEFT JOIN "Users" u ON u.id = al."userId"
      ${where}
      ORDER BY al."createdAt" DESC
      LIMIT $${idx++}
      OFFSET $${idx++};
    `;
    const finalParams = params.slice();
    finalParams.push(limit);
    finalParams.push(offset);

    const { rows } = await db.query(q, finalParams);

    // Return both rows and total so client can paginate
    res.json({ rows, total });
  } catch (err) {
    console.error('audit.list error', err);
    res.status(500).json({ error: err.message });
  }
};
