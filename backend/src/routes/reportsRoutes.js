const express = require("express");
const router = express.Router();
const reportsController = require("../controllers/reportsController");
const {
  authenticateJWT,
  authorizePermissions,
} = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

router.use(authenticateJWT);

// User submits a report for an activity (with attachments)
router.post(
  "/activity/:activityId",
  upload.array("attachments", 5),
  reportsController.submitReport
);

// Admin reviews a report
router.put(
  "/:reportId/review",
  authorizePermissions(["manage_reports"]),
  reportsController.reviewReport
);

// Admin generates the master HTML report
router.get(
  "/master-report",
  authorizePermissions(["manage_reports"]),
  reportsController.generateMasterReport
);

// Fetch all reports (for the admin's review page)
router.get(
  "/",
  authorizePermissions(["manage_reports"]),
  reportsController.getAllReports
);

// Download a specific attachment
router.get(
  "/attachments/:attachmentId/download",
  authorizePermissions(["view_reports"]),
  reportsController.downloadAttachment
);

module.exports = router;
