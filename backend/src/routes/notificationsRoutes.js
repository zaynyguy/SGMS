const express = require("express");
const router = express.Router();
const { authenticateJWT } = require("../middleware/authMiddleware");
const notificationsController = require("../controllers/notificationsController");

router.use(authenticateJWT);

router.get("/", notificationsController.getUserNotifications);
router.put("/:notificationId/read", notificationsController.markAsRead);

module.exports = router;
