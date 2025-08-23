const express = require('express');
const router = express.Router({ mergeParams: true });
const tasksController = require('../controllers/tasksController');
const activitiesRouter = require('./activitiesRoutes');
const { authenticateJWT, authorizePermissions } = require('../middleware/authMiddleware');

router.use(authenticateJWT);
router.get('/', tasksController.getTasksByGoal);
router.post('/', authorizePermissions(['manage_tasks']), tasksController.createTask);
router.put('/:taskId', authorizePermissions(['manage_tasks']), tasksController.updateTask);
router.delete('/:taskId', authorizePermissions(['manage_tasks']), tasksController.deleteTask);

router.use('/:taskId/activities', activitiesRouter);
module.exports = router;
