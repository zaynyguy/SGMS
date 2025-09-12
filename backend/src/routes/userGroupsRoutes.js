// src/routes/userGroupsRoutes.js

const express = require("express");
const router = express.Router();
const userGroupsController = require("../controllers/userGroupsController");
const { authenticateJWT, authorizePermissions } = require("../middleware/authMiddleware");

router.use(authenticateJWT, authorizePermissions(["manage_access"]));

router.post("/", userGroupsController.addUserToGroup);
router.delete("/", userGroupsController.removeUserFromGroup);
router.get("/:groupId/users", userGroupsController.getGroupUsers);
router.get("/user/:userId/groups", userGroupsController.getUserGroups);

module.exports = router;
