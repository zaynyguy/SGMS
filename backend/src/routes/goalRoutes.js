const express = require('express');
const router = express.Router();
const goalsController = require('../controllers/goalsController');
const { authenticateJWT, authorizePermissions } = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// GET all goals (any authenticated user) / CREATE goal (only manage_goals permission)
router.route('/')
  .get(goalsController.getAllGoals)
  .post(authorizePermissions(['manage_goals']), goalsController.createGoal);

// UPDATE / DELETE a goal by ID (only manage_goals permission)
router.route('/:id')
  .put(authorizePermissions(['manage_goals']), goalsController.updateGoal)
  .delete(authorizePermissions(['manage_goals']), goalsController.deleteGoal);

module.exports = router;
