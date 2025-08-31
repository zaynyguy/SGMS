// src/controllers/notificationsController.js
const db = require('../db');


exports.listNotifications = async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10), 1), 200);
  const offset = (page - 1) * pageSize;
  try {
    const { rows } = await db.query(
      `SELECT id, "userId", type, message, meta, "level", "isRead", "createdAt"
       FROM "Notifications"
       WHERE "userId" = $1
       ORDER BY "createdAt" DESC
       LIMIT $2 OFFSET $3`,
      [userId, pageSize, offset]
    );
    res.json({ page, pageSize, rows });
  } catch (err) {
    console.error('notifications.list error', err);
    res.status(500).json({ error: err.message });
  }
};

exports.unreadCount = async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await db.query(`SELECT COUNT(*)::int AS cnt FROM "Notifications" WHERE "userId"=$1 AND "isRead"=false`, [userId]);
    res.json({ unread: rows[0].cnt });
  } catch (err) {
    console.error('notifications.unreadCount error', err);
    res.status(500).json({ error: err.message });
  }
};

exports.markRead = async (req, res) => {
  const userId = req.user.id;
  const id = Number(req.params.id);
  try {
    await db.query(`UPDATE "Notifications" SET "isRead"=true WHERE id=$1 AND "userId"=$2`, [id, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('notifications.markRead error', err);
    res.status(500).json({ error: err.message });
  }
};

exports.markAllRead = async (req, res) => {
  const userId = req.user.id;
  try {
    await db.query(`UPDATE "Notifications" SET "isRead"=true WHERE "userId"=$1`, [userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('notifications.markAllRead error', err);
    res.status(500).json({ error: err.message });
  }
};

exports.createNotification = async (req, res) => {
  const { userId, type, message, meta, level } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO "Notifications"("userId", type, message, meta, "level", "isRead", "createdAt")
       VALUES ($1,$2,$3,$4,$5,false,now()) RETURNING *`,
      [userId, type || 'generic', message, meta || {}, level || 'info']
    );
    // Hook for SMS later: if level === 'critical' push to queue.
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('notifications.create error', err);
    res.status(500).json({ error: err.message });
  }
};
