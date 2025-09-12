const db = require("../db");
const { emitToUser } = require("./socketService");

module.exports = async ({ userId, type, message, meta = {}, level = "info" }) => {
  if (!userId || !type || !message) throw new Error("Missing required fields");

  const q = `INSERT INTO "Notifications"("userId","type","message","meta","level")
             VALUES ($1,$2,$3,$4,$5) RETURNING *`;
  const { rows } = await db.query(q, [userId, type, message, meta, level]);

  emitToUser(userId, "notification:new", rows[0]);
  return rows[0];
};
