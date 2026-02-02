// src/routes/recordsRoutes.js
// Top-level routes for ActivityRecords aggregation and global operations

const express = require("express");
const router = express.Router();
const activitiesController = require("../controllers/activitiesController");
const {
    authenticateJWT,
    authorizePermissions,
} = require("../middleware/authMiddleware");

router.use(authenticateJWT);

// Get aggregated records for master report display
// Supports query params: groupId, fiscalYear, granularity (quarterly/monthly)
router.get(
    "/aggregated",
    authorizePermissions(["manage_gta", "view_gta", "manage_reports", "view_reports"]),
    activitiesController.getAggregatedRecords
);

module.exports = router;
