const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateJWT } = require('../middleware/authMiddleware');

router.get('/', authenticateJWT, settingsController.getSettings);
router.put('/', authenticateJWT, settingsController.updateSettings);

module.exports = router;
