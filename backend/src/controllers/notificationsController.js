const db = require("../db");


//   Create a new notification for a user

exports.createNotification = async (userId, type, message) => {
  try {
    await db.query(
      `INSERT INTO "Notifications"("userId", "type", "message") VALUES ($1, $2, $3)`,
      [userId, type, message]
    );
  } catch (err) {
    console.error("Error creating notification:", err.message);
    throw err;
  }
};


//  Get notifications for the logged-in user

exports.getUserNotifications = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT "id", "userId", "type", "message", "isRead", "createdAt"
       FROM "Notifications"
       WHERE "userId" = $1
       ORDER BY "createdAt" DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching notifications:", err.message);
    res.status(500).json({ error: err.message });
  }
};


//  Mark a notification as read
 
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { rows } = await db.query(
      `UPDATE "Notifications"
       SET "isRead" = true
       WHERE "id" = $1 AND "userId" = $2
       RETURNING "id", "userId", "type", "message", "isRead", "createdAt"`,
      [notificationId, req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error marking notification as read:", err.message);
    res.status(500).json({ error: err.message });
  }
};
