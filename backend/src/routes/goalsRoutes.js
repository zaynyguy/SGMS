const express = require("express");
const router = express.Router();
const goalsController = require("../controllers/goalsController");
const tasksRouter = require("./tasksRoutes");
const { authenticateJWT, authorizePermissions } = require("../middleware/authMiddleware");

router.use(authenticateJWT);

// Require either manage_gta OR view_gta to access goals listing
router.get("/", authorizePermissions(["manage_gta", "view_gta"]), goalsController.getGoals);

// Mutations still require manage_gta only
router.post("/", authorizePermissions(["manage_gta"]), goalsController.createGoal);
router.put("/:goalId", authorizePermissions(["manage_gta"]), goalsController.updateGoal);
router.delete("/:goalId", authorizePermissions(["manage_gta"]), goalsController.deleteGoal);

router.use("/:goalId/tasks", tasksRouter);
module.exports = router;
