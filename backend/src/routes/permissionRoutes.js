const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const { authenticateJWT, authorizePermissions } = require('../middleware/authMiddleware');

router.use(authenticateJWT, authorizePermissions(['manage_access']));

router.route('/').get(permissionController.getAllPermissions);

module.exports = router;
