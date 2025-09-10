// src/routes/activitiesRoutes.js

const express = require("express");
const router = express.Router({ mergeParams: true });
const activitiesController = require("../controllers/activitiesController");
const {
  authenticateJWT,
  authorizePermissions,
} = require("../middleware/authMiddleware");

router.use(authenticateJWT);

// List activities under a task — require view_gta OR manage_gta
router.get(
  "/",
  authorizePermissions(["manage_gta", "view_gta"]),
  activitiesController.getActivitiesByTask
);

// Mutations need manage_gta
router.post(
  "/",
  authorizePermissions(["manage_gta"]),
  activitiesController.createActivity
);
router.put(
  "/:activityId",
  authorizePermissions(["manage_gta"]),
  activitiesController.updateActivity
);
router.delete(
  "/:activityId",
  authorizePermissions(["manage_gta"]),
  activitiesController.deleteActivity
);

module.exports = router;
