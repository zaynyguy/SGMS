const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { authenticateJWT } = require("../middleware/authMiddleware");

router.use(authenticateJWT);

router.get("/summary", dashboardController.getSummary);
router.get("/charts", dashboardController.getCharts);
router.get("/overdue", dashboardController.getOverdueTasks);
router.get("/notifications", dashboardController.getNotifications);
router.get("/audit", dashboardController.getAudit);

module.exports = router;
