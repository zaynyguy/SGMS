// src/controllers/notificationsController.js
const db = require('../db');
const notificationService = require('../services/notificationService');



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

async function _internalCreateNotificationPayload(payload) {
  const { userId, type, message, meta = {}, level = 'info' } = payload || {};
  if (!userId || !type || !message) {
    const err = new Error('userId, type and message are required');
    err.status = 400;
    throw err;
  }
  // Pass a single object
  const notification = await notificationService({ userId, type, message, meta, level });
  return notification;
}

exports.createNotification = async function createNotification(req, res) {
  try {
    const userId = req.body.userId || req.user?.id; // fallback to authenticated user
    const { type, message, meta, level } = req.body || {};

    if (!userId || !type || !message) {
      return res.status(400).json({ message: 'userId, type and message are required.' });
    }

    const notification = await notificationService({ userId, type, message, meta, level });

    if (req.io?.to) {
      try {
        req.io.to(`user:${notification.userId}`).emit('notification:new', notification);
      } catch (e) {
        console.error('emit failed', e);
      }
    }

    return res.status(201).json({ message: 'Notification created.', notification });
  } catch (err) {
    console.error('createNotification failed:', err);
    return res.status(err.status || 500).json({ message: err.message || 'Failed to create notification.' });
  }
};
