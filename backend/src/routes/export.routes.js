const express = require("express");
const router = express.Router();
const exportController = require("../controllers/export.controller");
const { authenticateJWT, authorizePermissions } = require("../middleware/authMiddleware");

router.use(authenticateJWT);

router.get(
  "/goals",
  authorizePermissions(["manage_reports", "view_reports"]),
  exportController.exportGoals,
);
router.get(
  "/tasks",
  authorizePermissions(["manage_reports", "view_reports"]),
  exportController.exportTasks,
);
router.get(
  "/activities",
  authorizePermissions(["manage_reports", "view_reports"]),
  exportController.exportActivities,
);
router.get(
  "/annual-plan",
  authorizePermissions(["manage_reports", "view_reports"]),
  exportController.exportAnnualPlan,
);
router.get(
  "/reports",
  authorizePermissions(["manage_reports", "view_reports"]),
  exportController.exportReports,
);

module.exports = router;
