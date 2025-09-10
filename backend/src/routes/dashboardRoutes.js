// src/routes/dashboardRoutes.js

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateJWT } = require('../middleware/authMiddleware');

router.use(authenticateJWT);

// single endpoint; controller chooses admin vs user view via permissions
router.get('/summary', dashboardController.getSummary);
router.get('/charts', dashboardController.getCharts);
router.get('/overdue', dashboardController.getOverdueTasks);

module.exports = router;
