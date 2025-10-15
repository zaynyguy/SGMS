// src/services/notificationService.js
const db = require("../db");
const { emitToUser } = require("./socketService");

/**
 * Create a notification row and emit to socket room (user_<id>).
 * Accepts: { userId, type, message, meta = {}, level = "info" }
 * Returns the created DB row.
 */
module.exports = async ({ userId, type, message, meta = {}, level = "info" }) => {
  if (!userId || !type || !message) {
    const err = new Error("Missing required fields");
    err.status = 400;
    throw err;
  }

  try {
    // Ensure meta is JSON (stringify so Postgres JSONB gets valid JSON)
    const metaValue = (meta && typeof meta === "object") ? JSON.stringify(meta) : meta;

    const q = `INSERT INTO "Notifications"("userId","type","message","meta","level")
               VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING *`;
    const { rows } = await db.query(q, [userId, type, message, metaValue, level]);
    const created = rows[0];

    // Emit to socket room; do not throw on emit failure
    try {
      emitToUser(userId, "notification:new", created);
    } catch (emitErr) {
      console.error("notify emit failed:", emitErr);
    }

    return created;
  } catch (err) {
    console.error("notificationService failed:", err);
    throw err;
  }
};
