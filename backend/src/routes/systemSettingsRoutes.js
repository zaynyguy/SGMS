const express = require('express');
const router = express.Router();
const systemSettingsController = require('../controllers/systemSettingsController');
const { authenticateJWT, authorizePermissions } = require('../middleware/authMiddleware');

router.get('/', authenticateJWT, authorizePermissions(['manage_settings']), systemSettingsController.getAllSettings);
router.put('/', authenticateJWT, authorizePermissions(['manage_settings']), systemSettingsController.updateSettings);

module.exports = router;