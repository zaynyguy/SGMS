// src/routes/reportsRoutes.js
const express = require("express");
const router = express.Router();
const reportsController = require("../controllers/reportsController");
const attachmentsController = require("../controllers/attachmentsController");
const {
  authenticateJWT,
  authorizePermissions,
} = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");

router.use(authenticateJWT);

// allows frontend to check if reporting is active
router.get(
  "/reporting-status",
  authorizePermissions(["view_reports"]), 
  reportsController.canSubmitReport
);

router.post(
  "/activity/:activityId",
  upload.array("attachments", 5),
  authorizePermissions(["view_reports"]),
  reportsController.submitReport
);

router.put(
  "/:reportId/review",
  authorizePermissions(["manage_reports"]),
  reportsController.reviewReport
);

// Admin generates the master json report (optional groupId query)
router.get(
  "/master-report",
  authorizePermissions(["manage_reports"]),
  reportsController.generateMasterReport
);

// Fetch all reports (for admin review)
router.get(
  "/",
  authorizePermissions(["manage_reports"]),
  reportsController.getAllReports
);

// Download a specific attachment (checks group scope inside controller)
router.get(
  "/attachments/:attachmentId/download",
  authorizePermissions(["manage_reports", "view_reports", "view_attachments"]),
  attachmentsController.downloadAttachment
);

// Upload attachment
router.post(
  "/attachments/upload",
  upload.single("file"),
  authorizePermissions(["manage_reports"]),
  attachmentsController.uploadAttachment
);

// Delete attachment
router.delete(
  "/attachments/:attachmentId",
  authorizePermissions(["manage_reports", "manage_attachments"]),
  attachmentsController.deleteAttachment
);

// Admin list attachments
router.get(
  "/attachments",
  authorizePermissions(["manage_attachments", "manage_reports"]),
  attachmentsController.listAttachments
);

module.exports = router;
