const express = require('express');
const router = express.Router();
const goalsController = require('../controllers/goalsController');
const tasksRouter = require('./tasksRoutes');
const { authenticateJWT, authorizePermissions } = require('../middleware/authMiddleware');

router.use(authenticateJWT);
router.get('/', goalsController.getGoals);
router.post('/', authorizePermissions(['manage_goals']), goalsController.createGoal);
router.put('/:goalId', authorizePermissions(['manage_goals']), goalsController.updateGoal);
router.delete('/:goalId', authorizePermissions(['manage_goals']), goalsController.deleteGoal);

router.use('/:goalId/tasks', tasksRouter);
module.exports = router;
