// src/routes/settingsRoutes.js

const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');  // ✅ fix here

router.get('/', authenticateJWT, settingsController.getSettings);
router.put('/', authenticateJWT, settingsController.updateSettings);

// New route for profile picture
router.put(
  '/profile-picture',
  authenticateJWT,
  upload.single("profilePicture"),
  settingsController.updateProfilePicture
);

module.exports = router;
