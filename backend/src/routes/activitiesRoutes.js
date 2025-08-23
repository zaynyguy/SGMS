const express = require('express');
const router = express.Router({ mergeParams: true });
const activitiesController = require('../controllers/activitiesController');
const { authenticateJWT, authorizePermissions } = require('../middleware/authMiddleware');

router.use(authenticateJWT);
router.get('/', activitiesController.getActivitiesByTask);
router.post('/', authorizePermissions(['manage_activities']), activitiesController.createActivity);
router.put('/:activityId', authorizePermissions(['manage_activities']), activitiesController.updateActivity);
router.delete('/:activityId', authorizePermissions(['manage_activities']), activitiesController.deleteActivity);

module.exports = router;
