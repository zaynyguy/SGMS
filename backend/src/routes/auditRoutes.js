// src/routes/auditRoutes.js

const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticateJWT, authorizePermissions } = require('../middleware/authMiddleware');

router.use(authenticateJWT);
router.get('/', authorizePermissions(['view_audit_logs']), auditController.list);
module.exports = router;