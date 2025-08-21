const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { authorizePermissions, authenticateJWT } = require('../middleware/authMiddleware');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

router.post('/:activityId', authenticateJWT, upload.array('attachments'), reportsController.submitReport);
router.put('/:reportId/review', authenticateJWT, authorizePermissions(['manage_reports']), reportsController.reviewReport);

module.exports = router;
