const express = require('express');
const router = express.Router({ mergeParams: true });
const tasksController = require('../controllers/tasksController');
const { authenticateJWT, authorizePermissions } = require('../middleware/authMiddleware');

// Protect all task routes with JWT
router.use(authenticateJWT);

// GET all tasks for a goal
router.get('/', tasksController.getTasksByGoal);

// CREATE a task (requires permission)
router.post('/', authorizePermissions(['manage_tasks']), tasksController.createTask);

// UPDATE / DELETE a task by ID (requires permission)
router.put('/:taskId', authorizePermissions(['manage_tasks']), tasksController.updateTask);
router.delete('/:taskId', authorizePermissions(['manage_tasks']), tasksController.deleteTask);

module.exports = router;
