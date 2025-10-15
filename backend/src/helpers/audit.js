// src/helpers/audit.js
const db = require("../db");

async function logAudit(arg1, arg2, arg3, arg4, arg5) {
  let opts = {};
  if (typeof arg1 === "object" && !arg2) {
    opts = arg1 || {};
  } else {
    opts = {
      userId: arg1,
      action: arg2,
      entity: arg3,
      entityId: arg4,
      details: arg5 || {},
    };
  }

  const {
    userId,
    action,
    entity,
    entityId,
    details = {},
    before = null,
    after = null,
    req = null,
    client = null,
  } = opts || {};

  if (!action) return null; // nothing to log

  const ip =
    (req && (req.headers?.["x-forwarded-for"] || req.ip)) ||
    null;
  const userAgent = req?.headers?.["user-agent"] || null;

  const q = `
    INSERT INTO "AuditLogs"("userId","action","entity","entityId","details","ip","userAgent","before","after","createdAt")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
    RETURNING *;
  `;
  const params = [
    userId || null,
    action,
    entity || null,
    entityId ?? null,
    details || {},
    ip,
    userAgent,
    before || null,
    after || null,
  ];

  try {
    const runner = client && typeof client.query === "function" ? client : db;
    const { rows } = await runner.query(q, params);
    return rows[0] || null;
  } catch (err) {
    console.error("logAudit failed:", err && err.message ? err.message : err);
    return null;
  }
}

module.exports = { logAudit };
