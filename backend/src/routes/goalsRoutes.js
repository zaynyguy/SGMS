const express = require("express");
const router = express.Router();
const goalsController = require("../controllers/goalsController");
const tasksRouter = require("./tasksRoutes"); // ⬅️ import tasks router
const {
  authenticateJWT,
  authorizePermissions,
} = require("../middleware/authMiddleware");

router.use(authenticateJWT);

router
  .route("/")
  .get(goalsController.getAllGoals)
  .post(authorizePermissions(["manage_goals"]), goalsController.createGoal);

router
  .route("/:goalId")
  .put(authorizePermissions(["manage_goals"]), goalsController.updateGoal)
  .delete(authorizePermissions(["manage_goals"]), goalsController.deleteGoal);

// Nested tasks under goals
// Example: /api/goals/:goalId/tasks
router.use("/:goalId/tasks", tasksRouter);

module.exports = router;
