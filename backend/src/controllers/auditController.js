const db = require("../db");

exports.getAuditLogs = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT al.*, u.name as user_name
       FROM "AuditLogs" al
       LEFT JOIN "Users" u ON al."userId" = u.id
       ORDER BY al."createdAt" DESC
       LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
