const db = require("../db");

exports.getNotifications = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM "Notifications" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await db.query(`UPDATE "Notifications" SET "isRead" = true WHERE id = $1 AND "userId" = $2`,
      [req.params.id, req.user.id]);
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createNotification = async (userId, type, message) => {
  try {
    await db.query(
      `INSERT INTO "Notifications"("userId",type,message) VALUES ($1,$2,$3)`,
      [userId, type, message]
    );
  } catch (err) {
    console.error("Notification insert failed:", err.message);
  }
};
