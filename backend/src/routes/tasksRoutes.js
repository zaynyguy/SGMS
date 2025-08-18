const express = require("express");
const router = express.Router({ mergeParams: true }); // get goalId from parent
const tasksController = require("../controllers/tasksController");
const activitiesRouter = require("./activitiesRoutes");
const {
  authenticateJWT,
  authorizePermissions,
} = require("../middleware/authMiddleware");

router.use(authenticateJWT);

router.get("/", tasksController.getTasksByGoal);

router.post(
  "/",
  authorizePermissions(["manage_tasks"]),
  tasksController.createTask
);

router.put(
  "/:taskId",
  authorizePermissions(["manage_tasks"]),
  tasksController.updateTask
);
router.delete(
  "/:taskId",
  authorizePermissions(["manage_tasks"]),
  tasksController.deleteTask
);

// Nested activities under tasks
// Example: /api/goals/:goalId/tasks/:taskId/activities
router.use("/:taskId/activities", activitiesRouter);

module.exports = router;
