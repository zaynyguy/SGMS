const express = require("express");
const router = express.Router({ mergeParams: true });
const tasksController = require("../controllers/tasksController");
const activitiesRouter = require("./activitiesRoutes");
const {
  authenticateJWT,
  authorizePermissions,
} = require("../middleware/authMiddleware");

router.use(authenticateJWT);

// List tasks under a goal — require view_gta OR manage_gta
router.get(
  "/",
  authorizePermissions(["manage_gta", "view_gta"]),
  tasksController.getTasksByGoal
);

// Mutations
router.post(
  "/",
  authorizePermissions(["manage_gta"]),
  tasksController.createTask
);
router.put(
  "/:taskId",
  authorizePermissions(["manage_gta"]),
  tasksController.updateTask
);
router.delete(
  "/:taskId",
  authorizePermissions(["manage_gta"]),
  tasksController.deleteTask
);

router.use("/:taskId/activities", activitiesRouter);
module.exports = router;
