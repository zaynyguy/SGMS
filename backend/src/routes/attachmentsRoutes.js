const express = require("express");
const router = express.Router();
const attachmentsController = require("../controllers/attachmentsController");
const {
  authenticateJWT,
  authorizePermissions,
} = require("../middleware/authMiddleware");

router.use(authenticateJWT);

router.get(
  "/",
  authorizePermissions(["manage_attachments"]),
  attachmentsController.getAllAttachments
);

router.get(
  "/group/:groupId",
  authorizePermissions(["view_groups", "manage_groups", "manage_attachments"]),
  attachmentsController.getGroupAttachments
);

router.get(
  "/report/:reportId",
  authorizePermissions([
    "view_reports",
    "manage_reports",
    "manage_attachments",
  ]),
  attachmentsController.getReportAttachments
);

router.get(
  "/:id/download",
  authorizePermissions([
    "view_reports",
    "manage_reports",
    "manage_attachments",
  ]),
  attachmentsController.downloadAttachment
);

module.exports = router;
