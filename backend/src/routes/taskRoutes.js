const express = require('express');
const router = express.Router({ mergeParams: true }); // get goalId from parent
const tasksController = require('../controllers/tasksController');
const activitiesRouter = require('./activityRoutes'); 
const { authenticateJWT, authorizePermissions } = require('../middleware/authMiddleware');

// Protect all task routes
router.use(authenticateJWT);

// GET all tasks for a goal
router.get('/', tasksController.getTasksByGoal);

// CREATE a task for a goal
router.post('/', authorizePermissions(['manage_tasks']), tasksController.createTask);

// UPDATE / DELETE a task by ID
router.put('/:taskId', authorizePermissions(['manage_tasks']), tasksController.updateTask);
router.delete('/:taskId', authorizePermissions(['manage_tasks']), tasksController.deleteTask);

// Nested activities under tasks
// Example: /api/goals/:goalId/tasks/:taskId/activities
router.use('/:taskId/activities', activitiesRouter);

module.exports = router;
