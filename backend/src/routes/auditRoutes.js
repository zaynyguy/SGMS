const express = require("express");
const router = express.Router();
const { authenticateJWT, authorizePermissions } = require("../middleware/authMiddleware");
const auditController = require("../controllers/auditController");

router.use(authenticateJWT);

router.get(
  "/",
  authorizePermissions(["view_audit_logs"]),
  auditController.getAuditLogs
);

module.exports = router;
