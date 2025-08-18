const express = require('express');
const router = express.Router({ mergeParams: true }); 
const activitiesController = require('../controllers/activitiesController');
const { authenticateJWT, authorizePermissions } = require('../middleware/authMiddleware');

// Protect all activity routes
router.use(authenticateJWT);

// GET all activities for a task
router.get('/', activitiesController.getActivitiesByTask);

// CREATE activity for a task
router.post('/', authorizePermissions(['manage_activities']), activitiesController.createActivity);

// UPDATE / DELETE activity by ID
router.put('/:activityId', authorizePermissions(['manage_activities']), activitiesController.updateActivity);
router.delete('/:activityId', authorizePermissions(['manage_activities']), activitiesController.deleteActivity);

module.exports = router;
