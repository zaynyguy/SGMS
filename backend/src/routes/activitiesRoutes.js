const express = require("express");
const router = express.Router({ mergeParams: true });
const activitiesController = require("../controllers/activitiesController");
const { authenticateJWT, authorizePermissions } = require("../middleware/authMiddleware");

router.use(authenticateJWT);

// Get activities for a task
router.get("/", activitiesController.getActivitiesByTask);

// Create activity
router.post(
  "/",
  authorizePermissions(["manage_activities"]),
  activitiesController.createActivity
);

// Update activity
router.put(
  "/:activityId",
  authorizePermissions(["manage_activities"]),
  activitiesController.updateActivity
);

// Delete activity
router.delete(
  "/:activityId",
  authorizePermissions(["manage_activities"]),
  activitiesController.deleteActivity
);

module.exports = router;
