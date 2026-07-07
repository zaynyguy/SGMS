const express = require("express");
const router = express.Router();
const bulkImportController = require("../controllers/bulkImport.controller");
const { authenticateJWT, authorizePermissions } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");

router.use(authenticateJWT);

router.post(
  "/upload",
  upload.excelImport(),
  authorizePermissions(["manage_gta", "manage_reports"]),
  bulkImportController.uploadImportFile,
);

router.post(
  "/preview",
  upload.excelImport(),
  authorizePermissions(["manage_gta", "manage_reports"]),
  bulkImportController.previewImport,
);

router.post(
  "/execute",
  upload.excelImport(),
  authorizePermissions(["manage_gta", "manage_reports"]),
  bulkImportController.executeImport,
);

router.get(
  "/history",
  authorizePermissions(["manage_gta"]),
  bulkImportController.getImportHistory,
);

router.get(
  "/history/:id",
  authorizePermissions(["manage_gta"]),
  bulkImportController.getImportHistoryById,
);

router.get(
  "/template",
  authorizePermissions(["manage_gta", "manage_reports"]),
  bulkImportController.downloadTemplate,
);

router.post(
  "/errors/export",
  authorizePermissions(["manage_gta", "manage_reports"]),
  bulkImportController.downloadErrorReport,
);

module.exports = router;
