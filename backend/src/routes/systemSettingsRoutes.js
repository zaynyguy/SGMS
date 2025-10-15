// src/routes/systemSettingsRoutes.js

const express = require("express");
const router = express.Router();
const systemSettingsController = require("../controllers/systemSettingsController");
const {
  authenticateJWT,
  authorizePermissions,
} = require("../middleware/authMiddleware");

router.use(authenticateJWT);

router.get("/", systemSettingsController.getAllSettings);
router.put(
  "/",
  authorizePermissions(["manage_settings"]),
  systemSettingsController.updateSettings
);

module.exports = router;
