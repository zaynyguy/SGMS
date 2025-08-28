const express = require("express");
const router = express.Router();
const reportsController = require("../controllers/reportsController");
const {
  authenticateJWT,
  authorizePermissions,
} = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

router.use(authenticateJWT);

router.post(
  "/activity/:activityId",
  upload.array("attachments", 5),
  reportsController.submitReport
);
router.put(
  "/:reportId/review",
  authorizePermissions(["manage_reports"]),
  reportsController.reviewReport
);
router.get(
  "/master-report",
  authorizePermissions(["manage_reports"]),
  reportsController.generateMasterReport
);
router.get(
  "/",
  authorizePermissions(["manage_reports"]),
  reportsController.getAllReports
);
router.get(
  "/attachments/:attachmentId/download",
  authorizePermissions(["view_reports", "manage_reports"]),
  reportsController.downloadAttachment
);

module.exports = router;
