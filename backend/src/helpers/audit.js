const db = require("../db");

async function logAudit(userId, action, entity, entityId, details = {}) {
  try {
    await db.query(
      `INSERT INTO "AuditLogs"("userId","action","entity","entityId","details")
       VALUES ($1,$2,$3,$4,$5)`,
      [userId, action, entity, entityId, details]
    );
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
}

module.exports = { logAudit };
