const express = require('express');
const router = express.Router();
const goalsController = require('../controllers/goalsController');
const tasksRouter = require('./taskRoutes');   // ⬅️ import tasks router
const { authenticateJWT, authorizePermissions } = require('../middleware/authMiddleware');

// Protect all goal routes
router.use(authenticateJWT);

// GET all goals / CREATE goal
router.route('/')
  .get(goalsController.getAllGoals)
  .post(authorizePermissions(['manage_goals']), goalsController.createGoal);

// UPDATE / DELETE a goal by ID
router.route('/:goalId')
  .put(authorizePermissions(['manage_goals']), goalsController.updateGoal)
  .delete(authorizePermissions(['manage_goals']), goalsController.deleteGoal);

// Nested tasks under goals
// Example: /api/goals/:goalId/tasks
router.use('/:goalId/tasks', tasksRouter);

module.exports = router;
