const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notificationsController');
const { authenticateJWT, authorizePermissions } = require('../middleware/authMiddleware');

router.use(authenticateJWT);

router.get('/', notificationsController.listNotifications);
router.get('/unread-count', notificationsController.unreadCount);
router.put('/:id/read', notificationsController.markRead);
router.put('/read-all', notificationsController.markAllRead);
router.post('/', authorizePermissions(['manage_notifications']), notificationsController.createNotification);

module.exports = router;