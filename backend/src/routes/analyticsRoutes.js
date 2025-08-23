const express = require("express");
const router = express.Router();
const { authenticateJWT, authorizePermissions } = require("../middleware/authMiddleware");
const analyticsController = require("../controllers/analyticsController");

router.use(authenticateJWT);

router.get(
  "/dashboard",
  authorizePermissions(["view_analytics","manage_analytics"]),
  analyticsController.getDashboard
);

module.exports = router;
